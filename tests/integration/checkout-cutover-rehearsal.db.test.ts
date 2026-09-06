/**
 * RFC-5 — DIỄN TẬP CUTOVER / BACKFILL / ROLLBACK (AC12, cấp local).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PHẠM VI BẰNG CHỨNG — ĐỌC TRƯỚC KHI TRÍCH DẪN FILE NÀY
 *
 *   File này chứng minh SQL của migration
 *   `supabase/migrations/20260906000000_checkout_abuse_protection.sql`
 *   chạy đúng trên một schema ĐƯỢC DỰNG LẠI BẰNG TAY
 *   (`tests/integration/fixtures/bootstrap-schema.sql`) với dữ liệu giả.
 *
 *   Nó KHÔNG phải diễn tập staging mà AC12 yêu cầu. Nó KHÔNG chứng minh gì về
 *   database Supabase đã deploy: dữ liệu thật, ACL thật, connection pooling /
 *   PgBouncer, và độ trôi schema đều CHƯA được kiểm chứng. Diễn tập staging
 *   vẫn là PENDING (cần owner cấp một Supabase staging).
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * CHẠY:  npm run test:integration
 * CẦN:   TEST_DATABASE_URL trỏ tới một Postgres DÙNG-RỒI-BỎ.
 *          docker run -d --name nutein-rfc2-pg -e POSTGRES_PASSWORD=postgres \
 *            -e POSTGRES_DB=nutein_test -p 55432:5432 postgres:16-alpine
 *          TEST_DATABASE_URL=postgres://postgres:postgres@localhost:55432/nutein_test
 *
 * KHÔNG có TEST_DATABASE_URL -> toàn bộ suite SKIP (không fail), nên `npm test`
 * mặc định không bao giờ chạm tới nó.
 *
 * TUYỆT ĐỐI không trỏ vào staging/production: bootstrap DROP SCHEMA public.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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

const PRODUCT_ID = "22222222-2222-4222-8222-222222222222";
const INITIAL_STOCK = 1000;

/** Ảnh chụp các con số mà migration CAM KẾT không được đụng tới (§8). */
interface Snapshot {
  stock: number;
  couponUsedCount: number;
  orderCount: number;
  orderItemCount: number;
}

let pool: Pool;
let userId: string;
let couponId: string;
const orderIds: Record<string, string> = {};

async function snapshot(): Promise<Snapshot> {
  const { rows } = await pool.query(
    `SELECT
       (SELECT stock FROM public.products WHERE id = $1)               AS stock,
       (SELECT used_count FROM public.coupons WHERE id = $2)           AS coupon_used_count,
       (SELECT COUNT(*) FROM public.orders)                            AS order_count,
       (SELECT COUNT(*) FROM public.order_items)                       AS order_item_count`,
    [PRODUCT_ID, couponId],
  );
  return {
    stock: Number(rows[0].stock),
    couponUsedCount: Number(rows[0].coupon_used_count),
    orderCount: Number(rows[0].order_count),
    orderItemCount: Number(rows[0].order_item_count),
  };
}

/** Tạo một đơn LEGACY qua đúng đường cũ, để trigger cũ chạy thật. */
async function seedLegacyOrder(opts: {
  code: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  couponId?: string | null;
  lines: number[];
}): Promise<string> {
  const total = opts.lines.reduce((sum, qty) => sum + qty * 199000, 0);
  const { rows } = await pool.query(
    `INSERT INTO public.orders
       (user_id, order_code, status, payment_method, payment_status,
        total_price, shipping_fee, discount_amount, final_price,
        shipping_address, coupon_id)
     VALUES ($1, $2, $3::"OrderStatus", $4::"PaymentMethod", $5::"PaymentStatus",
             $6, 0, 0, $6, '{"fullName":"Legacy"}'::jsonb, $7)
     RETURNING id`,
    [
      userId,
      opts.code,
      // Đơn "đã huỷ" phải được TẠO ở trạng thái sống rồi mới UPDATE sang
      // CANCELLED, nếu không trigger restock cũ (AFTER UPDATE OF status) sẽ
      // không bao giờ chạy và fixture sẽ không giống dữ liệu lịch sử thật.
      opts.status === "CANCELLED" ? "PENDING" : opts.status,
      opts.paymentMethod,
      opts.paymentStatus,
      total,
      opts.couponId ?? null,
    ],
  );
  const orderId = rows[0].id as string;

  for (const qty of opts.lines) {
    await pool.query(
      `INSERT INTO public.order_items
         (order_id, product_id, product_name, variant_info, price, quantity)
       VALUES ($1, $2, 'Nutein', '1 hũ', 199000, $3)`,
      [orderId, PRODUCT_ID, qty],
    );
  }

  if (opts.status === "CANCELLED") {
    await pool.query(
      `UPDATE public.orders SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1`,
      [orderId],
    );
  }
  return orderId;
}

async function reservationOf(orderId: string) {
  const { rows } = await pool.query(
    `SELECT stock_state, coupon_state, coupon_id, released_at
     FROM public.order_resource_reservations WHERE order_id = $1`,
    [orderId],
  );
  return rows;
}

async function releasedAtOf(orderId: string) {
  const { rows } = await pool.query(
    "SELECT released_at FROM public.orders WHERE id = $1",
    [orderId],
  );
  return rows[0].released_at as Date | null;
}

describeDb("RFC-5 — diễn tập cutover/backfill/rollback (Postgres cục bộ)", () => {
  let before: Snapshot;
  let after: Snapshot;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 10 });

    // ── Giai đoạn 1: trạng thái TRƯỚC cutover — trigger cũ còn sống ─────────
    await pool.query(
      "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;",
    );
    await pool.query(readFileSync(BOOTSTRAP_PATH, "utf8"));

    const users = await pool.query(
      "INSERT INTO public.users (email) VALUES ('cutover@example.com') RETURNING id",
    );
    userId = users.rows[0].id;

    await pool.query(
      `INSERT INTO public.products (id, sku, name, slug, price, stock)
       VALUES ($1, 'NT-1', 'Nutein', 'nutein', 199000, $2)`,
      [PRODUCT_ID, INITIAL_STOCK],
    );

    // Coupon ở LƯỢT CUỐI: usage_limit = 1, sẽ bị dùng hết bởi đơn bên dưới.
    const coupons = await pool.query(
      `INSERT INTO public.coupons (code, discount, usage_limit, used_count)
       VALUES ('LASTUSE', 10000, 1, 0) RETURNING id`,
    );
    couponId = coupons.rows[0].id;

    // ── Dataset legacy "khó chịu" có chủ đích ──────────────────────────────
    // Đơn nhiều dòng CÙNG product_id — hình dạng chuẩn của repo này
    // (order.repository.ts ghi product_id hằng số cho mọi dòng).
    orderIds.multiline = await seedLegacyOrder({
      code: "LEGACY-MULTILINE",
      status: "PENDING",
      paymentStatus: "UNPAID",
      paymentMethod: "BANK_TRANSFER",
      lines: [3, 7],
    });
    orderIds.coupon = await seedLegacyOrder({
      code: "LEGACY-COUPON-LASTUSE",
      status: "PENDING",
      paymentStatus: "UNPAID",
      paymentMethod: "BANK_TRANSFER",
      couponId,
      lines: [1],
    });
    orderIds.paid = await seedLegacyOrder({
      code: "LEGACY-PAID",
      status: "PROCESSING",
      paymentStatus: "PAID",
      paymentMethod: "BANK_TRANSFER",
      lines: [2],
    });
    orderIds.cancelled = await seedLegacyOrder({
      code: "LEGACY-CANCELLED",
      status: "CANCELLED",
      paymentStatus: "UNPAID",
      paymentMethod: "BANK_TRANSFER",
      lines: [4, 6],
    });
    orderIds.delivered = await seedLegacyOrder({
      code: "LEGACY-DELIVERED",
      status: "DELIVERED",
      paymentStatus: "PAID",
      paymentMethod: "COD",
      lines: [5],
    });

    before = await snapshot();

    // ── Giai đoạn 2: APPLY migration trong MỘT transaction ─────────────────
    // File migration tự mở BEGIN và đóng COMMIT; gửi nguyên khối = một
    // transaction duy nhất, đúng như owner sẽ chạy trong SQL Editor.
    await pool.query(readFileSync(MIGRATION_PATH, "utf8"));

    after = await snapshot();
  }, 180_000);

  afterAll(async () => {
    await pool?.end();
  });

  // ── (a) §8 hứa: KHÔNG đụng một con số nào ────────────────────────────────
  describe("(a) backfill không thay đổi số liệu kho/coupon", () => {
    it("migration tự nó là một transaction (BEGIN...COMMIT)", () => {
      const sql = readFileSync(MIGRATION_PATH, "utf8");
      expect(sql).toMatch(/^\s*BEGIN;/m);
      expect(sql.trimEnd().endsWith("COMMIT;")).toBe(true);
    });

    it("products.stock KHÔNG đổi sau migration", () => {
      expect(after.stock).toBe(before.stock);
    });

    it("coupons.used_count KHÔNG đổi sau migration", () => {
      expect(after.couponUsedCount).toBe(before.couponUsedCount);
      // Fixture đúng ý đồ: coupon THẬT SỰ đang ở lượt cuối trước khi migrate.
      expect(before.couponUsedCount).toBe(1);
    });

    it("số đơn và số dòng đơn KHÔNG đổi", () => {
      expect(after.orderCount).toBe(before.orderCount);
      expect(after.orderItemCount).toBe(before.orderItemCount);
      expect(after.orderCount).toBe(5);
    });
  });

  // ── (b) mỗi đơn legacy có ĐÚNG MỘT dòng ledger, đúng trạng thái ──────────
  describe("(b) ledger backfill: một dòng/đơn, đúng state", () => {
    it("mọi đơn legacy đều có đúng 1 dòng reservation, không thừa không thiếu", async () => {
      const { rows } = await pool.query(
        `SELECT o.id, COUNT(r.order_id) AS n
         FROM public.orders o
         LEFT JOIN public.order_resource_reservations r ON r.order_id = o.id
         GROUP BY o.id HAVING COUNT(r.order_id) <> 1`,
      );
      expect(rows).toEqual([]);
    });

    it("đơn chưa trả tiền, chưa terminal -> RESERVED", async () => {
      for (const key of ["multiline", "coupon"]) {
        const [row] = await reservationOf(orderIds[key]);
        expect(row.stock_state, key).toBe("RESERVED");
        expect(row.released_at, key).toBeNull();
      }
    });

    it("đơn có coupon -> coupon_state RESERVED và giữ đúng coupon_id; đơn không coupon -> NONE", async () => {
      const [withCoupon] = await reservationOf(orderIds.coupon);
      expect(withCoupon.coupon_state).toBe("RESERVED");
      expect(withCoupon.coupon_id).toBe(couponId);

      const [withoutCoupon] = await reservationOf(orderIds.multiline);
      expect(withoutCoupon.coupon_state).toBe("NONE");
      expect(withoutCoupon.coupon_id).toBeNull();
    });

    it("đơn PAID -> CONSUMED (không bao giờ được hoàn kho)", async () => {
      const [row] = await reservationOf(orderIds.paid);
      expect(row.stock_state).toBe("CONSUMED");
    });

    it("đơn DELIVERED -> CONSUMED", async () => {
      const [row] = await reservationOf(orderIds.delivered);
      expect(row.stock_state).toBe("CONSUMED");
    });

    it("đơn CANCELLED -> RELEASED và có released_at trong ledger", async () => {
      const [row] = await reservationOf(orderIds.cancelled);
      expect(row.stock_state).toBe("RELEASED");
      expect(row.released_at).not.toBeNull();
    });

    it("mọi đơn legacy có protection_version NULL (không bị backfill nhầm)", async () => {
      const { rows } = await pool.query(
        "SELECT COUNT(*) AS n FROM public.orders WHERE protection_version IS NOT NULL",
      );
      expect(Number(rows[0].n)).toBe(0);
    });
  });

  // ── (c) released_at trên orders + hệ quả với cap ─────────────────────────
  describe("(c) orders.released_at cho đơn terminal", () => {
    it("CANCELLED được set released_at", async () => {
      expect(await releasedAtOf(orderIds.cancelled)).not.toBeNull();
    });

    it("DELIVERED/PAID KHÔNG được set released_at — có chủ đích, xem ghi chú", async () => {
      // Migration §8 chỉ set released_at cho CANCELLED/RETURNED. Đơn PAID và
      // DELIVERED vẫn released_at = NULL nhưng KHÔNG lọt vào cap vì predicate
      // cap còn đòi payment_status = 'UNPAID'.
      // RỦI RO CÒN LẠI (ghi vào runbook, không tự sửa ở đây): một đơn
      // BANK_TRANSFER ở trạng thái DELIVERED mà vẫn UNPAID sẽ bị đếm vào cap.
      // Truy vấn đối soát trong runbook liệt kê đúng nhóm này cho owner.
      expect(await releasedAtOf(orderIds.paid)).toBeNull();
      expect(await releasedAtOf(orderIds.delivered)).toBeNull();
    });

    it("cap đếm đúng 2 đơn bank đang giữ chỗ của user legacy", async () => {
      const { rows } = await pool.query(
        `SELECT COUNT(*) AS n FROM public.orders
         WHERE user_id = $1 AND payment_method = 'BANK_TRANSFER'
           AND payment_status = 'UNPAID' AND released_at IS NULL
           AND status NOT IN ('CANCELLED','RETURNED')`,
        [userId],
      );
      // multiline + coupon = 2. PAID bị loại bởi payment_status,
      // CANCELLED bị loại bởi released_at + status.
      expect(Number(rows[0].n)).toBe(2);
    });
  });

  // ── (d) cutover: trigger cũ và policy bypass phải BIẾN MẤT ───────────────
  describe("(d) cutover gỡ trigger cũ + policy bypass", () => {
    it("cả 3 trigger ghi dữ liệu cũ đã bị drop", async () => {
      const { rows } = await pool.query(
        `SELECT tgname FROM pg_trigger WHERE tgname IN
         ('trg_reduce_stock_on_order_item_insert','trg_validate_coupon','trg_restock_on_cancel_or_return')`,
      );
      expect(rows).toEqual([]);
    });

    it("cả 2 RLS policy bypass PostgREST (F1 + F3) đã bị drop", async () => {
      const { rows } = await pool.query(
        `SELECT policyname FROM pg_policies WHERE policyname IN
         ('Users create own orders','Users insert own order items')`,
      );
      expect(rows).toEqual([]);
    });

    it("sau cutover, insert order_items KHÔNG còn tự trừ kho (không có giai đoạn trigger+RPC cùng trừ)", async () => {
      const stockBefore = (await snapshot()).stock;
      await pool.query(
        `INSERT INTO public.order_items (order_id, product_id, product_name, price, quantity)
         VALUES ($1, $2, 'Nutein', 199000, 9)`,
        [orderIds.multiline, PRODUCT_ID],
      );
      expect((await snapshot()).stock).toBe(stockBefore);
      await pool.query(
        "DELETE FROM public.order_items WHERE order_id = $1 AND quantity = 9",
        [orderIds.multiline],
      );
    });
  });

  // ── (e) RPC tồn tại và EXECUTE bị thu hồi ────────────────────────────────
  describe("(e) RPC hiện hữu + EXECUTE bị REVOKE", () => {
    const RPCS = [
      "public.checkout_create_order_atomic(jsonb)",
      "public.checkout_transition_order_state(jsonb)",
    ];

    it("các RPC đã được tạo", async () => {
      for (const signature of RPCS) {
        const { rows } = await pool.query(
          "SELECT to_regprocedure($1) IS NOT NULL AS exists",
          [signature],
        );
        expect(rows[0].exists, signature).toBe(true);
      }
    });

    it("PUBLIC / anon / authenticated KHÔNG có EXECUTE", async () => {
      for (const signature of RPCS) {
        for (const role of ["public", "anon", "authenticated"]) {
          const { rows } = await pool.query(
            "SELECT has_function_privilege($1, $2, 'EXECUTE') AS can_exec",
            [role, signature],
          );
          expect(rows[0].can_exec, `${role} -> ${signature}`).toBe(false);
        }
      }
    });

    it("anon/authenticated KHÔNG ghi được orders/order_items/ledger", async () => {
      const tables = [
        "orders",
        "order_items",
        "order_resource_reservations",
        "checkout_requests",
      ];
      for (const role of ["anon", "authenticated"]) {
        for (const table of tables) {
          const { rows } = await pool.query(
            `SELECT has_table_privilege($1, $2, 'INSERT') AS i,
                    has_table_privilege($1, $2, 'UPDATE') AS u`,
            [role, `public.${table}`],
          );
          expect(rows[0].i, `${role} INSERT ${table}`).toBe(false);
          expect(rows[0].u, `${role} UPDATE ${table}`).toBe(false);
        }
      }
    });
  });

  // ── (f) DIỄN TẬP ROLLBACK theo đúng định nghĩa của plan (§Rollout 8–9) ───
  describe("(f) rollback = forward-fix + kill-switch, KHÔNG drop bảng", () => {
    it("chạy lại backfill là idempotent — không sinh dòng ledger trùng", async () => {
      const countBefore = await pool.query(
        "SELECT COUNT(*) AS n FROM public.order_resource_reservations",
      );
      // Đúng câu INSERT của §8, có mệnh đề WHERE NOT EXISTS.
      await pool.query(
        `INSERT INTO public.order_resource_reservations
           (order_id, stock_state, coupon_state, coupon_id, reserved_at, released_at)
         SELECT o.id,
           CASE WHEN o.status IN ('CANCELLED','RETURNED') THEN 'RELEASED'
                WHEN o.status = 'DELIVERED' OR o.payment_status = 'PAID' THEN 'CONSUMED'
                ELSE 'RESERVED' END,
           CASE WHEN o.coupon_id IS NULL THEN 'NONE'
                WHEN o.status IN ('CANCELLED','RETURNED') THEN 'RELEASED'
                WHEN o.status = 'DELIVERED' OR o.payment_status = 'PAID' THEN 'CONSUMED'
                ELSE 'RESERVED' END,
           o.coupon_id, o.created_at,
           CASE WHEN o.status IN ('CANCELLED','RETURNED') THEN o.updated_at ELSE NULL END
         FROM public.orders o
         WHERE NOT EXISTS (
           SELECT 1 FROM public.order_resource_reservations r WHERE r.order_id = o.id
         )`,
      );
      const countAfter = await pool.query(
        "SELECT COUNT(*) AS n FROM public.order_resource_reservations",
      );
      expect(Number(countAfter.rows[0].n)).toBe(
        Number(countBefore.rows[0].n),
      );
    });

    it("apply lại TOÀN BỘ migration lần hai vẫn thành công và không đổi số liệu", async () => {
      const beforeReapply = await snapshot();
      await pool.query(readFileSync(MIGRATION_PATH, "utf8"));
      const afterReapply = await snapshot();
      expect(afterReapply).toEqual(beforeReapply);
    });

    it("kill-switch: đọc đơn và đối soát của staff vẫn chạy khi ngừng nhận đơn mới", async () => {
      // Kill-switch của plan là dừng CHECKOUT MỚI, không phải đóng database.
      // Đường đọc + đường đối soát phải còn sống.
      const { rows } = await pool.query(
        `SELECT o.order_code, r.stock_state
         FROM public.orders o
         JOIN public.order_resource_reservations r ON r.order_id = o.id
         ORDER BY o.order_code`,
      );
      expect(rows).toHaveLength(5);
    });

    it("rollback KHÔNG hồi sinh trigger cũ (chống hoàn kho hai lần)", async () => {
      const { rows } = await pool.query(
        `SELECT tgname FROM pg_trigger WHERE tgname = 'trg_restock_on_cancel_or_return'`,
      );
      expect(rows).toEqual([]);
    });
  });

  // ── (g) truy vấn đối soát mà operator sẽ chạy sau cutover ────────────────
  describe("(g) truy vấn đối soát hậu-cutover (bản chạy được)", () => {
    it("R1 — không có đơn nào thiếu dòng ledger", async () => {
      const { rows } = await pool.query(
        `SELECT o.id, o.order_code FROM public.orders o
         WHERE NOT EXISTS (
           SELECT 1 FROM public.order_resource_reservations r WHERE r.order_id = o.id
         )`,
      );
      expect(rows).toEqual([]);
    });

    it("R2 — không có ledger mồ côi (trỏ tới đơn không tồn tại)", async () => {
      const { rows } = await pool.query(
        `SELECT r.order_id FROM public.order_resource_reservations r
         WHERE NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.id = r.order_id)`,
      );
      expect(rows).toEqual([]);
    });

    it("R3 — không có ledger mâu thuẫn với trạng thái đơn", async () => {
      const { rows } = await pool.query(
        `SELECT o.order_code, o.status, o.payment_status, r.stock_state
         FROM public.orders o
         JOIN public.order_resource_reservations r ON r.order_id = o.id
         WHERE (o.status IN ('CANCELLED','RETURNED') AND r.stock_state <> 'RELEASED')
            OR (o.payment_status = 'PAID'            AND r.stock_state  = 'RELEASED')`,
      );
      expect(rows).toEqual([]);
    });

    it("R4 — không có coupon used_count âm và không vượt usage_limit", async () => {
      const { rows } = await pool.query(
        `SELECT code, used_count, usage_limit FROM public.coupons
         WHERE used_count < 0 OR (usage_limit IS NOT NULL AND used_count > usage_limit)`,
      );
      expect(rows).toEqual([]);
    });

    it("R5 — phát hiện chênh lệch restock do trigger CŨ để lại (đơn nhiều dòng)", async () => {
      // Trigger cũ dùng UPDATE ... FROM nên chỉ hoàn ĐÚNG MỘT dòng. Đơn
      // CANCELLED [4,6] đáng lẽ hoàn 10, thực tế chỉ hoàn 4 hoặc 6.
      // Migration CỐ Ý không tự sửa (§8); đây là việc đối soát của owner.
      const { rows } = await pool.query(
        `SELECT SUM(oi.quantity) AS should_have_restocked
         FROM public.order_items oi WHERE oi.order_id = $1`,
        [orderIds.cancelled],
      );
      expect(Number(rows[0].should_have_restocked)).toBe(10);

      const consumed =
        INITIAL_STOCK - (await snapshot()).stock;
      // Đã đặt: 3+7 + 1 + 2 + 4+6 + 5 = 28. Đã hoàn (thiếu): 4 hoặc 6.
      const restoredByOldTrigger = 28 - consumed;
      expect([4, 6]).toContain(restoredByOldTrigger);
      // => chênh lệch thật cần đối soát:
      expect(10 - restoredByOldTrigger).toBeGreaterThan(0);
    });
  });

  // ── (h) EXPLAIN — CỤC BỘ, dataset tí hon. KHÔNG PHẢI gate AC13 ───────────
  describe("(h) EXPLAIN cap query (cục bộ, dataset tí hon — KHÔNG phải AC13)", () => {
    it("ghi lại plan mà Postgres chọn cho truy vấn đếm cap", async () => {
      const { rows } = await pool.query(
        `EXPLAIN (FORMAT TEXT)
         SELECT COUNT(*) FROM public.orders o
         WHERE o.user_id = $1 AND o.payment_method = 'BANK_TRANSFER'
           AND o.payment_status = 'UNPAID' AND o.released_at IS NULL
           AND o.status NOT IN ('CANCELLED','RETURNED')`,
        [userId],
      );
      const plan = rows.map((r) => r["QUERY PLAN"]).join("\n");
      console.log("[RFC-5 EXPLAIN — cục bộ, 5 dòng, KHÔNG phải gate AC13]\n" + plan);
      // Với 5 dòng, planner CHẮC CHẮN chọn seq scan — chi phí index cao hơn.
      // Vì vậy KHÔNG assert index được dùng: assert như thế sẽ là bằng chứng
      // giả. Chỉ khẳng định index TỒN TẠI; việc nó có được chọn ở quy mô thật
      // hay không là gate AC13 trên staging 100k dòng (PENDING).
      expect(plan.length).toBeGreaterThan(0);
    });

    it("partial index cho cap query đã tồn tại", async () => {
      const { rows } = await pool.query(
        `SELECT indexdef FROM pg_indexes
         WHERE schemaname = 'public' AND indexname = 'idx_orders_active_unpaid_bank'`,
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].indexdef).toContain("WHERE");
    });
  });
});
