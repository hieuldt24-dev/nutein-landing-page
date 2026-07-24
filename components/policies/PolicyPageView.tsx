import { formatDate } from "@/lib/utils";
import { parsePolicyContent } from "@/features/policies/parse-content";
import type { StaticPage } from "@/features/policies/types";

interface PolicyPageViewProps {
  page: StaticPage;
}

/**
 * Layout Joy Rush refund-policy: hero title lớn + divider + cột ngày | nội dung.
 * Token Nutein (ink / bg / display / sans) — không copy màu Joy Rush.
 */
export function PolicyPageView({ page }: PolicyPageViewProps) {
  const { lead, sections } = parsePolicyContent(page.content);
  const leadParagraphs = lead
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <main className="bg-bg text-ink">
      <header className="px-6 pt-28 pb-8 md:px-10 md:pt-36 md:pb-10">
        <h1 className="font-display text-center text-[clamp(2.5rem,8vw,4.75rem)] font-bold leading-[0.95] tracking-[-0.04em] text-ink uppercase">
          {page.title}
        </h1>
        <div
          className="mx-auto mt-8 max-w-[1200px] border-t border-ink/25 md:mt-10"
          aria-hidden
        />
      </header>

      <div className="mx-auto grid max-w-[1200px] gap-10 px-6 pb-20 md:grid-cols-[minmax(0,0.28fr)_minmax(0,1fr)] md:gap-12 md:px-10 md:pb-28">
        <aside className="md:pt-1">
          <p className="text-[12px] font-bold tracking-[0.08em] text-ink uppercase">
            Ngày hiệu lực
          </p>
          <p className="mt-1 text-[13px] font-semibold text-ink">
            {formatDate(page.updatedAt)}
          </p>
        </aside>

        <article className="min-w-0">
          {leadParagraphs.length > 0 ? (
            <div className="flex flex-col gap-4">
              {leadParagraphs.map((paragraph, index) => (
                <p
                  key={`lead-${index}`}
                  className="font-display text-[clamp(1.125rem,2.4vw,1.5rem)] font-bold leading-snug tracking-[-0.02em] text-ink"
                >
                  {paragraph}
                </p>
              ))}
            </div>
          ) : null}

          {sections.length > 0 ? (
            <div className={`${leadParagraphs.length > 0 ? "mt-12 md:mt-14" : ""} flex flex-col gap-10 md:gap-12`}>
              {sections.map((section, index) => (
                <section key={`section-${index}`} className="flex flex-col gap-3">
                  <h2 className="font-display text-[clamp(1.35rem,3vw,1.85rem)] font-bold leading-tight tracking-[-0.03em] text-ink">
                    {section.heading}
                  </h2>
                  {section.body ? (
                    <div className="flex flex-col gap-3 text-[15px] leading-relaxed font-medium text-ink/85 md:text-[16px]">
                      {section.body.split(/\n\n+/).map((block, blockIndex) => (
                        <p key={`p-${index}-${blockIndex}`} className="whitespace-pre-line">
                          {block}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </section>
              ))}
            </div>
          ) : null}
        </article>
      </div>
    </main>
  );
}
