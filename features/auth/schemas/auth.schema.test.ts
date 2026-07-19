import { describe, it, expect } from "vitest";
import { loginSchema, registerSchema } from "./auth.schema";

describe("loginSchema", () => {
  it("chấp nhận email + password hợp lệ", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "matkhau123",
    });
    expect(result.success).toBe(true);
  });

  it("chấp nhận rememberMe là optional (bỏ qua vẫn hợp lệ)", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "matkhau123",
    });
    expect(result.success).toBe(true);
  });

  it("từ chối email rỗng với message tiếng Việt", () => {
    const result = loginSchema.safeParse({ email: "", password: "matkhau123" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Vui lòng nhập email");
    }
  });

  it("từ chối email sai định dạng", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "matkhau123",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Email không đúng định dạng");
    }
  });

  it("từ chối password ngắn hơn 6 ký tự", () => {
    const result = loginSchema.safeParse({ email: "user@example.com", password: "123" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Mật khẩu phải có ít nhất 6 ký tự");
    }
  });

  it("từ chối khi thiếu field password", () => {
    const result = loginSchema.safeParse({ email: "user@example.com" });
    expect(result.success).toBe(false);
  });
});

describe("registerSchema", () => {
  const validPayload = {
    fullName: "Nguyễn Văn A",
    email: "user@example.com",
    password: "matkhau123",
    confirmPassword: "matkhau123",
    agreeTerms: true,
  };

  it("chấp nhận payload hợp lệ", () => {
    const result = registerSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("từ chối khi confirmPassword không khớp password", () => {
    const result = registerSchema.safeParse({
      ...validPayload,
      confirmPassword: "khac-mat-khau",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join(".") === "confirmPassword");
      expect(issue?.message).toBe("Mật khẩu xác nhận không khớp");
    }
  });

  it("từ chối khi agreeTerms = false", () => {
    const result = registerSchema.safeParse({ ...validPayload, agreeTerms: false });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join(".") === "agreeTerms");
      expect(issue?.message).toBe(
        "Bạn cần đồng ý với Điều khoản dịch vụ & Chính sách bảo mật"
      );
    }
  });

  it("từ chối khi thiếu fullName", () => {
    const result = registerSchema.safeParse({ ...validPayload, fullName: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join(".") === "fullName");
      expect(issue?.message).toBe("Vui lòng nhập họ và tên");
    }
  });
});
