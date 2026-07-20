/** Route loading — skeleton khớp hero + toolbar 1 hàng. */
export default function BlogLoading() {
  return (
    <main className="bg-bg pt-32 md:pt-40">
      <div className="mx-auto max-w-[1200px] space-y-3 px-6 pb-8 md:px-10">
        <div className="h-16 w-[min(100%,280px)] animate-pulse rounded-md bg-ink/5 md:h-24 md:w-[380px]" />
        <div className="h-4 w-56 animate-pulse rounded bg-ink/5" />
      </div>
      <div className="border-y border-ink/10">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-3 px-6 py-4 md:flex-row md:items-center md:justify-between md:px-10">
          <div className="flex gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-9 w-20 animate-pulse rounded-full bg-ink/5"
              />
            ))}
          </div>
          <div className="h-10 w-full max-w-[240px] animate-pulse rounded-full bg-ink/5" />
        </div>
      </div>
      <div className="mx-auto mt-10 grid max-w-[1200px] grid-cols-1 gap-6 px-6 pb-20 sm:grid-cols-2 md:px-10 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3">
            <div className="aspect-[4/5] animate-pulse rounded-[var(--radius-xl)] bg-ink/5" />
            <div className="h-3 w-20 animate-pulse rounded bg-ink/5" />
            <div className="h-6 w-full animate-pulse rounded bg-ink/5" />
          </div>
        ))}
      </div>
    </main>
  );
}
