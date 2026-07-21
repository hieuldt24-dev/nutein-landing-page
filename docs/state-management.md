# State Management

Tài liệu này quy định cách quản lý state trong dự án Nutein (Next.js 16 App Router). Nutein là một landing page/e-commerce nhỏ, **không cần** Redux/Zustand — mục tiêu là giữ state đơn giản, ít lớp trừu tượng, và tận dụng tối đa những gì Next.js + SWR đã cung cấp sẵn.

## 1. Nguyên tắc tổng quát

- Không thêm state management library mới (Zustand, Redux, Jotai...) trừ khi có nhu cầu thực sự vượt quá khả năng của SWR + `useState`/`useReducer`.
- Phân loại state theo 3 nhóm rõ ràng: **Server/cache state**, **Global UI state (cross-component)**, **Local UI state (trong 1 component)**.
- Business logic (validate, tính tiền, xử lý đơn hàng...) không được viết trong component hoặc trong store — phải nằm trong `features/*/services/`.

## 2. Server / cache state — SWR

SWR (`swr`) là công cụ duy nhất cho dữ liệu đến từ server (API routes trong `app/api/`).

- `SWRConfig` toàn cục được cấu hình một lần ở [components/providers/SWRProvider.tsx](../components/providers/SWRProvider.tsx), bọc quanh toàn app trong [app/layout.tsx](../app/layout.tsx).
- Fetcher chuẩn hoá lỗi/response nằm ở [lib/swr-fetcher.ts](../lib/swr-fetcher.ts) — luôn unwrap theo cấu trúc `ApiResponse<T>` (`success/data/error`), tự throw `FetchError` có `status`/`code`. Không viết `fetch()` tay trong component nếu có thể dùng `useSWR` + fetcher này.
- Ví dụ dùng đúng:

```tsx
const { data, error, isLoading } = useSWR<Order[]>("/api/orders");
```

- Không tự ý bật `revalidateOnFocus: false` hoặc đổi `dedupingInterval` per-hook trừ khi có lý do rõ (ví dụ dữ liệu tĩnh như policy content).

## 3. Global UI state (cross-component) — "SWR-as-store" pattern

Dự án dùng một pattern nhẹ: dùng `useSWR` với một **key tĩnh** (không phải URL) làm store toàn cục, cập nhật bằng `mutate(key, value, { revalidate: false })`. Đây **không phải** server data — key này không bao giờ gọi network, chỉ tồn tại trong SWR cache để chia sẻ state giữa các component không có quan hệ cha-con.

**Bắt buộc** tắt cả 3 cờ `revalidateOnMount`/`revalidateOnFocus`/`revalidateOnReconnect` (không chỉ `revalidateOnMount`) — nếu thiếu `revalidateOnFocus: false`, SWR sẽ tự chạy lại fetcher no-op mỗi khi **tab được focus lại**, ghi đè giá trị thật (vừa `mutate()`) về giá trị mặc định của fetcher. Đây là bug thật đã gặp: key `auth-user`/`auth-ready` thiếu `revalidateOnFocus: false` khiến user bị tự đăng xuất mỗi lần chuyển tab đi rồi quay lại (xem `lib/useAuthStore.ts`).

Ví dụ hiện có — trạng thái mở/đóng `AuthModal` ở [components/shared/AuthModal.tsx](../components/shared/AuthModal.tsx):

```tsx
const { mutate } = useSWRConfig();
const { data: isOpen } = useSWR("auth-modal", () => false, {
  fallbackData: false,
  revalidateOnMount: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
});

const setIsOpen = useCallback(
  (val: boolean) => mutate("auth-modal", val, { revalidate: false }),
  [mutate]
);
```

Bất kỳ component nào (Navbar, CTA button...) chỉ cần gọi `mutate("auth-modal", true, { revalidate: false })` để mở modal, không cần Context Provider mới.

Dùng pattern này khi:
- State cần chia sẻ giữa 2+ component không nằm trong quan hệ cha-con trực tiếp (modal open/close, giỏ hàng mini-cart, toast queue nội bộ...).
- State không cần persist qua reload (nếu cần persist, xem mục 5).

Không dùng pattern này khi:
- State chỉ dùng trong 1 component/1 cây con — dùng `useState` bình thường (mục 4).
- State là dữ liệu thật từ server — dùng SWR với key là URL thật (mục 2), không phải key giả.

## 4. Local UI state — `useState` / `useReducer`

Dùng `useState` cho state chỉ tồn tại trong 1 component:

- Tab đang active (`activeTab` trong `AuthModal`).
- Toggle hiển thị mật khẩu (`showPassword`).
- Trạng thái submit của 1 form cụ thể (`isSubmittingForm`) — xem thêm quy tắc loading ở [loading-agent-guide.md](./loading-agent-guide.md).
- Mobile menu mở/đóng trong `Navbar`.

Quy tắc:
- Không "nâng cấp" local state lên global store nếu chưa có 2 component thực sự cần dùng chung.
- Nếu state phức tạp (nhiều field liên quan, nhiều transition), dùng `useReducer` thay vì nhiều `useState` rời rạc.

## 5. Form state — React Hook Form + Zod

Mọi form (login, register, contact, checkout sau này) dùng `react-hook-form` + `zodResolver`, theo đúng pattern trong `AuthModal.tsx` và `features/contact/schemas/contact.schema.ts`:

- Schema validate định nghĩa bằng Zod, đặt trong `features/<feature>/schemas/`.
- Component chỉ gọi `useForm({ resolver: zodResolver(schema) })`, không tự viết validate tay.
- Submit handler gọi service/API, không xử lý business logic trực tiếp trong `onSubmit`.

## 6. Business logic & server writes — Feature services

Theo [nextjs-architecture-guide.md](../nextjs-architecture-guide.md), mọi logic nghiệp vụ (lưu DB, gửi email, tính toán) phải nằm trong `features/<feature>/services/`, ví dụ `features/contact/services/contact.service.ts`. API route (`app/api/**/route.ts`) chỉ làm 3 việc: validate input bằng Zod schema, gọi service, trả `successResponse`/lỗi chuẩn.

Component/UI **không được**:
- Query database trực tiếp.
- Viết logic tính giá, tính voucher, xử lý đơn hàng ngay trong `onClick`/`onSubmit`.
- Gọi `fetch` tới service bên thứ 3 (email, payment gateway) trực tiếp từ client component.

## 7. State cho các trang tương lai (cart, checkout, account)

**Lưu ý quan trọng — Nutein là e-commerce 1 sản phẩm chủ lực (single-SKU), không phải multi-product catalog** (xem `PROJECT_REQUIREMENTS.md` mục 1: "E-commerce 1 sản phẩm chủ lực – Protein thực vật"). Điều này ảnh hưởng trực tiếp tới shape của cart state — đừng mặc định copy pattern giỏ hàng nhiều sản phẩm khác nhau của e-commerce thông thường:

- **Giỏ hàng (cart)**: single-SKU Nutein nhưng **nhiều dòng theo gói** (`pack-1` / `pack-3` / `pack-6`). State: `{ lines: { variantId, quantity }[] }` với `quantity` = **số gói** của dòng đó. Thêm gói khác = thêm / cộng dòng tương ứng, không ghi đè. Badge = tổng số gói mọi dòng. Giá = Σ `packPrice × qty`. Persist `lib/useCartStore.ts` + `/api/cart`. Không phải multi-product catalog.
- **Checkout form**: React Hook Form + Zod như mục 5, submit gọi `features/checkout/services/`. Phần sản phẩm trong đơn lấy từ `cart.lines` (có thể nhiều gói), không loop multi-product catalog.
- **Account/Orders**: dữ liệu thật từ server → SWR với key là URL thật (`/api/account/orders`...), không dùng key giả. Mỗi order vẫn chỉ chứa 1 dòng sản phẩm (variant + quantity) theo đúng model single-SKU.
- **Wishlist (`/account/wishlist`)**: **cần xác nhận lại với client trước khi implement** — với model 1 sản phẩm duy nhất, "danh sách yêu thích" không có nhiều ý nghĩa (yêu thích cái gì khi chỉ có 1 SKU?). Khả năng cao đây là boilerplate còn sót lại từ template e-commerce đa sản phẩm. Không code route này theo hướng "wishlist nhiều sản phẩm" nếu chưa xác nhận — có thể client thực ra muốn "lưu công thức/blog yêu thích" (đã có nhắc ở mục 3.5 blog: "Công thức yêu thích") chứ không phải sản phẩm.

## 8. Quy tắc cho AI agent

Khi thêm hoặc sửa state trong dự án này, AI agent phải:

1. Xác định state thuộc nhóm nào (server / global UI / local UI) trước khi viết code.
2. Ưu tiên `useState` cho local state; chỉ dùng SWR-as-store khi thực sự cần chia sẻ cross-component.
3. Không thêm Zustand/Redux/Context Provider mới cho state có thể giải quyết bằng SWR key giả hoặc `useState`.
4. Luôn dùng `lib/swr-fetcher.ts` cho mọi gọi API thật qua SWR, không viết fetcher riêng mỗi nơi.
5. Đặt business logic trong `features/*/services/`, không đặt trong component hoặc trong store.
6. Dùng Zod schema có sẵn (hoặc tạo mới trong `features/*/schemas/`) cho mọi form, không validate tay bằng if/else rời rạc.
7. Khi cần state persist qua reload trước khi có backend, gom logic `localStorage` vào một hook dùng chung duy nhất, không lặp lại `localStorage.getItem`/`setItem` ở nhiều file.
