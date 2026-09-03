import { describe, it, expect } from "vitest";

import { authService } from "./auth.service";

describe("authService.roleRank", () => {
  it("xếp hạng user < staff < admin", () => {
    expect(authService.roleRank("user")).toBeLessThan(authService.roleRank("staff"));
    expect(authService.roleRank("staff")).toBeLessThan(authService.roleRank("admin"));
  });
});

describe("authService.isDowngrade", () => {
  it("admin -> user / admin -> staff / staff -> user là hạ quyền", () => {
    expect(authService.isDowngrade("admin", "user")).toBe(true);
    expect(authService.isDowngrade("admin", "staff")).toBe(true);
    expect(authService.isDowngrade("staff", "user")).toBe(true);
  });

  it("user -> admin / user -> staff / staff -> admin KHÔNG phải hạ quyền", () => {
    expect(authService.isDowngrade("user", "admin")).toBe(false);
    expect(authService.isDowngrade("user", "staff")).toBe(false);
    expect(authService.isDowngrade("staff", "admin")).toBe(false);
  });

  it("giữ nguyên role KHÔNG phải hạ quyền", () => {
    expect(authService.isDowngrade("user", "user")).toBe(false);
    expect(authService.isDowngrade("staff", "staff")).toBe(false);
    expect(authService.isDowngrade("admin", "admin")).toBe(false);
  });
});
