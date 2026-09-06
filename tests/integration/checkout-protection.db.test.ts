/**
 * RFC-2 — Bằng chứng cấp DATABASE cho AC01 / AC03 / AC04 / AC07.
 *
 * Chạy trên POSTGRES THẬT với nhiều connection ĐỘC LẬP. Supabase client mock
 * KHÔNG chứng minh được lock hay transaction — đó là lý do file này tồn tại và
 * là lý do nó không được nằm chung với unit test.
 *
 * CHẠY:  npm run test:integration
 * CẦN:   TEST_DATABASE_URL trỏ tới một Postgres DÙNG-RỒI-BỎ.
 *        Ví dụ:
 *          docker run -d --name nutein-rfc2-pg -e POSTGRES_PASSWORD=postgres \
 *            -e POSTGRES_DB=nutein_test -p 55432:5432 postgres:16-alpine
 *          TEST_DATABASE_URL=postgres://postgres:postgres@localhost:55432/nutein_test
 *
 * KHÔNG có TEST_DATABASE_URL -> toàn bộ suite SKIP (không fail). Máy dev không
 * có Postgres không bị đỏ vì lý do hạ tầng.
 *
 * TUYỆT ĐỐI không trỏ vào database staging/production: bootstrap sẽ DROP SCHEMA.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { Client, Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const DATABASE_URL = process.env.TEST_DATABASE_URL;
const describeDb = DATABASE_URL ? describe : describe.skip;

const MIGRATION_PATH = path.resolve(
  __dirname,
  "../../supabase/migrations/20260906000000_checkout_abuse_protection.sql",
);
const BOOTSTRAP_PATH = path.resolve(
  __dirname,
  "./fixtures/bootstrap-schema.sql",
);

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";

let pool: Pool;

/** Payload create tối thiểu; test tự ghi đè phần nó quan tâm. */
function createPayload(overrides: Record<string, unknown> = {}) {
  const items = (overrides.items as unknown[]) ?? [
    {
      product_id: PRODUCT_ID,
      product_name: "Nutein",
      variant_info: "1 hũ",
      price: 199000,
      quantity: 1,
    },
  ];
  const totalPrice = Number(overrides.total_price ?? 199000);
  const shippingFee = Number(overrides.shipping_fee ?? 25000);
  const discountAmount = Number(overrides.discount_amount ?? 0);

  return {
    idempotency_key: `key-${Math.random().toString(36).slice(2)}`,
    request_hash: "hash-default",
    hash_version: 1,
    order_code: `NT-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
    status: "PENDING",
    payment_status: "UNPAID",
    payment_method: "BANK_TRANSFER",
    shipping_method: "STANDARD",
    total_price: totalPrice,
    shipping_fee: shippingFee,
    discount_amount: discountAmount,
    final_price: totalPrice + shippingFee - discountAmount,
    shipping_address: { fullName: "Nguyễn Văn A", lines: [] },
    note: null,
    coupon_code: null,
    coupon_discount_amount: 0,
    protection_version: 1,
    bank_active_cap: 2,
    cod_active_cap: null,
    daily_quota: null,
    payment_ttl_seconds: 1800,
    ...overrides,
    items,
  };
}

async function callCreate(payload: Record<string, unknown>) {
  const { rows } = await pool.query(
    "SELECT public.checkout_create_order_atomic($1::jsonb) AS r",
    [JSON.stringify(payload)],
  );
  return rows[0].r as { replayed: boolean; order_id: string };
}

/** Mỗi lần gọi dùng MỘT connection riêng — đúng hình dạng của request song song thật. */
async function callCreateOnOwnConnection(payload: Record<string, unknown>) {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query(
      "SELECT public.checkout_create_order_atomic($1::jsonb) AS r",
      [JSON.stringify(payload)],
    );
    return {
      ok: true as const,
      result: rows[0].r as { replayed: boolean; order_id: string },
    };
  } catch (error) {
    return { ok: false as const, code: (error as { code?: string }).code };
  } finally {
    await client.end();
  }
}

async function stockOf(): Promise<number> {
  const { rows } = await pool.query(
    "SELECT stock FROM public.products WHERE id = $1",
    [PRODUCT_ID],
  );
  return Number(rows[0].stock);
}

async function couponUsedCount(code: string): Promise<number> {
  const { rows } = await pool.query(
    "SELECT used_count FROM public.coupons WHERE code = $1",
    [code],
  );
  return Number(rows[0].used_count);
}

describeDb("RFC-2 — atomic checkout persistence (real Postgres)", () => {
  let userId: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 60 });

    // Bootstrap sạch mỗi lần chạy — nếu URL trỏ nhầm vào DB thật thì đây là
    // hành động phá huỷ, nên README/comment đầu file nói rõ "dùng-rồi-bỏ".
    await pool.query(
      "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;",
    );
    await pool.query(readFileSync(BOOTSTRAP_PATH, "utf8"));
    await pool.query(readFileSync(MIGRATION_PATH, "utf8"));
  }, 120_000);

  afterAll(async () => {
    await pool?.end();
  });

  beforeEach(async () => {
    await pool.query(
      "TRUNCATE public.order_payment_events, public.order_resource_reservations, public.checkout_requests, public.checkout_daily_quota, public.order_items, public.orders RESTART IDENTITY CASCADE",
    );
    await pool.query("DELETE FROM public.coupons");
    await pool.query("DELETE FROM public.products");
    await pool.query("DELETE FROM public.users");

    const { rows } = await pool.query(
      "INSERT INTO public.users (email) VALUES ('race@example.com') RETURNING id",
    );
    userId = rows[0].id;

    await pool.query(
      `INSERT INTO public.products (id, sku, name, slug, price, stock)
       VALUES ($1, 'NT-1', 'Nutein', 'nutein', 199000, 1000)`,
      [PRODUCT_ID],
    );
  });

  // ── §4 cutover: 3 trigger ghi dữ liệu cũ phải BIẾN MẤT ────────────────────
  describe("cutover trigger + ACL", () => {
    it("drop cả 3 trigger cũ — không có giai đoạn vừa trigger vừa RPC cùng trừ kho", async () => {
      const { rows } = await pool.query(
        `SELECT tgname FROM pg_trigger WHERE tgname IN
         ('trg_reduce_stock_on_order_item_insert','trg_validate_coupon','trg_restock_on_cancel_or_return')`,
      );
      expect(rows).toHaveLength(0);
    });

    it("drop CẢ HAI policy bypass PostgREST (F1 + F3), không chỉ một", async () => {
      const { rows } = await pool.query(
        `SELECT policyname FROM pg_policies WHERE policyname IN
         ('Users create own orders','Users insert own order items')`,
      );
      expect(rows).toHaveLength(0);
    });

    it("REVOKE quyền ghi orders/order_items khỏi anon + authenticated", async () => {
      for (const role of ["anon", "authenticated"]) {
        for (const table of ["orders", "order_items"]) {
          const { rows } = await pool.query(
            "SELECT has_table_privilege($1, $2, 'INSERT') AS can_insert, has_table_privilege($1, $2, 'UPDATE') AS can_update",
            [role, `public.${table}`],
          );
          expect(rows[0].can_insert, `${role} INSERT ${table}`).toBe(false);
          expect(rows[0].can_update, `${role} UPDATE ${table}`).toBe(false);
        }
      }
    });

    it("REVOKE EXECUTE RPC đặc quyền khỏi PUBLIC/anon/authenticated", async () => {
      for (const role of ["anon", "authenticated", "public"]) {
        const { rows } = await pool.query(
          "SELECT has_function_privilege($1, 'public.checkout_create_order_atomic(jsonb)', 'EXECUTE') AS can_exec",
          [role],
        );
        expect(rows[0].can_exec, `${role} EXECUTE create RPC`).toBe(false);
      }
    });
  });

  // ── AC01 + AC04: cap dưới đồng thời thật ──────────────────────────────────
  describe("AC01 — bank active cap", () => {
    it("50 create ĐỒNG THỜI cùng user không bao giờ vượt cap 2", async () => {
      const results = await Promise.all(
        Array.from({ length: 50 }, () =>
          callCreateOnOwnConnection(
            createPayload({ user_id: userId, bank_active_cap: 2 }),
          ),
        ),
      );

      const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS n FROM public.orders
         WHERE user_id = $1 AND payment_method = 'BANK_TRANSFER'
           AND payment_status = 'UNPAID' AND released_at IS NULL
           AND status NOT IN ('CANCELLED','RETURNED')`,
        [userId],
      );

      expect(rows[0].n).toBe(2);
      expect(results.filter((r) => r.ok)).toHaveLength(2);
      // Phần còn lại phải thua bằng ĐÚNG lý do cap, không phải deadlock.
      expect(results.filter((r) => !r.ok && r.code === "NTCAP")).toHaveLength(
        48,
      );
    });

    it("huỷ một đơn -> trả lại đúng MỘT slot, không nhiều hơn", async () => {
      const a = await callCreate(createPayload({ user_id: userId }));
      await callCreate(createPayload({ user_id: userId }));

      const blocked = await callCreateOnOwnConnection(
        createPayload({ user_id: userId }),
      );
      expect(blocked.ok).toBe(false);

      await pool.query(
        "SELECT public.checkout_transition_order_state($1::jsonb)",
        [
          JSON.stringify({
            order_id: a.order_id,
            action: "resolve_no_transfer",
            actor_type: "STAFF",
          }),
        ],
      );

      expect(
        (await callCreateOnOwnConnection(createPayload({ user_id: userId })))
          .ok,
      ).toBe(true);
      expect(
        (await callCreateOnOwnConnection(createPayload({ user_id: userId })))
          .ok,
      ).toBe(false);
    });
  });

  // ── AC03 + AC04: idempotency ──────────────────────────────────────────────
  describe("AC03 — idempotency", () => {
    it("20 request ĐỒNG THỜI cùng key -> ĐÚNG MỘT đơn, phần còn lại là replay", async () => {
      const payload = createPayload({
        user_id: userId,
        idempotency_key: "same-key",
        request_hash: "same-hash",
        // Cap cao để test này chỉ đo idempotency, không lẫn với cap.
        bank_active_cap: 1000,
      });

      const results = await Promise.all(
        Array.from({ length: 20 }, () =>
          callCreateOnOwnConnection({ ...payload }),
        ),
      );

      const { rows } = await pool.query(
        "SELECT COUNT(*)::int AS n FROM public.orders WHERE user_id = $1",
        [userId],
      );
      expect(rows[0].n).toBe(1);

      const succeeded = results.filter((r) => r.ok);
      const orderIds = new Set(succeeded.map((r) => r.result.order_id));
      expect(orderIds.size).toBe(1);
      expect(succeeded.filter((r) => !r.result.replayed)).toHaveLength(1);
    });

    it("mất response rồi retry cùng key -> replay đúng đơn cũ, KHÔNG tiêu thêm slot", async () => {
      const payload = createPayload({
        user_id: userId,
        idempotency_key: "lost-response",
        request_hash: "h1",
      });

      const first = await callCreate(payload);
      const retry = await callCreate(payload);

      expect(retry.replayed).toBe(true);
      expect(retry.order_id).toBe(first.order_id);

      const { rows } = await pool.query(
        "SELECT COUNT(*)::int AS n FROM public.orders WHERE user_id = $1",
        [userId],
      );
      expect(rows[0].n).toBe(1);
    });

    it("cùng key nhưng payload ĐỔI -> NTIDM (409), không tạo đơn thứ hai", async () => {
      await callCreate(
        createPayload({
          user_id: userId,
          idempotency_key: "k",
          request_hash: "hash-A",
        }),
      );

      const conflict = await callCreateOnOwnConnection(
        createPayload({
          user_id: userId,
          idempotency_key: "k",
          request_hash: "hash-B",
        }),
      );

      expect(conflict).toMatchObject({ ok: false, code: "NTIDM" });
      const { rows } = await pool.query(
        "SELECT COUNT(*)::int AS n FROM public.orders WHERE user_id = $1",
        [userId],
      );
      expect(rows[0].n).toBe(1);
    });

    it("replay KHÔNG trừ kho lần hai và KHÔNG tiêu thêm lượt coupon", async () => {
      await pool.query(
        "INSERT INTO public.coupons (code, discount_type, discount) VALUES ('SALE10','FIXED',20000)",
      );
      const payload = createPayload({
        user_id: userId,
        idempotency_key: "k-coupon",
        request_hash: "h",
        coupon_code: "SALE10",
        coupon_discount_amount: 20000,
        discount_amount: 20000,
      });

      await callCreate(payload);
      const stockAfterFirst = await stockOf();
      const couponAfterFirst = await couponUsedCount("SALE10");

      await callCreate(payload);

      expect(await stockOf()).toBe(stockAfterFirst);
      expect(await couponUsedCount("SALE10")).toBe(couponAfterFirst);
    });

    it("đơn đã HUỶ vẫn replay về đúng đơn cũ, không tạo đơn thay thế", async () => {
      const payload = createPayload({
        user_id: userId,
        idempotency_key: "k-cancel",
        request_hash: "h",
      });
      const created = await callCreate(payload);

      await pool.query(
        "SELECT public.checkout_transition_order_state($1::jsonb)",
        [
          JSON.stringify({
            order_id: created.order_id,
            action: "resolve_no_transfer",
            actor_type: "STAFF",
          }),
        ],
      );

      const replay = await callCreate(payload);
      expect(replay.replayed).toBe(true);
      expect(replay.order_id).toBe(created.order_id);
    });
  });

  // ── AC04: atomicity ───────────────────────────────────────────────────────
  describe("AC04 — một transaction, rollback toàn bộ", () => {
    it("hết hàng -> KHÔNG còn order, items, ledger hay key nào sót lại", async () => {
      await pool.query("UPDATE public.products SET stock = 1 WHERE id = $1", [
        PRODUCT_ID,
      ]);

      const failed = await callCreateOnOwnConnection(
        createPayload({
          user_id: userId,
          items: [
            {
              product_id: PRODUCT_ID,
              product_name: "Nutein",
              variant_info: "5 hũ",
              price: 199000,
              quantity: 5,
            },
          ],
        }),
      );

      expect(failed).toMatchObject({ ok: false, code: "NTSTK" });
      for (const table of [
        "orders",
        "order_items",
        "order_resource_reservations",
        "checkout_requests",
      ]) {
        const { rows } = await pool.query(
          `SELECT COUNT(*)::int AS n FROM public.${table}`,
        );
        expect(rows[0].n, `${table} phải rỗng sau rollback`).toBe(0);
      }
      expect(await stockOf()).toBe(1);
    });

    /**
     * ĐÂY LÀ RÒ RỈ MÀ RFC-2 ĐÓNG.
     * Đường cũ: trigger BEFORE INSERT orders tăng `used_count`, insert
     * `order_items` lỗi -> `orders.delete()` bù trừ nhưng KHÔNG giảm used_count.
     * Mỗi lần create hỏng giữa chừng mất vĩnh viễn một lượt coupon.
     */
    it("create hỏng SAU khi row orders đã được insert -> coupons.used_count KHÔNG ĐỔI", async () => {
      await pool.query(
        "INSERT INTO public.coupons (code, discount_type, discount) VALUES ('LEAK','FIXED',20000)",
      );
      const before = await couponUsedCount("LEAK");

      // Giá dòng ÂM: vi phạm CHECK (price >= 0) của `order_items`. Chọn đúng lỗi
      // này vì nó nổ tại bước INSERT order_items — tức là SAU khi row `orders`
      // đã tồn tại trong transaction, đúng thời điểm mà trigger CŨ đã kịp tăng
      // `used_count`. Đây chính xác là kịch bản rò rỉ mà đường `orders.delete()`
      // bù trừ không xử lý được.
      const failed = await callCreateOnOwnConnection(
        createPayload({
          user_id: userId,
          coupon_code: "LEAK",
          coupon_discount_amount: 20000,
          discount_amount: 20000,
          items: [
            {
              product_id: PRODUCT_ID,
              product_name: "Nutein",
              variant_info: "1 hũ",
              price: -1,
              quantity: 1,
            },
          ],
        }),
      );

      // 23514 = check_violation -> khẳng định lỗi ĐÚNG LÀ ở bước insert dòng
      // đơn, không phải một precheck sớm hơn (nếu không test sẽ xanh rỗng).
      expect(failed).toMatchObject({ ok: false, code: "23514" });
      expect(await couponUsedCount("LEAK")).toBe(before);
      const { rows } = await pool.query(
        "SELECT COUNT(*)::int AS n FROM public.orders",
      );
      expect(rows[0].n).toBe(0);
    });

    /**
     * CHỨNG MINH LỖI CŨ LÀ THẬT (red-before).
     *
     * Chạy ĐÚNG kịch bản trên qua đường HAI-WRITE cũ, trên một database riêng
     * chỉ có bootstrap (trigger cũ còn sống, chưa apply migration RFC-2). Nếu
     * test này không đỏ ở schema cũ thì test ở trên là xanh rỗng.
     */
    it("[red-before] đường hai-write CŨ thực sự làm rò rỉ một lượt coupon", async () => {
      const admin = new Client({ connectionString: DATABASE_URL });
      await admin.connect();
      await admin.query("DROP DATABASE IF EXISTS nutein_legacy_probe");
      await admin.query("CREATE DATABASE nutein_legacy_probe");
      await admin.end();

      const legacyUrl = DATABASE_URL!.replace(
        /\/[^/]*$/,
        "/nutein_legacy_probe",
      );
      const legacy = new Client({ connectionString: legacyUrl });
      await legacy.connect();
      try {
        // CHỈ bootstrap — KHÔNG apply migration RFC-2.
        await legacy.query(readFileSync(BOOTSTRAP_PATH, "utf8"));
        const u = await legacy.query(
          "INSERT INTO public.users (email) VALUES ('legacy@example.com') RETURNING id",
        );
        await legacy.query(
          `INSERT INTO public.products (id, sku, name, slug, price, stock)
           VALUES ($1,'NT-1','Nutein','nutein',199000,1000)`,
          [PRODUCT_ID],
        );
        const c = await legacy.query(
          "INSERT INTO public.coupons (code, discount_type, discount) VALUES ('LEAK','FIXED',20000) RETURNING id",
        );

        // Đúng đường cũ của order.repository.ts: insert orders -> insert
        // order_items -> lỗi -> delete orders bù trừ.
        const o = await legacy.query(
          `INSERT INTO public.orders
             (user_id, order_code, total_price, shipping_fee, discount_amount, final_price, shipping_address, coupon_id)
           VALUES ($1,'NT-LEAK',199000,25000,20000,204000,'{}'::jsonb,$2) RETURNING id`,
          [u.rows[0].id, c.rows[0].id],
        );
        await legacy
          .query(
            "INSERT INTO public.order_items (order_id, product_id, product_name, price, quantity) VALUES ($1,$2,'Nutein',-1,1)",
            [o.rows[0].id, PRODUCT_ID],
          )
          .catch(() => undefined);
        await legacy.query("DELETE FROM public.orders WHERE id = $1", [
          o.rows[0].id,
        ]);

        const { rows } = await legacy.query(
          "SELECT used_count FROM public.coupons WHERE code='LEAK'",
        );
        // Đơn đã bị xoá hoàn toàn, nhưng lượt coupon thì mất luôn.
        expect(Number(rows[0].used_count)).toBe(1);
      } finally {
        await legacy.end();
      }
    });

    it("coupon hết lượt -> NTCPN và không đơn nào được tạo", async () => {
      await pool.query(
        "INSERT INTO public.coupons (code, discount_type, discount, usage_limit, used_count) VALUES ('LAST','FIXED',20000,1,1)",
      );

      const failed = await callCreateOnOwnConnection(
        createPayload({
          user_id: userId,
          coupon_code: "LAST",
          coupon_discount_amount: 20000,
          discount_amount: 20000,
        }),
      );

      expect(failed).toMatchObject({ ok: false, code: "NTCPN" });
      expect(await couponUsedCount("LAST")).toBe(1);
    });

    it("client khai khống số tiền giảm -> NTVER, không đơn nào được tạo", async () => {
      const failed = await callCreateOnOwnConnection(
        createPayload({ user_id: userId, final_price: 1 }),
      );
      expect(failed).toMatchObject({ ok: false, code: "NTVER" });
    });
  });

  // ── AC07: ledger / restock ────────────────────────────────────────────────
  describe("AC07 — ledger restock", () => {
    /**
     * FIXTURE BẮT BUỘC TỐI THIỂU, không phải case tuỳ chọn:
     * `order.repository.ts` ghi product_id HẰNG SỐ cho mọi dòng (catalog
     * single-SKU), nên MỌI đơn nhiều dòng đều dính lỗi restock của trigger cũ
     * (`UPDATE ... FROM` chỉ hoàn một dòng).
     */
    it("đơn 2 dòng CÙNG product_id -> huỷ hoàn ĐÚNG TỔNG units, không phải một dòng", async () => {
      const before = await stockOf();
      const created = await callCreate(
        createPayload({
          user_id: userId,
          items: [
            {
              product_id: PRODUCT_ID,
              product_name: "Nutein",
              variant_info: "1 hũ",
              price: 199000,
              quantity: 3,
            },
            {
              product_id: PRODUCT_ID,
              product_name: "Nutein",
              variant_info: "5 hũ",
              price: 199000,
              quantity: 7,
            },
          ],
        }),
      );

      expect(await stockOf()).toBe(before - 10);

      await pool.query(
        "SELECT public.checkout_transition_order_state($1::jsonb)",
        [
          JSON.stringify({
            order_id: created.order_id,
            action: "resolve_no_transfer",
            actor_type: "STAFF",
          }),
        ],
      );

      expect(await stockOf()).toBe(before);
    });

    /**
     * CHỨNG MINH LỖI CŨ LÀ THẬT (red-before) cho fixture bắt buộc ở trên.
     * Trigger cũ dùng `UPDATE products p ... FROM order_items oi` — Postgres chỉ
     * áp MỘT dòng oi khớp cho mỗi dòng products, nên đơn 3+7 hũ chỉ được hoàn
     * lại 3 hoặc 7, không bao giờ 10.
     */
    it("[red-before] trigger restock CŨ hoàn THIẾU với đơn nhiều dòng cùng product_id", async () => {
      const admin = new Client({ connectionString: DATABASE_URL });
      await admin.connect();
      await admin.query("DROP DATABASE IF EXISTS nutein_legacy_restock");
      await admin.query("CREATE DATABASE nutein_legacy_restock");
      await admin.end();

      const legacy = new Client({
        connectionString: DATABASE_URL!.replace(
          /\/[^/]*$/,
          "/nutein_legacy_restock",
        ),
      });
      await legacy.connect();
      try {
        await legacy.query(readFileSync(BOOTSTRAP_PATH, "utf8"));
        const u = await legacy.query(
          "INSERT INTO public.users (email) VALUES ('legacy2@example.com') RETURNING id",
        );
        await legacy.query(
          `INSERT INTO public.products (id, sku, name, slug, price, stock)
           VALUES ($1,'NT-1','Nutein','nutein',199000,1000)`,
          [PRODUCT_ID],
        );
        const o = await legacy.query(
          `INSERT INTO public.orders
             (user_id, order_code, total_price, shipping_fee, discount_amount, final_price, shipping_address)
           VALUES ($1,'NT-MULTI',199000,25000,0,224000,'{}'::jsonb) RETURNING id`,
          [u.rows[0].id],
        );
        await legacy.query(
          `INSERT INTO public.order_items (order_id, product_id, product_name, price, quantity)
           VALUES ($1,$2,'Nutein',199000,3), ($1,$2,'Nutein',199000,7)`,
          [o.rows[0].id, PRODUCT_ID],
        );

        const afterCreate = await legacy.query(
          "SELECT stock FROM public.products WHERE id=$1",
          [PRODUCT_ID],
        );
        expect(Number(afterCreate.rows[0].stock)).toBe(990); // trừ đủ 10

        await legacy.query(
          "UPDATE public.orders SET status='CANCELLED' WHERE id=$1",
          [o.rows[0].id],
        );

        const afterCancel = await legacy.query(
          "SELECT stock FROM public.products WHERE id=$1",
          [PRODUCT_ID],
        );
        // Hoàn THIẾU: chỉ một dòng được cộng lại, nên < 1000.
        expect(Number(afterCancel.rows[0].stock)).toBeLessThan(1000);
        expect([993, 997]).toContain(Number(afterCancel.rows[0].stock));
      } finally {
        await legacy.end();
      }
    });

    it("gọi release lần hai KHÔNG hoàn kho lần hai (idempotent)", async () => {
      const before = await stockOf();
      const created = await callCreate(createPayload({ user_id: userId }));

      await pool.query(
        "SELECT public.checkout_release_reservation($1, 'test')",
        [created.order_id],
      );
      const afterFirst = await stockOf();
      await pool.query(
        "SELECT public.checkout_release_reservation($1, 'test')",
        [created.order_id],
      );

      expect(afterFirst).toBe(before);
      expect(await stockOf()).toBe(before);
    });

    it("huỷ trả lượt coupon ĐÚNG MỘT LẦN", async () => {
      await pool.query(
        "INSERT INTO public.coupons (code, discount_type, discount) VALUES ('ONCE','FIXED',20000)",
      );
      const created = await callCreate(
        createPayload({
          user_id: userId,
          coupon_code: "ONCE",
          coupon_discount_amount: 20000,
          discount_amount: 20000,
        }),
      );
      expect(await couponUsedCount("ONCE")).toBe(1);

      const cancel = JSON.stringify({
        order_id: created.order_id,
        action: "resolve_no_transfer",
        actor_type: "STAFF",
      });
      await pool.query(
        "SELECT public.checkout_transition_order_state($1::jsonb)",
        [cancel],
      );
      await pool
        .query("SELECT public.checkout_transition_order_state($1::jsonb)", [
          cancel,
        ])
        .catch(() => undefined);

      expect(await couponUsedCount("ONCE")).toBe(0);
    });

    it("đơn ĐÃ THANH TOÁN không bao giờ bị hoàn kho (ledger = CONSUMED)", async () => {
      const before = await stockOf();
      const created = await callCreate(createPayload({ user_id: userId }));

      await pool.query(
        "SELECT public.checkout_transition_order_state($1::jsonb)",
        [
          JSON.stringify({
            order_id: created.order_id,
            action: "confirm_payment",
            actor_type: "STAFF",
          }),
        ],
      );
      await pool.query(
        "SELECT public.checkout_release_reservation($1, 'worker')",
        [created.order_id],
      );

      expect(await stockOf()).toBe(before - 1);
    });

    it("confirm_payment trên đơn ĐÃ HUỶ bị từ chối (NTSTA)", async () => {
      const created = await callCreate(createPayload({ user_id: userId }));
      await pool.query(
        "SELECT public.checkout_transition_order_state($1::jsonb)",
        [
          JSON.stringify({
            order_id: created.order_id,
            action: "resolve_no_transfer",
            actor_type: "STAFF",
          }),
        ],
      );

      await expect(
        pool.query("SELECT public.checkout_transition_order_state($1::jsonb)", [
          JSON.stringify({
            order_id: created.order_id,
            action: "confirm_payment",
            actor_type: "STAFF",
          }),
        ]),
      ).rejects.toMatchObject({ code: "NTSTA" });
    });

    it("claim của khách KHÔNG đặt PAID, KHÔNG đổi deadline, KHÔNG trả slot", async () => {
      const created = await callCreate(createPayload({ user_id: userId }));
      const beforeRow = await pool.query(
        "SELECT payment_expires_at, released_at FROM public.orders WHERE id = $1",
        [created.order_id],
      );

      await pool.query(
        "SELECT public.checkout_transition_order_state($1::jsonb)",
        [
          JSON.stringify({
            order_id: created.order_id,
            action: "claim_payment",
            actor_type: "CUSTOMER",
          }),
        ],
      );

      const { rows } = await pool.query(
        "SELECT payment_status, payment_review_state, payment_expires_at, released_at FROM public.orders WHERE id = $1",
        [created.order_id],
      );
      expect(rows[0].payment_status).toBe("UNPAID");
      expect(rows[0].payment_review_state).toBe("PAYMENT_CLAIMED");
      expect(rows[0].payment_expires_at).toEqual(
        beforeRow.rows[0].payment_expires_at,
      );
      expect(rows[0].released_at).toBeNull();
    });

    it("expectedVersion lệch -> NTSTA thay vì ghi đè im lặng", async () => {
      const created = await callCreate(createPayload({ user_id: userId }));

      await expect(
        pool.query("SELECT public.checkout_transition_order_state($1::jsonb)", [
          JSON.stringify({
            order_id: created.order_id,
            action: "claim_payment",
            expected_version: 99,
          }),
        ]),
      ).rejects.toMatchObject({ code: "NTSTA" });
    });
  });

  describe("audit", () => {
    it("order_payment_events là append-only", async () => {
      const created = await callCreate(createPayload({ user_id: userId }));
      await expect(
        pool.query(
          "UPDATE public.order_payment_events SET reason = 'x' WHERE order_id = $1",
          [created.order_id],
        ),
      ).rejects.toMatchObject({ code: "NTAPP" });
    });
  });
});
