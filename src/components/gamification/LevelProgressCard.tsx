import { CheckCircle2, TrendingUp } from "lucide-react";
import type { GamificationSnapshot } from "@/lib/gamification/types";

type Props = {
  gamification: GamificationSnapshot;
};

const numberFormatter = new Intl.NumberFormat("pt-BR");

export function LevelProgressCard({ gamification }: Props) {
  const { level, totalXp, stats } = gamification;

  return (
    <section className="rounded-xl border border-[#24486f] bg-[#0f233d] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-2 text-xs uppercase tracking-wide text-[#8eb0dc]">
            <TrendingUp className="h-3.5 w-3.5 text-[#38bdf8]" />
            Nivel atual
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white">{level.name}</h2>
          <p className="mt-1 max-w-xl text-sm text-[#b8d0ee]">{level.description}</p>
        </div>

        <div
          className="rounded-lg border px-3 py-2 text-right"
          style={{
            borderColor: `${level.color}80`,
            backgroundColor: `${level.color}18`,
          }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: level.color }}>
            {level.tier}
          </p>
          <p className="mt-1 text-lg font-bold text-white">{numberFormatter.format(totalXp)} XP</p>
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[#9bb8dd]">
          <span>{level.name}</span>
          <span>{level.nextLevelName ?? "Nivel maximo"}</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-slate-950/70">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${level.progressPercent}%`,
              background: `linear-gradient(90deg, #38bdf8, ${level.color})`,
            }}
          />
        </div>
        <p className="mt-2 text-xs text-[#9bb8dd]">
          {level.nextLevelName
            ? `${numberFormatter.format(level.remainingXp)} XP para ${level.nextLevelName}`
            : "Voce atingiu o nivel maximo."}
        </p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
          <p className="text-xs text-[#8eb0dc]">KM acumulados</p>
          <p className="mt-1 text-lg font-semibold text-white">{stats.totalKm.toLocaleString("pt-BR")} km</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
          <p className="text-xs text-[#8eb0dc]">Melhor sequencia</p>
          <p className="mt-1 text-lg font-semibold text-white">{stats.bestStreakDays} dias</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
          <p className="text-xs text-[#8eb0dc]">Provas concluidas</p>
          <p className="mt-1 text-lg font-semibold text-white">{stats.completedRaces}</p>
        </div>
      </div>

      <div className="mt-5">
        <p className="text-sm font-semibold text-white">Beneficios liberados</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {level.unlocks.map((unlock) => (
            <div key={unlock} className="inline-flex items-center gap-2 text-sm text-[#d7eaff]">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
              <span>{unlock}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
