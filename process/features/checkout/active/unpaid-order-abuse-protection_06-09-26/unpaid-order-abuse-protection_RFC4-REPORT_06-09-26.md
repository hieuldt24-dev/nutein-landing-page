---
name: report:unpaid-order-abuse-protection-rfc4
description: "RFC-4 execute report — UI khách/staff cho cap, deadline server-time, claim/cancel, hàng đợi đối soát và version conflict"
date: 06-09-26
metadata:
  node_type: memory
  type: report
  feature: checkout
  phase: RFC-4
---

# RFC-4 — Customer/staff UX (EXECUTE report)

**Date**: 06-09-26
**Phase state**: PLANNED → **CODE DONE → TESTING**. KHÔNG phải VERIFIED.
**Plan**: `unpaid-order-abuse-protection_PLAN_06-09-26.md`

## TL;DR

UI đã nối vào các route RFC-3. Khách bị chặn vì cap thì **giữ nguyên giỏ** và được dẫn tới đúng
những đơn cũ của chính mình (không có nút "thử lại"); 429/503/mất mạng thì giữ giỏ **và giữ nguyên
idempotency key** nên bấm lại là replay, không tạo đơn thứ hai. Màn success và trang chi tiết đơn
đọc trạng thái thật từ `GET /api/account/orders/[id]` (`no-store`) thay vì tin snapshot
sessionStorage. Hạn chuyển khoản **chỉ** lấy từ `payment_expires_at` của server; quá hạn thì **ẩn
QR** và hiện trạng thái đối soát — client không tự hủy hay tự đổi trạng thái đơn nào (E5). Staff có
hàng đợi theo quá-hạn/đã-khai, form kết luận đối soát thu đúng evidence mà Zod schema RFC-3 yêu cầu,
và mọi mutation gửi `expectedVersion` → 409 thì tải lại thay vì ghi đè.

**Chưa VERIFIED.** Gate của RFC-4 là human authenticated walkthrough. Phiên này **không render bất
kỳ màn hình nào trong browser thật** — không mở dev server, không chụp màn hình, không đối chiếu UI
với database. Bằng chứng duy nhất là component test với API/client đã mock.

## 1. Đã implement

| File | Thay đổi |
|---|---|
| `features/checkout/checkout-error.ts` (mới) | Phân loại lỗi submit thành `cap` / `retryable` / `other`. Mất mạng (không có `status`) được xếp `retryable` — đúng trường hợp idempotency tồn tại để xử lý. Không bịa `Retry-After` khi server không nói. |
| `components/checkout/CheckoutSubmitBlock.tsx` | Nhận `blocked`; hai notice tách bạch: cap (liệt kê đơn cũ, **không** mời retry) và retryable (mời thử lại + nói rõ không tạo đơn trùng). |
| `components/checkout/CheckoutForm.tsx` | Bắt lỗi submit → phân loại → set `blocked`. Nhánh lỗi KHÔNG đụng giỏ (`removeFromCart()` vẫn chỉ chạy sau khi đã có đơn thật) và KHÔNG sinh key mới. Nhánh cap đọc danh sách đơn chưa thanh toán qua `GET /api/account/orders` (đã auth-scoped). |
| `features/account/payment-review.ts` (mới) | Toàn bộ quyết định hiển thị vòng đời chuyển khoản, hàm thuần, `now` là tham số tường minh. Không hàm nào tính hạn từ đồng hồ trình duyệt. |
| `features/account/services/account-order.client.ts` (mới) | Client wrapper: `getOrderDetail` (`cache: "no-store"`), `claimPayment`, `requestCancel`. Không chứa logic trạng thái. |
| `components/account/AccountOrderDetail.tsx` (mới) | Trang chi tiết đơn của khách: trạng thái + hạn + QR + hai hành động, gated theo `allowedActions` của server. SWR với `dedupingInterval: 0` để lần đọc lại sau thao tác là đọc thật. |
| `app/(account)/account/orders/[id]/page.tsx` (mới) | Route chi tiết trong route group `(account)`, theo đúng pattern `AccountShell` của các trang account hiện có. |
| `components/account/AccountOrderList.tsx` | Thêm link tới trang chi tiết ("Xem & thanh toán" khi chưa trả tiền). |
| `components/checkout/CheckoutSuccessView.tsx` | Nhận `serverState`; hạn/QR/trạng thái lấy từ server, snapshot chỉ còn dùng cho phần tĩnh. `replayed: true` → "đơn đã được tạo trước đó", không ăn mừng lần hai. Thêm CTA "Quản lý đơn này". |
| `app/checkout/success/page.tsx` | Fetch `GET /api/account/orders/[id]` sau khi đọc snapshot; fetch hỏng KHÔNG chặn màn xác nhận (đơn đã tồn tại rồi). |
| `features/admin-orders/review-queue.ts` (mới) | Phân nhóm `overdue` / `claimed` / `review` / `none` + sort ưu tiên + filter. Hàm thuần, `now` tường minh. |
| `components/admin/orders/AdminOrdersList.tsx` | Chip "Cần đối soát", sort ưu tiên đối soát, badge nhóm trên từng dòng. |
| `components/admin/orders/AdminPaymentReviewPanel.tsx` (mới) | Form kết luận đối soát: `outcome` + `reason` (bắt buộc) + cửa sổ sao kê + tham chiếu nội bộ + `expectedVersion`. Không upload file, không nhánh nào đặt PAID. |
| `components/admin/orders/AdminOrderDetail.tsx` | Gắn panel đối soát; confirm-payment và resolve-review đều gửi `expectedVersion`; 409 `ORDER_STATE_CONFLICT` → "đơn đã thay đổi, tải lại" + `mutate()`. Hiện `payment_review_state` thô ở identity band. |
| `features/admin-orders/types/index.ts` | Thêm 4 field OPTIONAL (`paymentReviewState`/`paymentExpiresAt`/`reviewDueAt`/`stateVersion`) + `ResolvePaymentReviewResult`. |
| `features/admin-orders/services/admin-orders.repository.ts` | `ORDER_SELECT_WITH_PROTECTION` + đường lui 42703 cho cả `list()` và `getById()`; `confirmPayment()` nhận `expectedVersion` tùy chọn. |
| `features/admin-orders/services/admin-orders.service.ts` | `confirmPayment(id, expectedVersion?)`, `resolvePaymentReview(...)`. |
| `features/admin-orders/schemas/admin-orders.schema.ts` | `confirmPaymentSchema` (strict, chỉ `expectedVersion` tùy chọn). |
| `app/api/staff/orders/[id]/confirm-payment/route.ts` | Đọc body TÙY CHỌN qua `readOptionalJsonBody` + schema strict; POST rỗng của client cũ vẫn 200. |

### E2 — enforcement vẫn TẮT, và UI chạy đúng ở CẢ HAI phía

RFC-4 không đụng `CHECKOUT_PROTECTION_ENFORCED`, không đụng `codActiveCap`, không sửa guard nào.
UI được viết để đúng ở cả hai trạng thái: `paymentExpiresAt = null` (enforcement tắt / đơn legacy /
COD) thì **không vẽ hạn nào cả** thay vì bịa ra một đồng hồ đếm ngược; `stateVersion` vắng mặt
(migration chưa apply) thì panel đối soát báo "chưa khả dụng" thay vì để nhân viên bấm rồi nhận lỗi.

## 2. Lệnh đã chạy và kết quả THẬT

```
$ npm test                     # vitest run --project unit
 Test Files  1 failed | 79 passed (80)
      Tests  610 passed (610)
```
Baseline giữ nguyên: ĐÚNG một suite đỏ và vẫn là suite cũ `lib/useAddresses.test.tsx`
(`@supabase/ssr: Your project's URL and API key are required`), 0 test fail.
RFC-3 kết thúc ở 548 test → **+62 test mới, 0 regression**.

```
$ npx tsc --noEmit
.next/dev/types/validator.ts(244,8): error TS1005: ';' expected.
.next/dev/types/validator.ts(245,1): error TS1128: Declaration or statement expected.
```
Đúng 2 lỗi baseline, đều trong file generated. Không lỗi mới.

```
$ npx eslint <toàn bộ file RFC-4 chạm vào> --max-warnings=0
EXIT=0
```
Lưu ý cách đọc con số này: `npx eslint` trên các thư mục rộng hơn vẫn đỏ vì **nợ có sẵn** —
`react-hooks` báo "setState synchronously within an effect" ở `AccountProfileForm.tsx`,
`AccountAddressForm.tsx`, `CheckoutDeliverySection.tsx`, `CheckoutForm.tsx` và
`app/checkout/success/page.tsx` **từ trước RFC-4** (đã xác minh bằng `git stash` rồi chạy lại eslint
trên HEAD sạch). Component mới `AccountOrderDetail.tsx` ban đầu cũng dính lỗi này; đã sửa bằng cách
chuyển sang `useSWR` — đúng convention của `AccountOrderList.tsx` — nên RFC-4 **không thêm** một
instance nợ nào.

`npm run check` vẫn KHÔNG dùng được làm gate (dừng ở `format:check` vì nợ prettier toàn repo,
RFC-1 F5). Đã chạy `prettier --write` trên đúng các file RFC-4 chạm vào.

**KHÔNG chạy**: dev server, browser, migration, staging/production, email thật.

## 3. Bằng chứng cho từng AC

| AC | Bằng chứng |
|---|---|
| AC10 (giỏ + key + trạng thái thật) | **Cap**: `CheckoutSubmitBlock.test.tsx` — 409 cap render đúng link `/account/orders/{id}` cho từng đơn cũ, hiện "giỏ hàng vẫn được giữ nguyên", và khẳng định **không có** chữ "thử lại" (nhánh cap không mời retry); không lấy được danh sách thì vẫn còn lối đi `/account/orders`. **Key**: `useCheckoutSubmit.test.ts` — sau timeout/429/503 `resolveIdempotencyKey` trả **cùng** key; reload cùng payload cũng cùng key; payload đổi thật mới đổi key. **Trạng thái thật**: `CheckoutSuccessView.test.tsx` — server nói quá hạn/đã thanh toán thì ẩn QR **dù snapshot vẫn còn `qrImageUrl`**; QR hiển thị là QR của server chứ không phải của snapshot; `serverState = null` (fetch hỏng) thì vẫn dùng snapshot, không chặn màn xác nhận. |
| AC06 (claim là lời khai, không tăng hạn, không trả slot) | `payment-review.test.ts` — `PAYMENT_CLAIMED` render "CHƯA phải xác nhận thanh toán" + nhắc sao kê; `CANCEL_REQUESTED` render "chưa được hủy ngay". `AccountOrderDetail.test.tsx` — sau claim, `getOrderDetail` được gọi lại và nút claim **biến mất** (không claim lần hai được); `claimPayment` gửi đúng `expectedVersion` của đơn đang hiển thị. `AdminPaymentReviewPanel.test.tsx` — panel **không có** nhánh nào đặt PAID, **không có** `input[type=file]`, và copy nói rõ lời khai của khách không phải chứng cứ. UI không có đường nào gia hạn deadline hay trả slot: hai thứ đó không tồn tại trong bất kỳ payload nào client gửi. |
| AC09 (không bypass guard paid; conflict không ghi đè) | `AccountOrderDetail.test.tsx` — 409 `ORDER_STATE_CONFLICT` → đọc lại và render trạng thái THẬT (đơn đã PAID, hết hành động, hết QR), **không** ghi đè bằng kết quả lạc quan. `admin-orders.repository.test.ts` — `confirmPayment` với `expectedVersion` lệch → 409 và **`transition` KHÔNG được gọi** (không có UPDATE nào chạy). `confirm-payment/route.test.ts` — body strict: field lạ (`{paymentStatus:"PAID"}`) → 400, repository không được gọi. RFC-4 **không thêm** transition fulfilment nào — vẫn dùng nguyên `ADMIN_ORDER_STATUS_TRANSITIONS` và guard RFC-3. |
| Tương thích trước cutover (E3) | `admin-orders.repository.test.ts` — `getById()`/`list()` gặp 42703 thì đọc lại bằng `ORDER_SELECT` cũ và **không** ném lỗi; lỗi DB khác 42703 vẫn ném (không nuốt lỗi thật). `AdminPaymentReviewPanel.test.tsx` — thiếu `stateVersion` → báo "chưa khả dụng", không dựng form. `CheckoutSuccessView.test.tsx` — thiếu field `replayed` (contract server cũ) vẫn coi là đơn mới, không vỡ. `payment-review.test.ts` — `paymentExpiresAt = null` không bao giờ bị coi là quá hạn. |

### Chống test xanh rỗng (red-before đã chạy thật)

Hai lần phá code có chủ đích, chạy lại, rồi khôi phục:

1. Bỏ kiểm hạn trong `shouldShowPaymentQr` (`return true`) →
   `× ẩn QR sau khi quá hạn dù server vẫn còn trả qrImageUrl` — 1 test đỏ.
   Nhưng hai test component vẫn xanh → chứng tỏ chúng đi qua nhánh khác. Nên:
2. Vô hiệu nhánh `deadlinePassed` của `describePaymentReview` →
   `× server nói đã quá hạn -> ẨN QR dù snapshot vẫn còn qrImageUrl` và
   `× quá hạn: ẨN QR, hiện trạng thái đối soát, KHÔNG nói đơn đã bị hủy` — 2 test component đỏ.

Sau khôi phục: `tsc` trở lại đúng 2 lỗi baseline, toàn bộ test xanh. Nghĩa là cả tầng hàm thuần lẫn
tầng component đều thật sự khẳng định bất biến "quá hạn thì ẩn QR", không phải xanh rỗng.

Ngoài ra các test đều khẳng định **side effect KHÔNG xảy ra** (`transition` không được gọi,
`confirmPayment` không được gọi, nút biến mất) chứ không chỉ khẳng định có chữ trên màn hình.

## 4. Deviation so với plan

| # | Deviation | Lý do |
|---|---|---|
| D1 | 409 cap **không** trả danh sách đơn trong response; UI đọc lại từ `GET /api/account/orders` rồi lọc đơn chưa thanh toán. | Plan §Public Contracts nói 409 cap "trả count, limit và link/ID". Nhưng `ApiResponse` (`src/api/response.ts`) chỉ có `{message, code}` — không có chỗ cho `details`. Thêm `details` là sửa contract lỗi dùng chung cho TOÀN BỘ API, vượt phạm vi RFC-4 và động vào bề mặt RFC-3 vừa được EVL xác nhận. Endpoint list đã auth-scoped sẵn nên không có rủi ro lộ đơn người khác. Chi phí: thêm một round-trip **chỉ khi** khách bị chặn. |
| D2 | Thêm 4 field OPTIONAL vào `AdminOrder` + `ORDER_SELECT_WITH_PROTECTION` có đường lui 42703. | Không có dữ liệu này thì không làm được hàng đợi đối soát và không gửi được `expectedVersion` — đây là DTO gap thật mà UI cần. Additive: field optional, đường lui giữ nguyên hành vi cũ khi migration chưa apply. Không guard nào bị nới. |
| D3 | `confirm-payment` route nhận body tùy chọn (`expectedVersion`). | Yêu cầu RFC-4 là gửi version của đơn ĐANG hiển thị. Trước đó repository tự đọc version ngay trước khi ghi — đúng về atomicity nhưng KHÔNG phát hiện được "màn hình đã cũ". Additive: POST rỗng vẫn 200 (có test), schema `.strict()` chặn field lạ. Guard cũ giữ nguyên; guard version mới chỉ THÊM một lý do từ chối. |
| D4 | Form đối soát tách thành `AdminPaymentReviewPanel.tsx` thay vì nhét vào `AdminOrderDetail.tsx`. | `AdminOrderDetail.tsx` đã ~400 dòng và kéo theo SWR + service + toast, gần như không test được ở mức component. Tách ra cho phép test thật phần quan trọng nhất (evidence + `expectedVersion` + không-có-nhánh-PAID). |
| D5 | Logic hiển thị tách thành hàm thuần (`payment-review.ts`, `review-queue.ts`, `checkout-error.ts`) với `now` là tham số. | Bất biến "hạn đến từ server, không từ đồng hồ trình duyệt" phải test được một cách xác định. Truyền `now` tường minh làm test không phụ thuộc đồng hồ máy chạy test — và làm rõ rằng `now` chỉ dùng để SO SÁNH, không bao giờ để TÍNH ra hạn. |
| D6 | `AccountOrderDetail` dùng `useSWR` thay vì `useState` + `useEffect`. | Bản đầu bị lint `react-hooks` báo "setState synchronously within an effect" — cùng lỗi đang tồn tại ở 4 file account/checkout khác. Chuyển sang SWR theo đúng convention `AccountOrderList.tsx` vừa hết lỗi vừa bớt state thủ công. `dedupingInterval: 0` là bắt buộc: lần đọc lại sau thao tác/409 phải là đọc thật. |

## 5. Test infra gaps found

- **Không có test nào chạy trên browser thật.** Mọi khẳng định UI ở đây là jsdom + client đã mock.
  Không chứng minh được: layout mobile thật, `next/link` navigation, hành vi tab thứ hai, back
  button, bfcache, hay việc `cache: "no-store"` có thực sự tới được mạng qua đường Next.js thật.
- **`serverState` được truyền thẳng vào component trong test**, không đi qua `useEffect` fetch của
  `app/checkout/success/page.tsx`. Nghĩa là logic "server thắng snapshot" đã được chứng minh, nhưng
  **việc trang success gọi đúng endpoint và xử lý fetch hỏng thì chưa** — trang đó không có test.
- **Không có test cho `AdminOrdersList` và `AdminOrderDetail` ở mức component.** Hai file này kéo
  theo SWR + service + toast + `next/link`; phần logic quan trọng đã được tách ra
  (`review-queue.ts`, `AdminPaymentReviewPanel.tsx`) và có test, nhưng phần lắp ráp thì chưa.
- **`CheckoutForm` không có test.** Nhánh "cap → đọc lại danh sách đơn → set blocked" chỉ được
  chứng minh gián tiếp qua `checkout-error.test.ts` (phân loại) và `CheckoutSubmitBlock.test.tsx`
  (hiển thị). Việc `removeFromCart()` không chạy ở nhánh lỗi được bảo đảm bằng vị trí code (nó nằm
  sau `await submitOrder(...)` trong khối `try`), **không** bằng test.
- **Nợ lint có sẵn vẫn còn**: `react-hooks` "setState synchronously within an effect" ở 5 file
  account/checkout; `npx eslint src` vẫn đỏ 44 lỗi trong `src/components/charts/**`. RFC-4 không
  thêm và cũng không trả nợ nào.

## 6. Còn lại trước khi RFC-4 được coi là VERIFIED

1. **Human authenticated walkthrough** (gate chính, chưa làm): desktop + mobile, đăng nhập thật,
   đi qua reload / tab thứ hai / quá hạn / đã claim / đã thanh toán, **đối chiếu UI với query
   database sau từng thao tác**, chụp màn hình, và ghi tên người xác nhận. Không agent nào làm được:
   auth là Google-OAuth-only, không có dev-login bypass, và RFC-4 **không** thêm bypass nào.
   Tiền lệ đã có: lần walkthrough thủ công của `vietqr-self-hosted-payment` tìm ra một gap thật mà
   test tự động bỏ sót (xem `process/context/tests/all-tests.md` §Known Gaps).
2. Owner apply migration RFC-2 — tới lúc đó `payment_expires_at` / `payment_review_state` /
   `state_version` không tồn tại, nên UI luôn chạy nhánh "không có hạn / đối soát chưa khả dụng".
   **Toàn bộ phần deadline và hàng đợi đối soát chưa từng chạy với dữ liệu thật.**
3. Bốn điều kiện còn lại của RFC-3 (ACL probe, Redis production, ingress IP probe, cửa sổ
   `Idempotency-Key`) vẫn nguyên — RFC-4 không giải quyết mục nào trong đó.

Không mục nào trong ba mục trên thuộc phạm vi EXECUTE của RFC-4.

## 7. Ranh giới RFC-5 KHÔNG bị vượt qua

Không đụng: migration/cutover/backfill/benchmark/runbook/rollback, `supabase/migrations/**`,
`process/context/**` (đó là việc của UPDATE PROCESS), `.env`/`.env.example`, cấu hình deploy.
Không chạy migration, không chạm staging/production, không gửi email.
Không tự chốt ngưỡng AC14 nào — `codActiveCap` vẫn `null`.
Không thêm client-side auto-expire/auto-cancel: quá hạn chỉ ẨN QR, trạng thái chỉ đổi ở server (E5).

Server code RFC-2/3 chỉ bị sửa ở đúng ba chỗ additive (D2, D3) để lấp DTO gap mà UI cần; không guard
nào bị nới, và mỗi thay đổi đều có test kèm.
