# Hướng Dẫn Cấu Trúc Dự Án Next.js & Quy Chuẩn Thiết Lập (Boilerplate Architecture)

Tài liệu này hướng dẫn cách tổ chức cấu trúc thư mục, kiến trúc phân lớp (Layered Architecture), mô hình Feature-Folder và các bước thiết lập một dự án Next.js mới chuẩn chỉ dựa trên mô hình của dự án hiện tại.

---

## 1. Sơ Đồ Cấu Trúc Tổng Quan (Directory Tree)

Cấu trúc dưới đây kết hợp giữa **Next.js App Router**, **Layered Architecture** (ở tầng hạ tầng) và **Feature-Folder Pattern** (ở tầng nghiệp vụ) để đảm bảo khả năng mở rộng (scalability) và tính cô lập (isolation).

```text
my-nextjs-app/
├── app/                        # Next.js App Router (Giao diện & API Routes)
│   ├── api/                    # Các API endpoint toàn cục hoặc route handlers
│   ├── layout.tsx              # Root Layout
│   └── page.tsx                # Trang chủ (Home Page)
├── components/                 # Các UI Components dùng chung toàn hệ thống
│   ├── ui/                     # UI Primitives cơ bản (button, input, dialog...) từ shadcn/ui
│   ├── layout/                 # Các khung giao diện chung (AppHeader, AppSidebar, Footer...)
│   └── shared/                 # Các component biểu diễn trạng thái chung (Loading, Empty, Error)
├── features/                   # Các Module nghiệp vụ riêng biệt (Feature-Folder Pattern)
│   ├── candidate-search/       # Module nghiệp vụ ví dụ (Tìm kiếm ứng viên)
│   │   ├── schemas/            # Zod validation schemas dành riêng cho module
│   │   ├── services/           # Logic nghiệp vụ xử lý dữ liệu (DB queries, external APIs)
│   │   ├── types/              # TypeScript types / interfaces riêng cho module
│   │   └── constants.ts        # Các hằng số nghiệp vụ của module
│   └── ...
├── src/                        # Tầng hạ tầng dùng chung (Infrastructure Layer)
│   ├── api/                    # API Utilities (Standard response, API route handler wrappers)
│   ├── cache/                  # Cấu hình Redis / In-memory caching
│   ├── configs/                # Cấu hình SDKs bên thứ ba (Cloudinary, Swagger...)
│   ├── errors/                 # Định nghĩa AppError & các lớp lỗi HTTP Custom
│   ├── logging/                # Cấu hình Logger tập trung (Pino/Winston)
│   └── middlewares/            # Các Middleware xử lý request (Auth, Rate limit, Audit log...)
├── lib/                        # Server-only Utility Singletons & Clients kết nối ngoài
│   ├── env.ts                  # Validate biến môi trường bằng Zod khi start app
│   ├── supabase.ts             # Khởi tạo DB Client kết nối server-side
│   └── utils.ts                # Helper functions phụ trợ nhỏ
├── types/                      # Các kiểu dữ liệu TypeScript dùng chung toàn dự án
├── tests/                      # Môi trường và các kịch bản kiểm thử (Vitest/E2E Playwright)
└── supabase/                   # Cấu hình DB Schema & Migrations (Nếu dùng Supabase)
```

---

## 2. Vai Trò Chi Tiết Của Từng Folder

### 📁 `app/` (Next.js App Router Layer)
Nơi chứa toàn bộ định tuyến trang (Routing Pages) và API Routes.
*   **Quy tắc:** Giữ các file trong `app/` cực kỳ mỏng. Giao diện trang (`page.tsx`) hoặc API Route (`route.ts`) chỉ thực hiện đón nhận dữ liệu đầu vào, gọi Service tương ứng từ thư mục `features/`, và trả về kết quả UI hoặc JSON. Không viết logic nghiệp vụ hay câu lệnh truy vấn database trực tiếp tại đây.

### 📁 `features/` (Core Business Logic Layer)
Sử dụng **Feature-Folder Pattern**. Mỗi nghiệp vụ lớn được đóng gói độc lập trong một thư mục con.
*   **schemas/**: Chứa Zod schema để validate request payload hoặc response payload. Điều này bảo vệ logic bên trong khỏi dữ liệu sai lệch.
*   **services/**: Nơi thực thi logic nghiệp vụ (gọi database, tính toán điểm, tương tác API bên ngoài).
*   **Lợi ích:** Khi cần chỉnh sửa một tính năng cụ thể, nhà phát triển chỉ cần làm việc trong thư mục feature đó mà không phải tìm kiếm rải rác ở nhiều nơi trong dự án.

### 📁 `src/` (Infrastructure Layer)
Tầng hạ tầng kỹ thuật bổ trợ cho ứng dụng.
*   **errors/**: Định nghĩa class `AppError` kế thừa từ `Error` nhằm quản lý thống nhất mã lỗi và HTTP Status Code.
*   **middlewares/**: Chứa các bộ lọc request đầu vào (Xác thực JWT, Rate Limiting, Audit Logging).
*   **Lợi ích:** Giúp cô lập các chi tiết kỹ thuật (chọn thư viện log nào, chọn cache gì) ra khỏi logic nghiệp vụ, dễ dàng thay thế hạ tầng về sau.

### 📁 `lib/` (Server-only Singletons)
Nơi chứa các file cấu hình khởi tạo kết nối (DB client, Cloudinary client, Mail client) và cấu hình ứng dụng chạy phía Server.
*   **Quy tắc:** Bắt buộc sử dụng chỉ thị `import "server-only";` ở đầu các file này để ngăn chặn việc vô tình import nhầm code server vào giao diện Client.

---

## 3. Các Bước Thiết Lập Dự Án Next.js Tương Tự Từ Đầu

### Bước 1: Khởi tạo dự án Next.js mới
Chạy lệnh CLI của Next.js:
```bash
npx create-next-app@latest my-awesome-app
```
**Lưu ý lựa chọn cấu hình:**
*   TypeScript: **Yes**
*   ESLint: **Yes**
*   Tailwind CSS: **Yes**
*   `src/` directory: **No** *(Chúng ta chọn No để giữ thư mục app/ ở root, sau đó tự tạo thư mục `src/` riêng làm tầng hạ tầng kỹ thuật)*
*   App Router: **Yes**
*   Customize import alias: **Yes** (Mặc định chọn `@/*`)

### Bước 2: Tạo bộ khung thư mục
Chạy các lệnh tạo thư mục dưới đây tại thư mục gốc của dự án mới:
```bash
mkdir -p components/ui components/layout components/shared
mkdir -p features
mkdir -p src/api src/cache src/configs src/errors src/logging src/middlewares
mkdir -p lib types tests
```

### Bước 3: Cấu hình Đường dẫn Import rút gọn (Path Aliases)
Mở file `tsconfig.json` và cập nhật cấu hình `paths` để hỗ trợ import tuyệt đối từ các lớp kiến trúc:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"],
      "@/components/*": ["./components/*"],
      "@/features/*": ["./features/*"],
      "@/lib/*": ["./lib/*"],
      "@/src/*": ["./src/*"],
      "@/types/*": ["./types/*"]
    }
  }
}
```

### Bước 4: Cài đặt các thư viện thiết yếu
```bash
# Thư viện xác thực dữ liệu đầu vào & môi trường
npm install zod server-only

# Thư viện logger chuyên dụng cho server
npm install pino pino-pretty

# Cài đặt shadcn/ui để quản lý giao diện
npx shadcn@latest init
```

### Bước 5: Viết file validate biến môi trường ([lib/env.ts](file:///d:/SE19C01-DE190318/Learn/K-Fresh%20Trainne/Project/Linkedln-Srcaper/lib/env.ts))
Tạo file `lib/env.ts` để chắc chắn rằng ứng dụng sẽ báo lỗi ngay lập tức khi khởi động nếu thiếu bất cứ biến môi trường quan trọng nào:
```typescript
import "server-only";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  LOG_LEVEL: z.enum(["info", "debug", "error", "warn"]).default("info"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Cấu hình biến môi trường không hợp lệ:", parsed.error.format());
  throw new Error("Cấu hình môi trường không hợp lệ. Vui lòng kiểm tra lại file .env");
}

export const env = parsed.data;
```

---

## 4. Các Quy Chuẩn Lập Trình Quan Trọng (Key Conventions)

1.  **Quy tắc đặt tên (Naming Conventions):**
    *   Các thư mục feature và file thông thường sử dụng định dạng **kebab-case** (Ví dụ: `candidate-search`, `error-handler.middleware.ts`).
    *   Các Services, Controllers hoặc Utils dùng định dạng **camelCase** (Ví dụ: `crawl.service.ts`, `apiClient.ts`).
    *   Các React Components dùng định dạng **PascalCase** (Ví dụ: `AppHeader.tsx`, `EmptyState.tsx`).
2.  **Ngăn ngừa lỗi rò rỉ mã nguồn Server (Server-only guard):**
    *   Tất cả file dịch vụ tương tác DB hoặc API bên ngoài phải đặt lệnh `import "server-only";` ở dòng đầu tiên.
3.  **Chuẩn hóa dữ liệu trả về của API (API Response Standardization):**
    *   Nên có cấu trúc response chuẩn dạng JSON:
        ```json
        {
          "success": true,
          "data": { ... },
          "error": null
        }
        ```
    *   Sử dụng middleware global error handler trong `src/middlewares/` để đón các lỗi `AppError` và tự động mapping ra HTTP Status Code tương ứng (400, 401, 403, 404, 500) giúp frontend dễ dàng xử lý.
