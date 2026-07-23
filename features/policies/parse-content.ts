import type { ParsedPolicyContent } from "./types";

/**
 * Parse nội dung CMS (textarea admin):
 * - Phần trước heading `##` = lead
 * - Mỗi `## tiêu đề` = section (Joy Rush numbered blocks)
 */
export function parsePolicyContent(raw: string): ParsedPolicyContent {
  const text = raw.replace(/\r\n/g, "\n").trim();
  if (!text) return { lead: "", sections: [] };

  const parts = text.split(/^##\s+/m);
  const lead = (parts[0] ?? "").trim();
  const sections = parts.slice(1).map((block) => {
    const newline = block.indexOf("\n");
    if (newline < 0) {
      return { heading: block.trim(), body: "" };
    }
    return {
      heading: block.slice(0, newline).trim(),
      body: block.slice(newline + 1).trim(),
    };
  });

  return { lead, sections };
}
