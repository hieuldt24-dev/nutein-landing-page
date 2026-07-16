# Loading Agent Guide

Tài liệu này hướng dẫn developer và AI agent xử lý trạng thái loading trong dự án Nutein (Next.js 16 App Router, landing page/e-commerce). Mục tiêu: loading phải nhất quán, không làm layout giật, và không phát sinh thư viện/pattern mới khi những gì đã có (Next.js Suspense, SWR, `Loader2` từ `lucide-react`, `sonner`) là đủ.

## 1. Bốn loại loading trong dự án

| Loại | Dùng khi | Cơ chế |
|---|---|---|
| **Route/Page loading** | Chuyển trang, Server Component đang fetch data | `app/**/loading.tsx` (Next.js Suspense convention) |
| **Component/Section loading** | Một block trong trang (danh sách blog, lịch sử đơn hàng...) đang tải | Skeleton component, dựa trên `isLoading` của `useSWR` |
| **Form/Action loading** | Submit form, click 1 nút thực hiện action (login, thêm giỏ hàng, gửi liên hệ) | `useState` cờ `isSubmitting` + icon `Loader2` (`lucide-react`) trong chính nút đó |
| **Blocking overlay** | Action quan trọng, không thể để user tương tác tiếp trong lúc xử lý (đặt hàng ở `/checkout`) | Dùng hạn chế, xem mục 5 |

Không tạo loại thứ 5 nếu chưa rơi vào đúng 1 trong 4 nhóm trên.

## 2. Route/Page loading — `app/**/loading.tsx`

Next.js App Router tự động hiển thị `loading.tsx` khi Server Component trong cùng route segment đang fetch data (React Suspense boundary có sẵn, không cần code thủ công).

- Mỗi route có fetch dữ liệu server-side nên có 1 file `loading.tsx` cạnh `page.tsx`, ví dụ tương lai: `app/blog/loading.tsx`, `app/product/loading.tsx`.
- Nội dung `loading.tsx` nên là skeleton giữ đúng bố cục của page đó (xem mục 3), không phải spinner toàn trắng màn hình.
- Không tự chặn UI bằng `useState` + `if (loading) return <Spinner />` ở đầu Server Component nếu `loading.tsx` đã xử lý được việc này.

```tsx
// app/blog/loading.tsx
export default function BlogLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-72 animate-pulse rounded-[var(--radius-lg)] bg-[var(--color-border-subtle)]" />
        ))}
      </div>
    </div>
  );
}
```

## 3. Component/Section loading — Skeleton + SWR

Với Client Component tự fetch dữ liệu qua `useSWR` (xem [state-management.md](./state-management.md)), dùng `isLoading` để hiển thị skeleton đúng hình dạng nội dung thật, tránh layout nhảy khi data về.

```tsx
const { data, isLoading } = useSWR<Order[]>("/api/account/orders");

if (isLoading) {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-border-subtle)]" />
      ))}
    </div>
  );
}
```

Quy tắc:
- Skeleton phải xấp xỉ chiều cao/kích thước của nội dung thật để không gây layout shift.
- Dùng class `animate-pulse` (Tailwind sẵn có) — không viết keyframe pulse riêng.
- Khi có nhiều nơi dùng cùng 1 dạng skeleton (ví dụ card sản phẩm), tạo 1 component `*Skeleton` cạnh component thật (ví dụ `ProductCardSkeleton.tsx` cạnh `ProductCard.tsx`), không copy-paste JSX skeleton ra nhiều nơi.
- Không hiển thị `isLoading` cùng lúc với `error` — kiểm tra `error` trước, `isLoading` sau, rồi mới render data.

## 4. Form/Action loading — spinner trong nút

Đây là pattern chuẩn đã áp dụng nhất quán trong [components/shared/AuthModal.tsx](../components/shared/AuthModal.tsx) — mọi form/action mới phải theo đúng pattern này:

```tsx
const [isSubmitting, setIsSubmitting] = useState(false);

async function onSubmit(values: FormValues) {
  setIsSubmitting(true);
  try {
    await someService.submit(values);
    toast.success("Thành công!");
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Đã xảy ra lỗi");
  } finally {
    setIsSubmitting(false);
  }
}

<button type="submit" disabled={isSubmitting} className="...">
  {isSubmitting ? (
    <>
      <Loader2 size={16} className="animate-spin" />
      Đang xử lý...
    </>
  ) : (
    "Gửi"
  )}
</button>
```

Quy tắc bắt buộc:
- Luôn `disabled={isSubmitting}` trên nút submit VÀ trên các input/checkbox liên quan nếu double-submit có thể gây lỗi dữ liệu (đã làm đúng trong `AuthModal`).
- Icon loading luôn là `Loader2` từ `lucide-react` với `className="animate-spin"` — không dùng icon spinner khác, không tự vẽ SVG spinner mới.
- Giữ nguyên kích thước nút khi chuyển giữa state loading/idle (không để nút co giãn làm layout nhảy).
- Kết quả thành công/lỗi báo qua `toast` (`sonner`, đã cấu hình global ở `app/layout.tsx`) — loading state không tự hiển thị thông báo, chỉ khoá tương tác.
- Khi có `Button` primitive dùng chung được tạo trong `components/ui/` (xem `docs/frontend-style-system-guide.md`), pattern này nên được gói vào prop `loading` của `Button` để không phải lặp lại JSX `Loader2` ở mọi nơi.

## 5. Blocking overlay — chỉ dùng khi thật cần thiết

Overlay chặn toàn màn hình **chỉ** dùng cho action mà nếu user thao tác tiếp sẽ gây hậu quả (double-order, mất dữ liệu). Trên một landing page/e-commerce nhỏ như Nutein, trường hợp hợp lệ gần như chỉ có: submit đơn hàng ở `/checkout`.

Không dùng blocking overlay cho:
- Loading danh sách/section thông thường (dùng mục 3).
- Submit form không có rủi ro double-write nghiêm trọng (dùng mục 4).
- Bất kỳ `useSWR` loading thông thường.

Nếu thực sự cần (ví dụ đặt hàng), giữ overlay đơn giản: nền mờ + 1 dòng trạng thái, tái sử dụng cùng token màu/spacing với `AuthModal`, không thêm animation phức tạp mới.

## 6. Quy tắc cho AI agent

Khi thêm loading vào bất kỳ page/component:

1. Xác định đúng 1 trong 4 loại ở mục 1 trước khi viết code — không trộn lẫn (ví dụ không dùng blocking overlay cho việc load 1 danh sách).
2. Route Server Component fetch data → tạo `loading.tsx`, không tự viết loading state thủ công trong page.
3. Section/Client Component dùng `useSWR` → dùng `isLoading` + skeleton đúng hình dạng nội dung.
4. Form/nút action → `useState` cờ `isSubmitting` + `Loader2` `animate-spin`, disable input liên quan.
5. Không thêm thư viện loading/spinner mới (react-loading, react-spinners...) khi `lucide-react` + Tailwind `animate-pulse`/`animate-spin` đã đủ.
6. Không dùng `alert()`/`console.log` để báo trạng thái loading — dùng disabled state trực quan + `toast` khi kết thúc.
7. Không để `isLoading` và data cũ hiển thị đồng thời gây giật UI — SWR mặc định giữ data cũ khi refetch (`isValidating`), chỉ dùng `isLoading` (lần fetch đầu) để quyết định hiện skeleton.
8. Test nhanh mọi state trước khi coi là hoàn thành: idle → loading → success, và idle → loading → error.

## 7. Checklist trước khi commit

- Route có fetch server-side đã có `loading.tsx` phù hợp bố cục chưa?
- Skeleton có giữ đúng kích thước nội dung thật không (không gây layout shift)?
- Nút submit có disable đúng lúc và hiển thị `Loader2` xoay không?
- Có xử lý cả 2 nhánh success và error (qua `toast`) không?
- Có tái sử dụng skeleton/spinner đã có sẵn thay vì tạo bản mới không?
