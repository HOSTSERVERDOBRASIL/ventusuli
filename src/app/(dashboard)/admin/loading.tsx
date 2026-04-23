export default function AdminLoading() {
  return (
    <div className="min-h-[70vh] space-y-6 rounded-3xl bg-[#0A1628] p-4 sm:p-6">
      <header className="space-y-2">
        <div className="surface-shimmer h-8 w-64 rounded-md" />
        <div className="surface-shimmer h-4 w-72 rounded-md" />
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="surface-shimmer h-24 rounded-2xl" />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-white/10 bg-[#0F2743]/40 p-4 lg:col-span-2">
          <div className="surface-shimmer mb-3 h-5 w-40 rounded-md" />
          <div className="overflow-hidden rounded-xl border border-white/10">
            <div className="surface-shimmer h-10 w-full" />
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="surface-shimmer mt-px h-12 w-full" />
            ))}
          </div>
        </section>

        <aside className="rounded-2xl border border-white/10 bg-[#0F2743]/40 p-4">
          <div className="surface-shimmer mb-3 h-5 w-44 rounded-md" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="surface-shimmer h-16 rounded-xl" />
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

