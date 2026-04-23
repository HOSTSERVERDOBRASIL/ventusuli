export default function ProvasLoading() {
  return (
    <div className="min-h-[70vh] space-y-6 rounded-3xl bg-[#0A1628] p-4 sm:p-6">
      <header className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="surface-shimmer h-8 w-40 rounded-md" />
          <div className="surface-shimmer h-4 w-64 rounded-md" />
        </div>
        <div className="surface-shimmer h-10 w-44 rounded-xl" />
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, idx) => (
          <article key={idx} className="overflow-hidden rounded-2xl border border-white/10 bg-[#102D4B]">
            <div className="surface-shimmer h-36" />
            <div className="space-y-3 p-4">
              <div className="surface-shimmer h-5 w-3/4 rounded" />
              <div className="surface-shimmer h-4 w-1/2 rounded" />
              <div className="surface-shimmer h-4 w-2/3 rounded" />
              <div className="surface-shimmer h-10 w-full rounded-xl" />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

