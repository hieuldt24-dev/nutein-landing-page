# Nutein — Plan triển khai Checkout (ready-to-integrate, chưa có backend)

> Plan riêng cho flow **Cart → Checkout → Order Success**. Phạm vi bám `PROJECT_REQUIREMENTS.md` mục **3.4 Thanh Toán** + **3.10 Xác nhận đặt hàng thành công**.
>
> **UI reference:** Joy Rush checkout (guest + logged-in) — chỉ lấy **layout energy / nhịp 2 cột / trạng thái auth**, **không** copy logic thanh toán Shopify (credit card, ZIP/US address, “Pay now”, discount-code box độc lập nếu conflict với voucher Nutein).
>
> Mục tiêu: chốt cách implement UI + contract sao cho khi có API checkout thật thì thay phần adapter, không phải đập lại form/page.

## 0. Bối cảnh & ràng buộc

| Hạng mục | Hiện trạng |
|---|---|
| Cart | Đã ổn: drawer + `useCartStore` (SWR-as-store) + `cartService` / `cartRepository` (localStorage) + `CartSummary` shape sẵn sàng giống response API |
| Checkout UI | Chưa có route; CTA cart đang toast “đang phát triển” |
| Backend checkout / order / payment | **Chưa có** |
| Model | **Single-SKU** — 1 dòng hàng (quantity ± variant sau này), không cart multi-product |
| Kiến trúc | `app/` mỏng → `features/checkout/` → `src/` infra; form = RHF + Zod; loading theo `docs/loading-agent-guide.md` |

### Quyết định chiến lược (khuyến nghị)

**Không chờ backend mới làm UI.** Làm theo hướng **contract-first + mock BFF trong Next.js**:

```txt
UI (RHF)  →  POST /api/checkout  →  checkoutService  →  [MOCK hôm nay | HTTP backend thật sau]
                              ↘ validate Zod (request/response)
```

Lý do chọn hướng này (thay vì chỉ mock trong client như cart):

1. **Checkout là write quan trọng** (đặt hàng) — path production phải đi qua API route + validate server, không submit thẳng từ browser tới third-party.
2. UI học đúng contract (`CreateOrderRequest` / `CreateOrderResponse`) từ ngày đầu → khi có backend chỉ đổi thân service/repository.
3. Có thể **tính lại tiền phía server** (hoặc mock server) từ `quantity` — không tin `total` client gửi lên (tránh lệch voucher/ship khi integrate).
4. Đồng bộ với pattern đã có: `POST /api/contact` + `contactService` placeholder (`server-only`).

Cart giữ local (đúng) vì chưa cần sync server; checkout **không** copy nguyên local-only — vì tạo đơn là side-effect cần idempotency / rate-limit / audit sau này.

---

## 1. Requirement nguồn (không mở rộng)

### 1.1 `/checkout` — PROJECT_REQUIREMENTS §3.4

- Thông tin người mua: họ tên, SĐT, email, địa chỉ (Tỉnh/Quận/Phường), ghi chú đơn hàng.
- Phương thức giao hàng: Tiêu chuẩn / Nhanh.
- Phương thức thanh toán: COD · Chuyển khoản · Ví điện tử.
- Xác nhận đơn: sản phẩm, số lượng, giá, phí ship, voucher, tổng.
- CTA: Đặt hàng ngay.

### 1.2 `/checkout/success` — §3.10

- Cảm ơn + **mã đơn hàng**.
- Thông tin giao hàng + thời gian giao dự kiến.
- CTA phụ: tiếp tục mua · công thức · blog (reuse link/CTA hiện có nếu có).

### 1.3 Ngoài phạm vi v1 (ghi rõ để không scope creep)

| Không làm v1 | Lý do |
|---|---|
| Payment gateway thật (VNPay/MoMo redirect) | Chưa có API/merchant; UI chỉ chọn method + copy hướng dẫn CK/ví |
| Đồng bộ cart server / multi-device | Cart local đủ cho single-SKU giai |
| Guest vs logged-in bắt buộc login | Có thể prefill nếu đã login sau; v1 cho phép guest checkout |
| Sổ địa chỉ account | Thuộc `/account` — checkout form tự nhập; sau này prefill từ account API |
| Invoice / xuất VAT phức tạp | Chưa có requirement |

---

## 2. Chiến lược “ready to integrate”

### 2.1 Ba lớp cố định — chỉ lớp giữa được thay

```txt
┌─────────────────────────────────────────────────────────┐
│  A. UI + hooks                                          │
│     app/checkout/page.tsx, components/checkout/*,       │
│     lib/useCheckoutSubmit.ts (hoặc tương đương)         │
│     → chỉ biết types + gọi fetch /api/checkout          │
├─────────────────────────────────────────────────────────┤
│  B. Contract (ỔN ĐỊNH — thiết kế kỹ từ đầu)             │
│     Zod schemas + TS types request/response             │
│     features/checkout/schemas/* , types/*               │
├─────────────────────────────────────────────────────────┤
│  C. Adapter / Service (THAY THẾ KHI CÓ BACKEND)         │
│     checkoutService.createOrder(...)                    │
│       v1: mock (sinh orderCode, delay, optional log)    │
│       v2: gọi backend / Prisma / Supabase / payment     │
└─────────────────────────────────────────────────────────┘
```

**Quy tắc vàng:** UI và Zod contract **không** phụ thuộc chi tiết mock. Mock chỉ sống trong `features/checkout/services/` (và có thể `CHECKOUT_MODE=mock|remote` qua env).

### 2.2 Hai mode vận hành (env)

| Mode | Hành vi | Khi nào |
|---|---|---|
| `mock` (default local) | `checkoutService` tạo `orderCode` giả, delay nhẹ, **không** gọi HTTP ngoài | Dev / demo / QA UI |
| `remote` | Service gọi backend thật (URL từ `lib/env.ts`) | Staging / prod khi API sẵn |

Client **không** biết mode — luôn `POST /api/checkout`. Đổi mode không đụng React.

### 2.3 Nguồn sự thật cho tiền / voucher

| Field | Ai tính | Ghi chú |
|---|---|---|
| `quantity` | Cart store (client) → gửi trong request | Clamp theo `MIN/MAX_CART_QUANTITY` |
| `unitPrice`, `subtotal`, `discount*`, `shippingFee`, `total` | **Server (service)** tính lại từ quantity + cùng rule với `cartService.buildSummary` | Request có thể gửi snapshot để hiển thị, nhưng **response/order dùng số server** |
| Voucher tiers | Reuse logic/constants từ `features/cart` (extract shared calc nếu cần) | Tránh hai công thức lệch nhau |

Khi integrate: backend có thể là nguồn sự thật cuối; BFF Next vẫn có thể validate shape rồi forward, hoặc tin response backend và map sang `CreateOrderResponse`.

### 2.4 Contract đề xuất (draft — chốt trước khi code)

**Request `POST /api/checkout`** (ý tưởng field, tên cuối cùng khóa khi implement):

```ts
{
  quantity: number;                 // từ cart
  // optional clientSnapshot?: CartSummary — chỉ để debug/UI, server không tin total

  buyer: {
    fullName: string;
    phone: string;
    email: string;
  };
  address: {
    province: string;               // tạm string; sau có thể code GHN/VN province
    district: string;
    ward: string;
    street: string;                 // số nhà, đường — bổ sung hợp lý cho ship thật
  };
  note?: string;

  shippingMethod: "standard" | "express";
  paymentMethod: "cod" | "bank_transfer" | "ewallet";
}
```

**Response `201`** (shape UI success cần):

```ts
{
  orderId: string;                  // uuid nội bộ
  orderCode: string;                // mã hiển thị KH (VD: NT-20260718-XXXX)
  status: "pending" | "awaiting_payment" | ...;
  estimatedDeliveryLabel: string;   // copy VI cho success page
  summary: {
    quantity: number;
    unitPrice: number;
    subtotal: number;
    discountAmount: number;
    shippingFee: number;
    shippingNote: string;
    total: number;
  };
  buyer: { /* echo đã normalize */ };
  address: { /* echo */ };
  shippingMethod: "...";
  paymentMethod: "...";
  paymentInstructions?: {           // chỉ khi CK / ví — mock copy tĩnh
    title: string;
    lines: string[];
  };
}
```

Mọi response bọc `ApiResponse<T>` như contact (`successResponse`).

### 2.5 Luồng sau submit (mock = production path)

```txt
[Checkout form]
  disable double-submit (isSubmitting + optional overlay — loading guide §5)
  POST /api/checkout
       ↓
  Zod parse → checkoutService.createOrder
       ↓ mock: generate codes, recalc summary, return 201
       ↓
  Client: clear / giảm cart (quantity → 0)  ← quyết định mục 5
  navigate → /checkout/success?orderCode=...  hoặc success dùng sessionStorage snapshot
```

**Success page data:** ưu tiên mang theo `orderCode` trên URL + **snapshot tạm** (`sessionStorage` key cố định) từ response — vì mock chưa có `GET /api/orders/:id`. Khi có API: success đọc lại bằng SWR `GET /api/orders/:orderCode` và bỏ snapshot.

---

## 3. Cấu trúc file đề xuất

```txt
app/
  (marketing)/                    # hoặc group phù hợp layout hiện tại
    checkout/
      page.tsx                    # compose; guard empty cart → redirect/toast về home + mở cart
      success/
        page.tsx                  # cảm ơn + mã đơn + CTA
  api/
    checkout/
      route.ts                    # POST mỏng: parse → service → successResponse(201)
      # (sau) route có thể tách /api/orders nếu backend đặt tên khác — map trong service

features/
  checkout/
    constants.ts                  # shipping options, payment options, copy CK/ví, latency mock
    schemas/
      checkout.schema.ts          # createOrderRequestSchema (+ infer types)
    types/
      index.ts                    # CreateOrderResult, ShippingMethod, PaymentMethod...
    services/
      checkout.service.ts         # server-only; createOrder; mock | remote branch
      # (optional) checkout.mapper.ts — map remote DTO → CreateOrderResult

components/
  checkout/
    CheckoutForm.tsx              # RHF fields
    CheckoutOrderSummary.tsx      # đọc useCartStore().summary + shipping fee preview
    CheckoutShippingMethod.tsx
    CheckoutPaymentMethod.tsx
    CheckoutSuccessView.tsx

lib/
  useCheckoutSubmit.ts            # optional: bọc fetch + lỗi FetchError → toast/field
```

Reuse từ cart (không copy-paste logic tính tiền vào component):

- `useCartStore` / `CartSummary` / `CartLineItem` (read-only trên checkout nếu phù hợp)
- `cartService.buildSummary` — gọi lại từ `checkoutService` (hoặc extract `pricing` helper dùng chung cart+checkout; **không** để hai feature import chéo service lẫn nhau nếu guide cấm — khi đó đưa pure calc vào `features/cart/services/pricing.ts` hoặc `lib/` chỉ nếu thật sự infra; ưu tiên **shared pure module trong cart** được checkout import types+calc, hoặc duplicate mỏng có test).

> Ghi chú kiến trúc: `docs/source-code-architecture-guide.md` nói không import chéo **service** giữa feature. Pure function tính giá nên tách thành module dùng chung (ví dụ `features/cart/pricing.ts` không phải “service I/O”) để checkout import an toàn.

---

## 4. UI / UX (v1) — map Joy Rush pattern → logic Nutein §3.4

### 4.0 Joy Rush quan sát được (2 cases) — chỉ để nhớ pattern

| Case JR | Pattern UI lấy được | **Không** mang sang Nutein |
|---|---|---|
| **Chưa login (guest)** | Header tối giản (logo + icon giỏ); cột trái form theo section; **Contact** có link **Sign in** cạnh heading; cột phải summary nền khác nhẹ; line item + qty badge; breakdown Subtotal / discount / Shipping / Total | Credit card nested fields; Country=US / State / ZIP; address autocomplete kiểu Shopify; CTA “Pay now”; discount-code input + Apply nếu đã có voucher mốc từ cart |
| **Đã login** | Bỏ / thu gọn khối Contact (email đã biết); Delivery + Shipping + Payment giữ cùng nhịp; summary giống guest | “Underwriter Review - No Payment”; card form; billing-address checkbox kiểu thẻ quốc tế |

Nguồn sự thật field vẫn là **§3.4**, không phải field list Joy Rush.

### 4.1 Map field: PROJECT_REQUIREMENTS §3.4 vs Joy Rush

| §3.4 Nutein (bắt buộc) | Joy Rush (tham khảo) | Cách làm Nutein |
|---|---|---|
| Họ tên | First / Last name | **1 field họ tên** (hoặc họ + tên nếu muốn gần JR — ưu tiên 1 field VI đơn giản trừ khi chốt 2 field) |
| SĐT | (không nổi trong Contact JR) | **Bắt buộc** — section Contact hoặc Delivery; e-com VN cần phone |
| Email | Contact email (+ Sign in) | Guest: email + link **Đăng nhập** → mở `AuthModal`; Logged-in: ẩn / readonly email đã có |
| Địa chỉ Tỉnh / Quận / Phường | City / State / ZIP + Country | **Tỉnh · Quận · Phường** (+ số nhà/đường); không copy US ZIP |
| Ghi chú đơn hàng | (không thấy rõ) | Textarea optional cuối Delivery hoặc trước CTA |
| PT giao: Tiêu chuẩn / Nhanh | Shipping method (gated đến khi có address) | Radio 2 option; có thể **enable sau khi đủ địa chỉ** (pattern JR) hoặc luôn hiện với phí ước tính — mặc định: hiện 2 option, phí cập nhật theo method |
| PT thanh toán: COD · CK · Ví | Credit card (+ option khác) | **Radio 3 method Nutein**; expand panel hướng dẫn theo method (không form số thẻ) |
| Xác nhận đơn (sp, qty, giá, ship, voucher, tổng) | Right column summary | Cột phải: 1 line Nutein + qty badge; subtotal; dòng giảm (từ voucher cart); ship; **tổng**; CTA |
| CTA **Đặt hàng ngay** | Pay now | Copy đúng §3.4 — không dùng “Thanh toán ngay” nếu COD là default path |

### 4.2 Hai trạng thái auth (Nutein)

Auth hiện tại: `AuthModal` (SWR key `auth-modal`) — **chưa có session user thật ổn định trên checkout**. Plan UI vẫn tách 2 case để sẵn sàng:

| | **Guest (chưa login)** | **Logged-in** |
|---|---|---|
| Contact | Heading “Liên hệ” / “Thông tin liên hệ” + link **Đăng nhập** (mở AuthModal) | Không hiện Sign in; email (± SĐT, họ tên) **prefill** khi có user API |
| Delivery | Full form địa chỉ VI + optional “Lưu cho lần sau” (chỉ meaningful khi đã login hoặc local draft) | Prefill địa chỉ mặc định nếu sau này có sổ địa chỉ `/account` |
| Shipping / Payment / Note | Giống nhau | Giống nhau |
| Summary | Giống nhau | Giống nhau |
| Submit | Guest checkout OK (§3.4 không bắt buộc login) | Cùng `POST /api/checkout`; có thể gửi `userId` khi remote |

v1 khi **chưa có auth session thật:** implement UI guest đầy đủ + chỗ gắn Sign in; branch logged-in = prefill stub / feature-detect sau — không block Phase B.

### 4.3 Layout desktop (theo nhịp JR, nội dung §3.4)

```txt
┌─ Header checkout tối giản: Logo Nutein · icon giỏ (mở CartDrawer) ─┐
│                                                                    │
│  ┌─ Form (trái, bg cream) ──────────┐  ┌─ Summary (phải, surface) ┐│
│  │ CONTACT                          │  │ [ảnh] Nutein   qty badge ││
│  │  Email (+ Đăng nhập nếu guest)   │  │                          ││
│  │  SĐT · Họ tên   ← §3.4 buyer     │  │ (voucher đã áp từ cart — ││
│  │                                  │  │  không bắt buộc ô mã %)  ││
│  │ DELIVERY                         │  │ Subtotal                 ││
│  │  Tỉnh · Quận · Phường · Đường    │  │ Giảm giá / voucher       ││
│  │  Ghi chú (optional)              │  │ Phí ship                 ││
│  │  ☐ Lưu thông tin (optional)      │  │ Tổng                     ││
│  │                                  │  │                          ││
│  │ SHIPPING METHOD                  │  │ (CTA có thể sticky dưới  ││
│  │  ○ Tiêu chuẩn  ○ Nhanh           │  │  form trên mobile)        ││
│  │  hoặc placeholder đến khi đủ địa │  │                          ││
│  │  chỉ (pattern JR)                │  │                          ││
│  │                                  │  │                          ││
│  │ PAYMENT                          │  │                          ││
│  │  ○ COD  ○ Chuyển khoản  ○ Ví     │  │                          ││
│  │  + panel hướng dẫn theo method   │  │                          ││
│  │                                  │  │                          ││
│  │ [ Đặt hàng ngay ]                │  │                          ││
│  │ links policy (Footer policies)   │  │                          ││
│  └──────────────────────────────────┘  └──────────────────────────┘│
└────────────────────────────────────────────────────────────────────┘
```

Mobile: stack — summary (collapsible) trên hoặc dưới; form full width; CTA full-width primary.

### 4.4 Empty cart guard

- Vào `/checkout` mà `quantity === 0` → redirect `/` (hoặc mở cart drawer) + toast ngắn.
- Không render form trống.

### 4.5 Payment UI khi chưa có gateway (khác JR credit card)

| Method (§3.4) | UI v1 |
|---|---|
| COD | Radio + mô tả ngắn — default hợp lý cho VN |
| Chuyển khoản | Radio + block `paymentInstructions` (STK/nội dung CK **placeholder**; môi trường mock ghi rõ demo) |
| Ví điện tử | Radio + copy hướng dẫn / QR placeholder rõ là mock |

Không render form số thẻ / CVV / expiration như Joy Rush. Không giả redirect gateway thành công — mock tạo đơn `pending` / `awaiting_payment` → `/checkout/success` + hướng dẫn.

### 4.6 Voucher / discount trên summary

- Joy Rush: ô **Discount code** + Apply.
- Nutein cart đã có **voucher theo mốc tổng** (`CartSummary` / progress). v1 checkout summary **hiển thị dòng giảm đã tính từ cart**, không bắt buộc thêm ô nhập mã trừ khi product/marketing yêu cầu mã riêng sau này.
- Shipping line: hiện phí theo method đã chọn; freeship từ voucher → `0` + note “Miễn phí vận chuyển”.

### 4.7 Loading / lỗi

- Submit: `isSubmitting` trên nút + (tuỳ chọn) blocking overlay theo `loading-agent-guide.md`.
- Lỗi Zod field-level; lỗi server → toast / banner (`FetchError`).
- Rate-limit trên `POST /api/checkout` khi implement.

### 4.8 Style

`docs/frontend-style-system-guide.md` — cream / ink / primary; input bo nhẹ (`radius-md`/`lg`); accent primary cho focus/selected radio và CTA; **không** copy cam Shopify của JR thành token mới. Header checkout có thể tối giản hơn marketing layout (logo + cart) — vẫn dùng font/token Nutein.

---

## 5. Quyết định cần chốt trước / trong lúc code (checklist bàn luận)

Các mục dưới đây nên trả lời ngắn trong PR đầu hoặc comment trong plan khi kickoff:

| # | Câu hỏi | Gợi ý mặc định |
|---|---|---|
| 1 | Sau đặt hàng, cart clear hết hay giữ? | **Clear** (`quantity = 0`) để khớp “đã chuyển thành đơn” |
| 2 | Success lấy data thế nào khi chưa có GET order? | `orderCode` query + `sessionStorage` snapshot từ response |
| 3 | Phí ship Tiêu chuẩn / Nhanh — số nào? | Constants tạm (VD: 25k / 45k); freeship voucher → 0; ghi chú “ước tính” |
| 4 | Địa chỉ: combobox tỉnh thành thật hay input text? | **A — 2 cấp** Tỉnh → Phường/Xã (`vietnam-divisions-js` v3, NQ 202/2025); bỏ Quận |
| 5 | Bắt buộc đăng nhập? | **Không** (guest OK). Guest: link Đăng nhập → AuthModal. Logged-in: prefill khi có user/session |
| 6 | Shipping method gated đến khi đủ địa chỉ (như JR)? | **Ưu tiên có** placeholder “Nhập địa chỉ để xem phí giao hàng” hoặc disable radio đến khi đủ Tỉnh/Quận/Phường |
| 7 | Ô nhập discount code trên summary? | **Không v1** — dùng voucher mốc từ cart; tránh lệch 2 hệ mã |
| 8 | Idempotency key? | Header/`Idempotency-Key` optional — mock ignore, remote dùng |
| 9 | Tên route API: `/api/checkout` vs `/api/orders`? | **`/api/checkout`** submit; remote map sang `POST /orders` nếu cần |
| 10 | Trang `/cart` full-page? | Ngoài scope; drawer → `/checkout` |

---

## 6. Phases triển khai (khi bắt đầu code)

### Phase A — Contract + mock API (nền)

- [x] `features/checkout/schemas` + `types` + `constants` (shipping/payment/copy)
- [x] `checkout.service.ts` mock (`server-only`): recalc summary, sinh `orderCode`, trả `CreateOrderResult`
- [x] `app/api/checkout/route.ts` + `withErrorHandler` (+ rate-limit khi Redis sẵn)
- [ ] Unit test schema + pricing edge (quantity min/max, freeship)

### Phase B — UI checkout

- [x] `app/checkout/page.tsx` + components form/summary (layout 2 cột kiểu JR)
- [x] Guest: Contact + link Đăng nhập → AuthModal; Logged-in shell: prefill / ẩn Sign in *(prefill chờ auth session)*
- [x] Field đúng §3.4 (SĐT, Tỉnh/Quận/Phường, ghi chú; payment COD/CK/ví — không card form)
- [x] Guard empty cart
- [x] Wire CartDrawer CTA → `/checkout` (bỏ toast tạm)
- [x] Submit → clear cart → success

### Phase C — Success

- [x] `app/checkout/success/page.tsx` + đọc snapshot / orderCode
- [x] CTA phụ (home / blog / product) đúng §3.10
- [x] Empty/invalid success (không có snapshot) → soft fallback về home

### Phase D — Integrate backend (khi API sẵn)

- [ ] Thêm env: `CHECKOUT_BACKEND_URL` / secrets vào `lib/env.ts`
- [ ] Branch `remote` trong `checkout.service` (hoặc `checkout.repository`)
- [ ] Mapper DTO backend → `CreateOrderResult` (UI **không** đổi)
- [ ] Thay success đọc `GET /api/orders/:code` (SWR) nếu backend có
- [ ] Payment: nếu backend trả `paymentUrl` → redirect; giữ COD path như cũ
- [ ] Tắt hoặc giới hạn mock trên prod

---

## 7. Tiêu chí “xong mock nhưng ready integrate”

Plan coi Phase A–C **done** khi:

1. User đi hết: thêm giỏ → mở cart → `/checkout` → submit → `/checkout/success` thấy mã đơn.
2. Mọi tiền trên success đến từ **response API**, không tự cộng trong component.
3. Đổi mock → remote **chỉ** sửa service/env (+ mapper), không sửa schema field đang dùng bởi UI (trừ khi backend force versioning — khi đó version schema rõ ràng).
4. Không hardcode hex/spacing ngoài token; không multi-SKU list.
5. Không commit secret / STK thật nếu chưa chốt — dùng placeholder rõ “demo”.

---

## 8. Rủi ro & cách giảm

| Rủi ro | Giảm |
|---|---|
| UI gắn chặt field mock (`orderCode` format…) | Document contract; mapper ở service |
| Hai nơi tính voucher lệch | Một pure pricing module dùng chung cart + checkout service |
| User hiểu nhầm đã thanh toán thật | Copy UI: “đơn demo” / “chưa trừ tiền” chỉ trên môi trường mock; prod remote thì bỏ badge |
| Double submit tạo 2 đơn | `isSubmitting` + overlay; sau này Idempotency-Key |
| Success refresh mất data | snapshot sessionStorage + orderCode trên URL; sau có GET thì bền hơn |

---

## 9. Việc **không** làm trong lần plan này

- Không tạo file/route/component checkout.
- Không đổi CartDrawer CTA (giữ toast cho đến Phase B).
- Không thiết kế payment gateway / webhook.
- Không mở rộng About / product landing trong scope này.

---

## 10. Tóm tắt khuyến nghị (1 đoạn)

**Làm checkout như contact + một lớp contract chặt:** UI và Zod ổn định; `POST /api/checkout` luôn là cổng duy nhất; `checkoutService` mock hôm nay, remote ngày mai. Cart tiếp tục local; tiền/voucher tính lại ở service khi tạo đơn; success dùng response (+ snapshot tạm). Khi backend tới, integrate ở Phase D — không rewrite form.
