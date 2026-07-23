import { describe, it, expect } from "vitest";
import { payosWebhookSchema, payosStatusQuerySchema } from "./payos.schema";

describe("payosWebhookSchema", () => {
  it("chấp nhận payload webhook hợp lệ", () => {
    const result = payosWebhookSchema.safeParse({
      code: "00",
      desc: "success",
      success: true,
      signature: "abc123",
      data: { orderCode: 123, amount: 2000, extraFieldPayosMayAdd: "x" },
    });
    expect(result.success).toBe(true);
  });

  it("từ chối khi thiếu signature", () => {
    const result = payosWebhookSchema.safeParse({
      code: "00",
      desc: "success",
      success: true,
      signature: "",
      data: {},
    });
    expect(result.success).toBe(false);
  });

  it("từ chối payload thiếu field bắt buộc", () => {
    const result = payosWebhookSchema.safeParse({ data: {} });
    expect(result.success).toBe(false);
  });
});

describe("payosStatusQuerySchema", () => {
  it("chấp nhận orderCode hợp lệ", () => {
    const result = payosStatusQuerySchema.safeParse({ orderCode: "NT-20260722-AB12" });
    expect(result.success).toBe(true);
  });

  it("từ chối orderCode rỗng hoặc null", () => {
    expect(payosStatusQuerySchema.safeParse({ orderCode: "" }).success).toBe(false);
    expect(payosStatusQuerySchema.safeParse({ orderCode: null }).success).toBe(false);
  });
});
