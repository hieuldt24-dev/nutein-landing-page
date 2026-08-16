/**
 * Parse / serialize nội dung trang tĩnh dạng `## Mục` → blocks UI.
 * Giữ tương thích storefront đang đọc markdown ##.
 */

export interface PolicySectionDraft {
  id: string;
  heading: string;
  body: string;
}

export function parsePolicyContent(content: string): {
  intro: string;
  sections: PolicySectionDraft[];
} {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return { intro: "", sections: [] };
  }

  const parts = normalized.split(/^##\s+/m);
  const intro = (parts[0] ?? "").trim();
  const sections: PolicySectionDraft[] = [];

  for (let i = 1; i < parts.length; i += 1) {
    const block = parts[i] ?? "";
    const nl = block.indexOf("\n");
    const heading = (nl === -1 ? block : block.slice(0, nl)).trim();
    const body = (nl === -1 ? "" : block.slice(nl + 1)).trim();
    sections.push({
      id: `sec-${i}-${heading.slice(0, 12)}`,
      heading,
      body,
    });
  }

  return { intro, sections };
}

export function serializePolicyContent(
  intro: string,
  sections: PolicySectionDraft[],
): string {
  const chunks: string[] = [];
  const introTrim = intro.trim();
  if (introTrim) chunks.push(introTrim);
  for (const section of sections) {
    const h = section.heading.trim() || "Mục mới";
    const b = section.body.trim();
    chunks.push(b ? `## ${h}\n${b}` : `## ${h}`);
  }
  return chunks.join("\n\n");
}
