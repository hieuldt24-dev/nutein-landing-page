/** Skeleton bài chi tiết. */
export default function BlogDetailLoading() {
  return (
    <main className="bg-bg pt-32 md:pt-40">
      <div className="mx-auto max-w-[720px] space-y-4 px-6 md:px-10">
        <div className="h-4 w-40 animate-pulse rounded bg-ink/5" />
        <div className="h-12 w-full animate-pulse rounded bg-ink/5" />
        <div className="h-6 w-4/5 animate-pulse rounded bg-ink/5" />
        <div className="mt-6 aspect-[16/10] animate-pulse rounded-[var(--radius-xl)] bg-ink/5" />
        <div className="mt-8 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-4 w-full animate-pulse rounded bg-ink/5" />
          ))}
        </div>
      </div>
    </main>
  );
}
