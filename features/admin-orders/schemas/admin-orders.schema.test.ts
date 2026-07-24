import { describe, it, expect } from "vitest";
import {
  adminOrderListQuerySchema,
  adminOrderStatusUpdateSchema,
} from "./admin-orders.schema";

describe("adminOrderListQuerySchema", () => {
  it("chấp nhận query rỗng (không lọc)", () => {
    expect(adminOrderListQuerySchema.safeParse({}).success).toBe(true);
  });

  it("chấp nhận status hợp lệ + 'all'", () => {
    expect(adminOrderListQuerySchema.safeParse({ status: "processing" }).success).toBe(true);
    expect(adminOrderListQuerySchema.safeParse({ status: "all" }).success).toBe(true);
  });

  it("từ chối status không hợp lệ", () => {
    expect(adminOrderListQuerySchema.safeParse({ status: "unknown" }).success).toBe(false);
  });
});

describe("adminOrderStatusUpdateSchema", () => {
  it("chấp nhận status hợp lệ, không bắt buộc note", () => {
    const result = adminOrderStatusUpdateSchema.safeParse({ status: "processing" });
    expect(result.success).toBe(true);
  });

  it("từ chối thiếu status", () => {
    expect(adminOrderStatusUpdateSchema.safeParse({ note: "x" }).success).toBe(false);
  });

  it("từ chối status = 'all' (không hợp lệ cho update)", () => {
    expect(adminOrderStatusUpdateSchema.safeParse({ status: "all" }).success).toBe(false);
  });

  it("từ chối note quá 500 ký tự", () => {
    const result = adminOrderStatusUpdateSchema.safeParse({
      status: "processing",
      note: "a".repeat(501),
    });
    expect(result.success).toBe(false);
  });
});
