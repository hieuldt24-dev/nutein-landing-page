import { describe, it, expect } from "vitest";
import { profileFormSchema, updateProfileSchema } from "./profile.schema";

describe("profileFormSchema", () => {
  it("chấp nhận cả hai trường hợp lệ", () => {
    const result = profileFormSchema.safeParse({
      fullName: "Nguyễn Văn A",
      phone: "0987654321",
    });
    expect(result.success).toBe(true);
  });

  it("từ chối khi thiếu phone", () => {
    const result = profileFormSchema.safeParse({ fullName: "Nguyễn Văn A" });
    expect(result.success).toBe(false);
  });

  it("từ chối tên quá ngắn", () => {
    const result = profileFormSchema.safeParse({
      fullName: "A",
      phone: "0987654321",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateProfileSchema", () => {
  it("chấp nhận chỉ fullName", () => {
    const result = updateProfileSchema.safeParse({ fullName: "Nguyễn Văn A" });
    expect(result.success).toBe(true);
  });

  it("chấp nhận chỉ phone", () => {
    const result = updateProfileSchema.safeParse({ phone: "0987654321" });
    expect(result.success).toBe(true);
  });

  it("chấp nhận cả hai trường", () => {
    const result = updateProfileSchema.safeParse({
      fullName: "Nguyễn Văn A",
      phone: "0987654321",
    });
    expect(result.success).toBe(true);
  });

  it("từ chối object rỗng", () => {
    const result = updateProfileSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("từ chối số điện thoại sai định dạng khi có mặt", () => {
    const result = updateProfileSchema.safeParse({ phone: "123" });
    expect(result.success).toBe(false);
  });

  it("từ chối tên quá ngắn khi có mặt", () => {
    const result = updateProfileSchema.safeParse({ fullName: "A" });
    expect(result.success).toBe(false);
  });
});
