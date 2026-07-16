# Source Code Architecture Guide — Nutein

## 1. Mục tiêu của tài liệu

Tài liệu này giúp developer và AI agent hiểu cách tổ chức source code của dự án Nutein và làm việc an toàn trong codebase. Nutein là một **Next.js 16 App Router** app (landing page + e-commerce 1 sản phẩm chủ lực), không phải Electron desktop app — không có `main`/`preload`/`renderer`, không có IPC.

Sau khi đọc tài liệu này, developer/AI agent cần nắm được:

- Cấu trúc thư mục chính của project và vai trò từng lớp (`app/`, `components/`, `features/`, `src/`, `lib/`, `types/`).
- Cách tách trách nhiệm giữa route (`app/`), business logic (`features/`) và infrastructure (`src/`, `lib/`).
- Quy tắc quản lý state (tham chiếu [state-management.md](./state-management.md)).
- Quy tắc tổ chức API route, service, schema validation.
- Cấu trúc chuẩn của một UI section/component.
- Cách thêm một page/route mới.
- Cách thêm một feature mới (theo Feature-Folder Pattern).
- Cách thêm một API endpoint mới.
- Kỳ vọng về testing (Vitest + React Testing Library).

Tài liệu này không giải thích business requirement/nội dung sản phẩm (xem `PROJECT_REQUIREMENTS.md`) hoặc quy tắc UI/styling chi tiết (xem `frontend-style-system-guide.md`). Mục tiêu duy nhất là hướng dẫn tổ chức source code đúng kiến trúc.

## 2. Tổng quan kiến trúc

Kiến trúc của dự án kết hợp **Next.js App Router**, **Layered Architecture** (tầng hạ tầng) và **Feature-Folder Pattern** (tầng nghiệp vụ), theo đúng quy hoạch trong [nextjs-architecture-guide.md](../nextjs-architecture-guide.md):

```txt
app/            → Routing & API Routes (mỏng, không chứa business logic)
  ↓ gọi
features/       → Business logic theo module (schemas, services, types)
  ↓ dùng
src/            → Infrastructure layer (errors, logging, middlewares, api response)
lib/            → Server-only singleton clients (Supabase, env validation, SWR fetcher)
components/     → UI (ui primitives / layout / shared sections)
types/          → Type dùng chung toàn dự án
```

Nguyên tắc quan trọng:
- `app/page.tsx` và `app/api/**/route.ts` phải **cực kỳ mỏng** — chỉ nhận input, gọi service tương ứng trong `features/`, trả về UI hoặc JSON.
- Không viết business logic hoặc query database trực tiếp trong `app/`.
- Component (`components/`) không tự gọi database/service phía server — nếu cần data từ server, dùng SWR gọi qua `app/api/**` (xem [state-management.md](./state-management.md)).
- `lib/` chỉ chứa singleton kết nối server-side (`import "server-only"` bắt buộc ở đầu file).

## 3. Cấu trúc thư mục thực tế

```txt
nutein-landing-page/
├── app/
│   ├── layout.tsx              # Root layout, font (Quicksand/Mulish), providers
│   ├── page.tsx                # Trang chủ — compose các section
│   ├── globals.css             # Design tokens + reset + keyframes (xem frontend-style-system-guide.md)
│   └── api/
│       └── contact/route.ts    # API route mẫu — tham khảo pattern chuẩn
├── components/
│   ├── ui/                     # UI primitives (Button, Card, Badge...) — đang được xây theo frontend-style-overhaul.md
│   ├── layout/                 # Navbar.tsx, Footer.tsx
│   ├── shared/                 # Các section trang chủ + AuthModal.tsx
│   └── providers/               # SWRProvider.tsx
├── features/
│   └── contact/                 # Module nghiệp vụ mẫu (Feature-Folder Pattern)
│       ├── constants.ts
│       ├── schemas/contact.schema.ts
│       ├── services/contact.service.ts
│       └── types/index.ts
├── src/                          # Infrastructure Layer
│   ├── api/response.ts           # successResponse/errorResponse/ApiResponse<T> chuẩn
│   ├── errors/app.error.ts       # AppError + các lỗi con (NotFoundError, ValidationError...)
│   ├── logging/logger.ts         # Pino logger
│   └── middlewares/               # error-handler, validate, rate-limit, cors, audit-log, cache, upload...
├── lib/
│   ├── env.ts                    # Validate biến môi trường bằng Zod (server-only)
│   ├── supabase.ts                # Supabase client (server-side)
│   ├── swr-fetcher.ts             # Fetcher chuẩn cho SWR (unwrap ApiResponse<T>)
│   └── utils.ts                   # cn() helper (clsx + tailwind-merge)
├── types/index.ts                 # Type dùng chung toàn dự án
├── docs/                           # Tài liệu kỹ thuật (file này + các guide liên quan)
├── PROJECT_REQUIREMENTS.md         # Sitemap, nội dung từng trang, quy chuẩn UX
├── nextjs-architecture-guide.md    # Nguồn quy hoạch kiến trúc gốc của template
└── public/                         # Static assets (hiện thiếu nhiều brand asset — xem frontend-style-overhaul.md)
```

Lưu ý về `package.json`: một số dependency (`@prisma/client`, `@supabase/ssr`, `@tanstack/react-query`, `ioredis`, `cloudinary`, `jsonwebtoken`, `swagger-jsdoc`...) đã được **provision sẵn theo template chuẩn** ở `nextjs-architecture-guide.md` cho các tính năng tương lai (DB, cache, upload ảnh, auth, API docs), nhưng **chưa được wire vào bất kỳ feature nào** trong codebase hiện tại. Không giả định các tích hợp này đã hoạt động — kiểm tra trong `lib/`/`src/configs/` trước khi dùng, và nếu cần dùng, phải tự cấu hình client tương ứng.

### `app/` — Routing & API Routes

Được dùng cho:
- `page.tsx`, `layout.tsx` của từng route segment.
- `api/**/route.ts` — API route handlers.

Không đặt tại đây:
- Business logic (tính giá, gửi email, query DB).
- Zod schema validation logic phức tạp (import schema từ `features/`, không viết lại).
- UI section lớn (import từ `components/shared/`, không viết JSX section trực tiếp trong `page.tsx`).

Ví dụ `page.tsx` đúng chuẩn (mỏng, chỉ compose):

```tsx
// app/page.tsx
export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <HeroSection />
        <IntroSection />
        {/* ... */}
      </main>
      <Footer />
    </>
  );
}
```

### `components/` — UI Layer

- `components/ui/`: UI primitives tái sử dụng toàn hệ thống (Button, Card, Badge...), xây bằng `class-variance-authority` theo shadcn/ui convention. Xem chi tiết quy tắc styling ở [frontend-style-system-guide.md](./frontend-style-system-guide.md).
- `components/layout/`: khung layout dùng chung mọi trang (`Navbar.tsx`, `Footer.tsx`).
- `components/shared/`: section/feature UI cụ thể của trang chủ hiện tại (`HeroSection.tsx`, `IntroSection.tsx`...) và các UI trạng thái chung (`AuthModal.tsx`).
- `components/providers/`: React context providers (`SWRProvider.tsx`).

Quy tắc:
- Component trong `components/ui/` không được biết về business/domain (không import từ `features/`).
- Component trong `components/shared/` có thể chứa nội dung/copy cụ thể của Nutein nhưng không tự viết business logic (gọi hook/service nếu cần xử lý dữ liệu).
- Khi 1 UI pattern lặp lại ≥ 2 lần giữa các section, extract vào `components/ui/` thay vì copy-paste.

### `features/` — Business Logic Layer (Feature-Folder Pattern)

> **Lưu ý model kinh doanh:** Nutein là e-commerce **1 sản phẩm chủ lực** (single-SKU), không phải multi-product catalog (xem `PROJECT_REQUIREMENTS.md` mục 1). Khi implement `features/product`, `features/cart`, `features/checkout`: không tạo listing/search/filter cho "danh sách sản phẩm", không tạo `productId` như 1 khóa tham chiếu tới nhiều bản ghi sản phẩm khác nhau. Cart/order chỉ có 1 dòng hàng (sản phẩm Nutein) + `quantity` (+ `variantId` nếu có gói/combo) — chi tiết xem `state-management.md` mục 7. `features/blog` mới thực sự cần listing/search/filter (nhiều bài viết).

Mỗi nghiệp vụ lớn (contact, product, cart, checkout, blog, account...) có 1 folder riêng trong `features/`, đóng gói độc lập:

```txt
features/<feature-name>/
  constants.ts       # Hằng số nghiệp vụ của module
  schemas/            # Zod schema validate request/response
  services/           # Business logic (DB queries, external API, tính toán)
  types/               # Type/interface riêng của module
```

Ví dụ tham chiếu duy nhất hiện có — `features/contact/`:

```ts
// features/contact/services/contact.service.ts
export const contactService = {
  async submit(data: ContactFormData): Promise<ContactSubmissionResult> {
    // business logic: lưu DB, gửi email, v.v.
  },
};
```

Quy tắc:
- `services/` là nơi **duy nhất** được phép chứa logic DB/API bên thứ 3 cho feature đó.
- File service tương tác DB/API ngoài phải có `import "server-only";` ở đầu file.
- `schemas/` dùng Zod, export type bằng `z.infer<typeof schema>`.
- Không để 2 feature import chéo service của nhau — nếu cần logic dùng chung, đưa lên `lib/` (nếu là infra) hoặc tạo feature `shared`/`common` mới nếu là business logic dùng chung thật.

### `src/` — Infrastructure Layer

Tầng hạ tầng kỹ thuật, độc lập với business logic cụ thể:

- `src/api/response.ts`: `successResponse()`, `errorResponse()`, `createdResponse()`, type `ApiResponse<T>` — **mọi** API route phải trả response qua các hàm này, không tự `NextResponse.json()` tay.
- `src/errors/app.error.ts`: `AppError` và các lỗi con (`NotFoundError`, `ValidationError`, `UnauthorizedError`, `ForbiddenError`, `BadRequestError`, `ConflictError`) — service throw lỗi bằng các class này, không throw `Error` thường khi cần HTTP status code cụ thể.
- `src/logging/logger.ts`: Pino logger — dùng `logger.child({ service: "...", action: "..." })` trong service để log có context (xem `contact.service.ts`).
- `src/middlewares/error-handler.middleware.ts`: `withErrorHandler()` — bọc quanh mọi route handler để tự động catch `ZodError`/`AppError`/lỗi không mong muốn và map ra `errorResponse` chuẩn. **Mọi** route trong `app/api/` phải export handler đã bọc qua `withErrorHandler`.
- `src/middlewares/` còn có sẵn: `validate`, `rate-limit`, `cors`, `correlation-id`, `audit-log`, `cache`, `upload`, `authenticate` — đây là infra đã scaffold theo template, áp dụng khi feature cụ thể cần (ví dụ `/checkout` cần `rate-limit`, `/account` cần `authenticate`). Không xoá các middleware chưa dùng, nhưng cũng không giả định chúng đã được wire vào route nào đó nếu chưa thấy import thực tế.
- Không đặt tại đây: business logic cụ thể của 1 feature, UI, React component.

### `lib/` — Server-only Singletons & Client Utilities

- `lib/env.ts`: validate biến môi trường bằng Zod khi app khởi động, `server-only`.
- `lib/supabase.ts`: khởi tạo Supabase client server-side, `server-only`.
- `lib/swr-fetcher.ts`: fetcher chuẩn cho `useSWR` ở client — unwrap `ApiResponse<T>`, throw `FetchError` có `status`/`code` khi lỗi.
- `lib/utils.ts`: `cn()` helper (`clsx` + `tailwind-merge`) — dùng cho mọi class Tailwind có điều kiện.

Không đặt tại đây: business logic feature-specific, React component, route handler.

### `types/` — Shared Types

Chỉ chứa type/interface **dùng chung toàn dự án** (ví dụ type của `ApiResponse` re-export, type layout chung). Type chỉ dùng trong 1 feature phải nằm trong `features/<feature>/types/`, không đưa lên `types/` toàn cục.

## 4. State management

Xem chi tiết đầy đủ ở [state-management.md](./state-management.md). Tóm tắt:

```txt
Server/cache state       → SWR (useSWR + lib/swr-fetcher.ts)
Global UI state (chia sẻ) → SWR-as-store pattern (key giả + mutate, xem AuthModal.tsx)
Local UI state             → useState / useReducer trong component
Form state                 → react-hook-form + zodResolver
Business logic/server write → features/*/services/
```

Không thêm Zustand/Redux/Context Provider mới cho state có thể giải quyết bằng SWR hoặc `useState` (xem quy tắc chi tiết trong `state-management.md`).

## 5. API & Service rules

Luồng chuẩn cho một API endpoint (theo đúng mẫu `features/contact/` + `app/api/contact/route.ts`):

```txt
Client (useSWR / fetch trong form submit)
  ↓
app/api/<resource>/route.ts   → withErrorHandler + validate Zod schema + gọi service
  ↓
features/<feature>/services/<name>.service.ts   → business logic thật
  ↓
successResponse(data) / errorResponse(...) / throw AppError con
```

Ví dụ route chuẩn:

```ts
// app/api/contact/route.ts
export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = await req.json();
  const validatedData = contactFormSchema.parse(body);   // 1. validate
  const result = await contactService.submit(validatedData); // 2. gọi service
  return successResponse(result, undefined, 201);          // 3. response chuẩn
});
```

Quy tắc bắt buộc:
- Route handler luôn bọc bằng `withErrorHandler`.
- Validate input bằng Zod schema từ `features/<feature>/schemas/`, không validate tay bằng if/else.
- Response luôn qua `successResponse`/`errorResponse`/`createdResponse`/`noContentResponse` từ `src/api/response.ts`.
- Service throw lỗi bằng `AppError` con tương ứng (`NotFoundError`, `BadRequestError`...) để `withErrorHandler` tự map đúng HTTP status.
- Route không catch lỗi thủ công bằng try/catch riêng — để `withErrorHandler` xử lý tập trung.

## 6. UI component rules

Component chia 3 nhóm, tương ứng vị trí trong `components/`:

| Nhóm | Vị trí | Đặc điểm |
|---|---|---|
| UI primitive | `components/ui/` | Không có business assumption, nhận data qua props, dùng `cva` cho variant |
| Layout | `components/layout/` | Khung dùng ở mọi trang (Navbar, Footer) |
| Section/Feature UI | `components/shared/` | Nội dung cụ thể của Nutein, có thể gọi hook/service qua props hoặc SWR, không tự chứa business logic phức tạp |

Quy tắc chung:
- Không đặt API call trực tiếp trong presentational component — gọi qua `useSWR` hoặc nhận data qua props từ Server Component cha.
- Không viết business logic (tính giá, validate phức tạp) trong JSX — đưa vào `features/*/services/` hoặc hook riêng.
- Section dài/nhiều vùng nên tách sub-component nội bộ trong cùng file hoặc file riêng cạnh nó, theo đúng pattern hiện có trong `HeroSection.tsx` (các sub-component `Star`, `RatingRow`, `Chip`, `FloatingBadge` khai báo ngay trong file section).
- Không hardcode màu/style — xem quy tắc chi tiết ở [frontend-style-system-guide.md](./frontend-style-system-guide.md).

## 7. Cách thêm một route/page mới

Ví dụ thêm `/product` (theo `PROJECT_REQUIREMENTS.md`):

1. Tạo `app/product/page.tsx` — mỏng, chỉ compose section.
2. Nếu page cần section riêng, tạo trong `components/shared/` (ví dụ `ProductHeroSection.tsx`) theo đúng convention PascalCase.
3. Nếu page cần data server-side (ví dụ chi tiết sản phẩm từ DB), tạo `features/product/services/product.service.ts` + gọi trong Server Component, hoặc expose qua `app/api/product/route.ts` nếu client component cần fetch qua SWR.
4. Nếu page cần loading state khi fetch server-side, thêm `app/product/loading.tsx` (xem [loading-agent-guide.md](./loading-agent-guide.md)).
5. Cập nhật `PROJECT_REQUIREMENTS.md` trạng thái route từ ⏳ sang ✅ nếu hoàn tất đúng scope đã mô tả.

## 8. Cách thêm một feature mới

1. Tạo folder `features/<feature-name>/` (kebab-case).
2. Thêm `schemas/` nếu feature nhận input cần validate.
3. Thêm `services/` chứa business logic, luôn `import "server-only";` nếu service đụng DB/API ngoài.
4. Thêm `types/` nếu cần type riêng cho feature.
5. Nếu feature cần API endpoint, tạo `app/api/<feature-name>/route.ts` theo mẫu ở mục 5.
6. Nếu feature cần UI, tạo component trong `components/shared/` và compose vào page tương ứng.

## 9. Cách thêm một component UI primitive mới (`components/ui/`)

1. Kiểm tra `components/ui/` xem primitive tương tự đã tồn tại chưa (Button, Card, Badge...).
2. Nếu chưa có, tạo file mới dùng `class-variance-authority` cho variant, `cn()` (từ `lib/utils.ts`) để merge class.
3. Primitive nhận toàn bộ nội dung/behavior qua props, không import gì từ `features/`.
4. Áp dụng đúng token màu/spacing/radius theo [frontend-style-system-guide.md](./frontend-style-system-guide.md).
5. Không tạo biến thể "riêng" của primitive trong 1 section nếu primitive chung đã đủ dùng — sửa primitive chung hoặc thêm variant mới.

## 10. Testing

Stack test đã cài: **Vitest** (`vitest`, `@vitejs/plugin-react`, `@vitest/coverage-v8`) + **React Testing Library** (`@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`). Hiện **chưa có file test nào** trong repo — khi thêm logic quan trọng, viết test mới theo stack này.

Dùng Vitest (unit) cho:
- `features/*/services/` — business logic, tính toán, xử lý dữ liệu.
- `features/*/schemas/` — Zod schema parse/validate.
- `lib/` utilities thuần (`cn()`, fetcher error mapping).

Dùng React Testing Library cho:
- Component có nhiều state/interaction (form login/register trong `AuthModal`, toggle mobile menu trong `Navbar`).
- Render đúng khi có/không có data, empty state, error state.
- Không test implementation detail — test theo cách người dùng tương tác (query bằng role/text, không query bằng class CSS).

Script chạy test: `npm run test` (once) / `npm run test:watch` / `npm run test:coverage`. `npm run check` chạy đầy đủ format + lint + type-check + test trước khi coi là "xanh".

## 11. Naming conventions

Theo đúng [nextjs-architecture-guide.md](../nextjs-architecture-guide.md):

- Folder feature & file thường: `kebab-case` (`candidate-search`, `contact.service.ts`, `contact.schema.ts`).
- Services/Utils: `camelCase` cho tên export (`contactService`, `cn`).
- React Components: `PascalCase` (`Navbar.tsx`, `HeroSection.tsx`, `AuthModal.tsx`).
- Error classes: `PascalCase` kết thúc bằng `Error` (`NotFoundError`, `ValidationError`).
- Zod schema: kết thúc bằng `Schema` (`contactFormSchema`).
- Type suy ra từ schema: dùng `z.infer<typeof xxxSchema>`, đặt tên theo domain (`ContactFormData`).

## 12. Import rules

- Dùng path alias đã cấu hình trong `tsconfig.json`: `@/components/*`, `@/features/*`, `@/lib/*`, `@/src/*`, `@/types/*`, `@/*` — không dùng deep relative import (`../../../`) khi alias sẵn có.
- `components/ui/` không được import từ `features/*` (giữ primitive vô tính business).
- `features/*/services/` không được import React/Next UI component.
- `lib/*` là tầng thấp nhất cho server singleton — không import từ `features/*` hoặc `components/*`.
- `app/` có thể import từ `components/*` và `features/*`, nhưng không import ngược từ `app/` vào `features/*`/`components/*` (tránh dependency vòng).

## 13. AI agent rules

Khi AI coding agent chỉnh sửa project này, bắt buộc tuân thủ:

- Đọc tài liệu này + [nextjs-architecture-guide.md](../nextjs-architecture-guide.md) trước khi thêm route/feature mới.
- Giữ `app/**/page.tsx` và `app/**/route.ts` mỏng — logic thật nằm ở `features/*/services/`.
- Không viết business logic hoặc query DB trực tiếp trong component/route.
- Mọi API route mới phải bọc `withErrorHandler`, validate bằng Zod, trả response qua `src/api/response.ts`.
- Không thêm global state store mới (Zustand/Redux) — xem `state-management.md` để chọn đúng cơ chế đã có.
- Không tạo `components/ui/` primitive trùng lặp nếu primitive tương tự đã tồn tại.
- Không giả định dependency đã provision sẵn (Prisma, Supabase, Redis, Cloudinary...) đã được wire vào feature — kiểm tra `lib/`/`src/configs/` trước khi dùng.
- Thêm/cập nhật test (Vitest hoặc RTL) khi thêm logic nghiệp vụ hoặc component có state quan trọng.
- Nếu di chuyển/đổi tên file, cập nhật toàn bộ import liên quan và tài liệu nếu cấu trúc thay đổi.
- Ưu tiên thay đổi nhỏ, đúng scope; nếu cần refactor lớn, tách thành nhiều bước rõ ràng và nêu rõ trong phản hồi.

## 14. Common mistakes to avoid

- Viết business logic (tính giá, gửi email, query DB) trực tiếp trong `app/page.tsx` hoặc `route.ts`.
- Bỏ qua `withErrorHandler`, tự viết try/catch riêng trong từng route.
- Tự `NextResponse.json()` thay vì dùng `successResponse`/`errorResponse`.
- Validate input bằng if/else tay thay vì Zod schema.
- Đặt type feature-specific vào `types/` toàn cục thay vì `features/<feature>/types/`.
- Import `features/*` vào `components/ui/` primitive.
- Thêm Zustand/Context Provider mới cho state có thể dùng SWR-as-store hoặc `useState`.
- Giả định Prisma/Supabase/Redis/Cloudinary đã hoạt động chỉ vì có trong `package.json`.
- Deep relative import (`../../../../lib/utils`) khi alias `@/lib/utils` sẵn có.
- Hardcode màu/style trong component thay vì dùng token (xem `frontend-style-system-guide.md`).

## 15. Final checklist trước khi mở PR

- [ ] `page.tsx`/`route.ts` có mỏng, chỉ compose/gọi service không?
- [ ] Business logic có nằm đúng trong `features/*/services/` không?
- [ ] API route có bọc `withErrorHandler` và validate bằng Zod chưa?
- [ ] Response có dùng `successResponse`/`errorResponse` chuẩn chưa?
- [ ] State mới có chọn đúng cơ chế theo `state-management.md` không?
- [ ] Loading state có theo đúng `loading-agent-guide.md` không?
- [ ] UI mới có tuân thủ token/primitive theo `frontend-style-system-guide.md` không?
- [ ] Import có dùng alias `@/*` thay vì deep relative import không?
- [ ] Đã thêm/cập nhật test cho logic quan trọng chưa?
- [ ] Đã chạy `npm run check` (format + lint + type-check + test) trước khi commit chưa?

## 16. Tài liệu liên quan

- [nextjs-architecture-guide.md](../nextjs-architecture-guide.md) — nguồn quy hoạch kiến trúc gốc, hướng dẫn setup project từ đầu.
- [state-management.md](./state-management.md) — chi tiết quy tắc quản lý state.
- [loading-agent-guide.md](./loading-agent-guide.md) — quy tắc loading/skeleton/spinner.
- [frontend-style-system-guide.md](./frontend-style-system-guide.md) — quy tắc styling/token/component UI.
- [frontend-style-overhaul.md](./frontend-style-overhaul.md) — kế hoạch migrate style theo phase.
- [PROJECT_REQUIREMENTS.md](../PROJECT_REQUIREMENTS.md) — sitemap, nội dung từng trang, quy chuẩn UX.
