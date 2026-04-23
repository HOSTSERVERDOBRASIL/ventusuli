export default function MinhasInscricoesLoading() {
  return (
    <div className="min-h-[70vh] space-y-6 rounded-3xl bg-[#0A1628] p-4 sm:p-6">
      <header className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="surface-shimmer h-8 w-56 rounded-md" />
          <div className="surface-shimmer h-4 w-64 rounded-md" />
        </div>
        <div className="surface-shimmer h-10 w-40 rounded-xl" />
      </header>

      <section className="rounded-2xl border border-white/10 bg-[#0F2743]/40 p-4">
        <div className="surface-shimmer mb-3 h-5 w-28 rounded-md" />
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

