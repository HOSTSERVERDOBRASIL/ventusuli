import { Lock, Medal } from "lucide-react";
import type { GamificationAchievementSnapshot } from "@/lib/gamification/types";

type Props = {
  achievements: GamificationAchievementSnapshot[];
};

export function AchievementGrid({ achievements }: Props) {
  const unlockedCount = achievements.filter((achievement) => achievement.unlocked).length;

  return (
    <section className="rounded-xl border border-[#24486f] bg-[#0f233d] p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-white">Conquistas</h2>
          <p className="text-sm text-[#8eb0dc]">Marcos de distancia, consistencia e provas.</p>
        </div>
        <span className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1 text-sm font-semibold text-white">
          {unlockedCount}/{achievements.length}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {achievements.map((achievement) => {
          const unlocked = achievement.unlocked;
          const Icon = unlocked ? Medal : Lock;

          return (
            <article
              key={achievement.id}
              className={`min-h-[150px] rounded-lg border p-3 transition ${
                unlocked
                  ? "border-amber-300/35 bg-amber-300/10"
                  : "border-white/10 bg-slate-950/20 opacity-70"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-bold ${
                    unlocked
                      ? "border-amber-300/45 bg-amber-300/15 text-amber-100"
                      : "border-slate-500/40 bg-slate-800/50 text-slate-300"
                  }`}
                >
                  {achievement.badge}
                </span>
                <Icon className={`h-4 w-4 ${unlocked ? "text-amber-200" : "text-slate-500"}`} />
              </div>
              <h3 className="mt-3 text-sm font-bold text-white">{achievement.name}</h3>
              <p className="mt-1 text-xs leading-5 text-[#9bb8dd]">{achievement.description}</p>
              <p className="mt-3 text-xs font-semibold text-[#f5a623]">+{achievement.xpReward} XP</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
