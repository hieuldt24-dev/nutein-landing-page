import { describe, expect, it } from "vitest";
import {
  parsePolicyContent,
  serializePolicyContent,
} from "./policy-sections";

describe("policy-sections", () => {
  it("parse ## sections và serialize lại", () => {
    const raw = `Mở đầu ngắn.

## Mục một
Nội dung A

## Mục hai
Nội dung B`;
    const parsed = parsePolicyContent(raw);
    expect(parsed.intro).toBe("Mở đầu ngắn.");
    expect(parsed.sections).toHaveLength(2);
    expect(parsed.sections[0].heading).toBe("Mục một");
    expect(parsed.sections[0].body).toBe("Nội dung A");
    const again = serializePolicyContent(parsed.intro, parsed.sections);
    expect(again).toContain("## Mục một");
    expect(again).toContain("Nội dung B");
  });
});
