export default function DashboardLoading() {
  return (
    <div className="min-h-[70vh] space-y-6 rounded-3xl bg-[#0A1628] p-4 sm:p-6 lg:p-8">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, idx) => (
          <div key={idx} className="surface-shimmer h-24 rounded-2xl" />
        ))}
      </div>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-[#0F2743]/40 p-4">
        <div className="surface-shimmer h-5 w-44 rounded-md" />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <article key={idx} className="overflow-hidden rounded-xl border border-white/10 bg-[#102D4B]">
              <div className="surface-shimmer h-24" />
              <div className="space-y-2 p-3">
                <div className="surface-shimmer h-3 w-2/3 rounded" />
                <div className="surface-shimmer h-3 w-1/2 rounded" />
                <div className="surface-shimmer h-8 w-full rounded-lg" />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#0F2743]/40 p-4">
        <div className="surface-shimmer mb-3 h-5 w-40 rounded-md" />
        <div className="overflow-hidden rounded-xl border border-white/10">
          <div className="surface-shimmer h-10 w-full" />
          {Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} className="surface-shimmer mt-px h-12 w-full" />
          ))}
        </div>
      </section>
    </div>
  );
}

