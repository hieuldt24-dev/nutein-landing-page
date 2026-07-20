"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Search } from "lucide-react";
import {
  BLOG_CATEGORIES,
  BLOG_CATEGORY_ALL,
  RECIPE_FILTERS,
} from "@/features/blog/constants";
import { cn } from "@/lib/utils";

type BlogToolbarProps = {
  category?: string;
  q?: string;
  recipeFilter?: string;
};

/**
 * Một hàng điều khiển: chuyên mục (pills) + search + (Công thức → select bữa).
 * Tránh chồng nhiều hàng pill.
 */
export function BlogToolbar({
  category = "all",
  q: qProp = "",
  recipeFilter,
}: BlogToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(qProp);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushParams = (next: {
    category?: string;
    q?: string;
    recipeFilter?: string | null;
  }) => {
    const params = new URLSearchParams();
    const cat = next.category ?? category;
    const query = next.q !== undefined ? next.q : q;
    const rf =
      next.recipeFilter !== undefined ? next.recipeFilter : recipeFilter;

    if (cat && cat !== "all") params.set("category", cat);
    const trimmed = query.trim();
    if (trimmed) params.set("q", trimmed);
    if (cat === "recipes" && rf) params.set("recipeFilter", rf);

    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const onSearchChange = (value: string) => {
    setQ(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pushParams({ q: value });
    }, 320);
  };

  const pills = [BLOG_CATEGORY_ALL, ...BLOG_CATEGORIES];
  const showRecipeSelect = category === "recipes";

  return (
    <div className="border-y border-ink/10">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-6 py-4 md:flex-row md:items-center md:justify-between md:gap-6 md:px-10 md:py-5">
        <ul className="-mx-1 flex list-none gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {pills.map((pill) => {
            const active = category === pill.id;
            return (
              <li key={pill.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    pushParams({
                      category: pill.id,
                      recipeFilter:
                        pill.id === "recipes" ? recipeFilter ?? null : null,
                    })
                  }
                  aria-pressed={active}
                  className={cn(
                    "rounded-full border-[1.5px] border-ink px-4 py-2 text-[12px] font-extrabold tracking-[0.06em] uppercase transition-colors",
                    active
                      ? "bg-ink text-[var(--color-bg)]"
                      : "bg-transparent text-ink hover:bg-ink/5"
                  )}
                >
                  {pill.label}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="flex w-full shrink-0 flex-col gap-3 sm:flex-row sm:items-center md:w-auto md:justify-end">
          {showRecipeSelect ? (
            <div className="relative min-w-[160px]">
              <label htmlFor="blog-recipe-filter" className="sr-only">
                Lọc theo bữa
              </label>
              <select
                id="blog-recipe-filter"
                value={recipeFilter ?? ""}
                onChange={(e) =>
                  pushParams({
                    recipeFilter: e.target.value ? e.target.value : null,
                  })
                }
                className="w-full appearance-none rounded-full border-[1.5px] border-ink/25 bg-bg py-2.5 pr-10 pl-4 text-[12px] font-bold tracking-[0.04em] text-ink uppercase outline-none focus:border-ink"
              >
                <option value="">Mọi bữa</option>
                {RECIPE_FILTERS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={16}
                strokeWidth={2.2}
                className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-ink/50"
                aria-hidden
              />
            </div>
          ) : null}

          <div className="relative w-full sm:w-[220px] md:w-[240px]">
            <Search
              size={17}
              strokeWidth={2.2}
              className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink/40"
              aria-hidden
            />
            <input
              type="search"
              value={q}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Tìm bài viết…"
              aria-label="Tìm bài viết"
              className="w-full rounded-full border-[1.5px] border-ink/25 bg-bg py-2.5 pr-4 pl-10 text-sm font-semibold text-ink outline-none placeholder:font-medium placeholder:text-ink/40 focus:border-ink"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
