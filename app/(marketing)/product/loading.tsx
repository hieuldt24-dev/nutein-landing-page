export default function ProductLoading() {
  return (
    <main className="bg-bg px-6 py-12 md:py-16 lg:py-20">
      <div className="mx-auto grid max-w-[1200px] gap-10 lg:grid-cols-3 lg:gap-8">
        <div className="space-y-3">
          <div className="aspect-square animate-pulse rounded-[var(--radius-xl)] bg-border-subtle" />
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square animate-pulse rounded-[var(--radius-md)] bg-border-subtle"
              />
            ))}
          </div>
        </div>
        <div className="hidden space-y-3 lg:block">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-[var(--radius-xl)] bg-border-subtle"
            />
          ))}
        </div>
        <div className="space-y-4">
          <div className="h-10 w-2/3 animate-pulse rounded-full bg-border-subtle" />
          <div className="h-16 w-full animate-pulse rounded-[var(--radius-lg)] bg-border-subtle" />
          <div className="h-40 w-full animate-pulse rounded-[var(--radius-xl)] bg-border-subtle" />
          <div className="h-14 w-full animate-pulse rounded-full bg-border-subtle" />
        </div>
      </div>
    </main>
  );
}
