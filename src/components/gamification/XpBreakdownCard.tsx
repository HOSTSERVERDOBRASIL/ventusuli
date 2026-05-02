import { BarChart3 } from "lucide-react";
import type { GamificationBreakdownItem } from "@/lib/gamification/types";

type Props = {
  totalXp: number;
  items: GamificationBreakdownItem[];
};

const numberFormatter = new Intl.NumberFormat("pt-BR");

export function XpBreakdownCard({ totalXp, items }: Props) {
  return (
    <section className="rounded-xl border border-[#24486f] bg-[#0f233d] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-2 text-xs uppercase tracking-wide text-[#8eb0dc]">
            <BarChart3 className="h-3.5 w-3.5 text-[#38bdf8]" />
            XP acumulado
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white">{numberFormatter.format(totalXp)} XP</h2>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="grid gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 sm:grid-cols-[1fr_auto]"
          >
            <div>
              <p className="text-sm font-semibold text-white">{item.label}</p>
              <p className="text-xs text-[#8eb0dc]">{item.helper}</p>
            </div>
            <p className="text-sm font-bold text-[#d7eaff]">+{numberFormatter.format(item.value)} XP</p>
          </div>
        ))}
      </div>
    </section>
  );
}
