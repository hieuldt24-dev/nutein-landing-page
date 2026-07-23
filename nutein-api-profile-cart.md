# Nutein — API hồ sơ & giỏ hàng

Tài liệu tham chiếu nhanh cho 2 route **chưa nằm** trong bảng storefront API gốc của `PROJECT_REQUIREMENTS.md` (làm thêm khi sync account/cart với DB).

Cả hai yêu cầu **JWT app** (cookie httpOnly `nutein_access_token`), cấp bởi `POST /api/auth/session` sau khi đăng nhập Supabase. Wrapper response chuẩn:

```ts
{ success: boolean; data: T | null; error: { message: string; code: string } | null }
```

---

## 1. `/api/account/profile`

### Mục đích

Đọc / cập nhật hồ sơ user đang đăng nhập (`email`, `fullName`, `phone`) trên `public.users`.  
**Không** gồm sổ địa chỉ (địa chỉ dùng `/api/account/addresses`).

### UI gọi

| Chỗ | Hành vi |
| :--- | :--- |
| `AccountProfileForm` (`/account`) | GET load form, PATCH lưu |
| `CheckoutForm` | Prefill liên hệ; có thể PATCH khi cần cập nhật hồ sơ |
| Hook | `lib/useAccountProfile.ts` (SWR + `apiRequest`) |

Guest: không gọi API (SWR key = `null`).

---

### `GET /api/account/profile`

| | |
| :--- | :--- |
| Auth | Cookie access token |
| Body | Không |

**Response `200`**

```json
{
  "success": true,
  "data": {
    "email": "user@example.com",
    "fullName": "Nguyễn Văn A",
    "phone": "0912345678"
  },
  "error": null
}
```

`fullName` / `phone` có thể thiếu nếu chưa từng cập nhật.

---

### `PATCH /api/account/profile`

| | |
| :--- | :--- |
| Auth | Cookie access token |
| Content-Type | `application/json` |

**Request body**

```json
{
  "fullName": "Nguyễn Văn A",
  "phone": "0912345678"
}
```

| Field | Rule |
| :--- | :--- |
| `fullName` | string, trim, 2–100 ký tự |
| `phone` | `0` + 9 số, hoặc `+84` + 9 số |

**Response `200`** — cùng shape `AccountProfile` như GET.

**Lỗi thường gặp**

| Status | Code | Khi nào |
| :---: | :--- | :--- |
| 401 | `NO_TOKEN` / `TOKEN_EXPIRED` / `INVALID_TOKEN` | Thiếu / hết hạn / sai JWT |
| 400 | `VALIDATION_ERROR` | Zod fail |

---

## 2. `/api/cart`

### Mục đích

Đồng bộ giỏ hàng **multi-line theo gói** (pack-1 / pack-3 / pack-6) khi user **đã đăng nhập** → DB.

- Guest: chỉ `localStorage` (`nutein:cart-state`), **không** gọi API.
- `quantity` trên mỗi dòng = **số gói**, không phải số hũ.

### UI gọi

| Chỗ | Hành vi |
| :--- | :--- |
| `lib/useCartStore.ts` | GET hydrate sau login; PUT mỗi lần add / đổi qty / xóa |
| CTA "Thêm vào giỏ" | → `useAddToCart` → `addToCart` → PUT khi logged-in |

---

### `GET /api/cart`

| | |
| :--- | :--- |
| Auth | Cookie access token |
| Body | Không |

**Response `200`** — `CartSummary`

```json
{
  "success": true,
  "data": {
    "lines": [
      {
        "variantId": "pack-3",
        "label": "Gói 3 hộp",
        "quantity": 2,
        "unitPrice": 990000,
        "lineSubtotal": 1980000
      }
    ],
    "quantity": 2,
    "subtotal": 1980000,
    "discountPercent": 0,
    "discountAmount": 0,
    "total": 1980000,
    "shippingNote": "…",
    "voucherProgress": {
      "tiers": [],
      "nextTier": null,
      "amountRemainingVnd": 0,
      "progressPercent": 0,
      "isMaxTierAchieved": false
    },
    "isEmpty": false
  },
  "error": null
}
```

| Field | Ý nghĩa |
| :--- | :--- |
| `lines[].quantity` | Số gói của variant đó |
| `data.quantity` | Tổng số gói mọi dòng |
| `lineSubtotal` | `quantity × unitPrice` |
| `isEmpty` | `lines.length === 0` |

---

### `PUT /api/cart`

Ghi đè **toàn bộ** giỏ (không merge từng dòng trên server — client gửi full `lines`).

| | |
| :--- | :--- |
| Auth | Cookie access token |
| Content-Type | `application/json` |

**Request body**

```json
{
  "lines": [
    { "variantId": "pack-1", "quantity": 1 },
    { "variantId": "pack-6", "quantity": 2 }
  ]
}
```

Giỏ trống:

```json
{ "lines": [] }
```

| Field | Rule |
| :--- | :--- |
| `lines` | mảng, tối đa 10 phần tử |
| `variantId` | string không rỗng |
| `quantity` | số nguyên **1–20** (không gửi dòng qty 0; xóa = bỏ khỏi mảng) |

**Response `200`** — cùng `CartSummary` như GET.

**Lỗi thường gặp**

| Status | Code | Khi nào |
| :---: | :--- | :--- |
| 401 | `NO_TOKEN` / … | Thiếu JWT |
| 400 | `VALIDATION_ERROR` | qty / shape sai |

---

## 3. Liên quan auth (không đổi contract)

| Method | Endpoint | Vai trò với 2 API trên |
| :--- | :--- | :--- |
| `POST` | `/api/auth/session` | Mint cookie JWT sau login Supabase |
| `POST` | `/api/auth/refresh` | Rotate khi access hết hạn (`TOKEN_EXPIRED`) |
| `POST` | `/api/auth/logout` | Thu hồi refresh + xóa cookie |

Client (`lib/api-client.ts` / `lib/swr-fetcher.ts`) có thể remint khi gặp 401 remintable trước khi retry request.

---

## 4. File code tham chiếu

| API | Route | Service / hook |
| :--- | :--- | :--- |
| Profile | `app/api/account/profile/route.ts` | `features/account/services/profile.service.ts`, `lib/useAccountProfile.ts` |
| Cart | `app/api/cart/route.ts` | `features/cart/services/cart.server.service.ts`, `lib/useCartStore.ts` |
| Schema profile | — | `features/account/schemas/profile.schema.ts` |
| Types cart | — | `features/cart/types/index.ts` |
