import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// @testing-library/react tự đăng ký afterEach(cleanup) NẾU thấy `afterEach`
// là global — dự án này cố tình không bật `test.globals` (mỗi file tự
// import describe/it/expect từ "vitest") nên phải đăng ký cleanup thủ công,
// nếu không DOM của test trước sẽ dồn lại sang test sau trong cùng file.
afterEach(() => {
  cleanup();
});
