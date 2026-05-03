"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ActionButton } from "@/components/system/action-button";
import { EmptyState } from "@/components/system/empty-state";
import { LoadingState } from "@/components/system/loading-state";
import { MetricCard } from "@/components/system/metric-card";
import { PageHeader } from "@/components/system/page-header";
import { SectionCard } from "@/components/system/section-card";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { buildAuthHeaders } from "@/services/runtime";

interface RewardItem {
  id: string;
  name: string;
  description: string | null;
  category: string;
  imageUrl: string | null;
  pointsCost: number;
  cashPriceCents: number;
  allowPoints: boolean;
  allowCash: boolean;
  allowMixed: boolean;
  maxPointsDiscountPercent: number;
  minimumCashCents: number;
  stockQuantity: number;
  active: boolean;
}

interface RewardsResponse {
  data: RewardItem[];
  currentBalance: number | null;
  pointsPolicy?: PointPolicy;
}

interface CalculationResult {
  pointsUsed: number;
  cashCents: number;
  maxPointsAllowed: number;
  abatementCents: number;
  explanation: string;
  isValid: boolean;
  validationError?: string;
  item: RewardItem;
  currentBalance: number;
  pointValueCents?: number;
}

interface PointPolicy {
  pointValueCents: number;
  expirationMonths: number;
  athletePolicyText: string;
}

interface LedgerEntry {
  id: string;
  type: string;
  typeLabel?: string;
  sourceType: string;
  sourceLabel?: string;
  points: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
  event: { id: string; name: string | null } | null;
}

interface PointSummary {
  pointsExpiringIn30Days: number;
}

interface LoyaltyLevelSummary {
  key: string;
  name: string;
  multiplier: number;
  benefits: string[];
  progressPercent: number;
  progressInLevel: number;
  nextLevelPoints: number;
  nextLevel: {
    key: string;
    name: string;
    multiplier: number;
    minLifetimePoints: number;
  } | null;
}

interface LoyaltyMission {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: string;
  rewardPoints: number;
  progressValue: number;
  targetValue: number;
  progressPercent: number;
  repeatable: boolean;
  status: string;
  eligible: boolean;
  levelRequirement: string | null;
}

interface LoyaltyBadge {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
  category: string;
  awardedAt: string | null;
  unlocked: boolean;
}

interface LoyaltySnapshot {
  availablePoints: number;
  lifetimePoints: number;
  pointsExpiringIn30Days: number;
  segment: string;
  streak: {
    current: number;
    best: number;
    lastWeekAt: string | null;
  };
  level: LoyaltyLevelSummary;
  levels: Array<{
    key: string;
    name: string;
    minLifetimePoints: number;
    multiplier: number;
    benefits: string[];
  }>;
  missions: LoyaltyMission[];
  badges: LoyaltyBadge[];
}

interface UserPointActivityEntry {
  id: string;
  activityId: string;
  points: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  source: "ADMIN" | "USER";
  note: string | null;
  proofUrl: string | null;
  createdAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  activityName: string | null;
}

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function randomIdempotencyKey(rewardItemId: string): string {
  return `redeem-${rewardItemId}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function RecompensasPage() {
  const { hydrated, accessToken } = useAuthToken();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<RewardItem[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [policy, setPolicy] = useState<PointPolicy | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [pointSummary, setPointSummary] = useState<PointSummary>({ pointsExpiringIn30Days: 0 });
  const [loyalty, setLoyalty] = useState<LoyaltySnapshot | null>(null);
  const [activityEntries, setActivityEntries] = useState<UserPointActivityEntry[]>([]);
  const [pointsInput, setPointsInput] = useState<Record<string, string>>({});
  const [calculations, setCalculations] = useState<Record<string, CalculationResult>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [claimingMissionId, setClaimingMissionId] = useState<string | null>(null);

  const loadRewards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [response, ledgerResponse, summaryResponse, loyaltyResponse, activityEntriesResponse] = await Promise.all([
        fetch("/api/rewards", {
          cache: "no-store",
          headers: buildAuthHeaders(accessToken),
        }),
        fetch("/api/points/me/ledger?page=1&limit=8", {
          cache: "no-store",
          headers: buildAuthHeaders(accessToken),
        }),
        fetch("/api/points/me", {
          cache: "no-store",
          headers: buildAuthHeaders(accessToken),
        }),
        fetch("/api/loyalty/me", {
          cache: "no-store",
          headers: buildAuthHeaders(accessToken),
        }),
        fetch("/api/points/activity-entries/me?page=1&limit=8", {
          cache: "no-store",
          headers: buildAuthHeaders(accessToken),
        }),
      ]);
      const payload = (await response.json()) as RewardsResponse;
      if (!response.ok) throw new Error("rewards_unavailable");
      const ledgerPayload = (await ledgerResponse.json()) as { data?: LedgerEntry[] };
      const summaryPayload = (await summaryResponse.json()) as { data?: PointSummary };
      const loyaltyPayload = (await loyaltyResponse.json()) as { data?: LoyaltySnapshot };
      const activityEntriesPayload = (await activityEntriesResponse.json()) as { data?: UserPointActivityEntry[] };
      setItems(payload.data ?? []);
      setBalance(payload.currentBalance ?? 0);
      setPolicy(payload.pointsPolicy ?? null);
      setLedger(ledgerResponse.ok ? ledgerPayload.data ?? [] : []);
      setPointSummary(summaryResponse.ok ? summaryPayload.data ?? { pointsExpiringIn30Days: 0 } : { pointsExpiringIn30Days: 0 });
      setLoyalty(loyaltyResponse.ok ? loyaltyPayload.data ?? null : null);
      setActivityEntries(activityEntriesResponse.ok ? activityEntriesPayload.data ?? [] : []);
    } catch (error) {
      setItems([]);
      setLedger([]);
      setPointSummary({ pointsExpiringIn30Days: 0 });
      setLoyalty(null);
      setActivityEntries([]);
      setError(
        error instanceof Error
          ? error.message
          : "Nao foi possivel carregar o catalogo de recompensas.",
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!hydrated) return;
    void loadRewards();
  }, [hydrated, loadRewards]);

  const handleCalculate = async (item: RewardItem) => {
    setProcessingId(item.id);
    try {
      const pointsRaw = pointsInput[item.id];
      const pointsToUse = pointsRaw && pointsRaw.trim().length > 0 ? Number(pointsRaw) : undefined;

      const response = await fetch("/api/rewards/calculate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...buildAuthHeaders(accessToken),
        },
        body: JSON.stringify({ rewardItemId: item.id, pointsToUse }),
      });

      const payload = (await response.json()) as {
        data?: CalculationResult;
        error?: { message?: string };
      };
      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "calc_error");
      }

      setCalculations((prev) => ({ ...prev, [item.id]: payload.data as CalculationResult }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao calcular resgate.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleRedeem = async (item: RewardItem) => {
    setProcessingId(item.id);
    try {
      const pointsRaw = pointsInput[item.id];
      const pointsToUse = pointsRaw && pointsRaw.trim().length > 0 ? Number(pointsRaw) : undefined;

      const response = await fetch("/api/rewards/redeem", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...buildAuthHeaders(accessToken),
        },
        body: JSON.stringify({
          rewardItemId: item.id,
          pointsToUse,
          idempotencyKey: randomIdempotencyKey(item.id),
        }),
      });

      const payload = (await response.json()) as {
        redemption?: { id: string; status: string };
        paymentUrl?: string;
        error?: { message?: string };
      };

      if (!response.ok || !payload.redemption) {
        throw new Error(payload.error?.message ?? "redeem_error");
      }

      if (payload.paymentUrl) {
        toast.success("Resgate criado com pendencia. Finalize o pagamento em Meus resgates.");
      } else {
        toast.success("Resgate aprovado com sucesso.");
      }

      await loadRewards();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao concluir resgate.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleClaimMission = async (mission: LoyaltyMission) => {
    setClaimingMissionId(mission.id);
    try {
      const response = await fetch(`/api/missions/${mission.id}/claim`, {
        method: "POST",
        headers: buildAuthHeaders(accessToken),
      });
      const payload = (await response.json()) as { error?: { message?: string }; alreadyClaimed?: boolean };
      if (!response.ok) throw new Error(payload.error?.message ?? "Falha ao resgatar missão.");
      toast.success(payload.alreadyClaimed ? "Missão já resgatada." : `Missão resgatada: +${mission.rewardPoints} pts.`);
      await loadRewards();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao resgatar missão.");
    } finally {
      setClaimingMissionId(null);
    }
  };

  const activityStatusTone = (status: UserPointActivityEntry["status"]) => {
    if (status === "APPROVED") return "border-emerald-300/20 bg-emerald-400/10 text-emerald-100";
    if (status === "REJECTED") return "border-rose-300/20 bg-rose-400/10 text-rose-100";
    return "border-amber-300/20 bg-amber-400/10 text-amber-100";
  };

  const activityStatusLabel = (status: UserPointActivityEntry["status"]) => {
    if (status === "APPROVED") return "Aprovado";
    if (status === "REJECTED") return "Reprovado";
    return "Pendente";
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recompensas"
        subtitle="Troque seus pontos por itens da assessoria e acompanhe o custo em dinheiro quando houver complemento."
        actions={
          <ActionButton asChild intent="secondary">
            <Link href="/meus-resgates">Meus resgates</Link>
          </ActionButton>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Saldo atual" value={`${loyalty?.availablePoints ?? balance} pts`} tone="highlight" />
        <MetricCard label="Lifetime points" value={`${loyalty?.lifetimePoints ?? balance} pts`} />
        <MetricCard label="A expirar" value={`${loyalty?.pointsExpiringIn30Days ?? pointSummary.pointsExpiringIn30Days} pts`} />
      </div>

      {loyalty ? (
        <SectionCard
          title={loyalty.level.name}
          description={`Multiplicador ${loyalty.level.multiplier.toFixed(1)}x | Segmento ${loyalty.segment} | Streak ${loyalty.streak.current} semanas`}
        >
          <div className="space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm text-slate-300">
                <span>Progresso de nivel</span>
                <span>
                  {loyalty.level.nextLevel
                    ? `${loyalty.level.nextLevelPoints} pts para ${loyalty.level.nextLevel.name}`
                    : "Nivel maximo"}
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-900/70">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#38bdf8,#22c55e)] transition-all"
                  style={{ width: `${loyalty.level.progressPercent}%` }}
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-[#102640] p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Beneficios ativos</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {loyalty.level.benefits.map((benefit) => (
                    <span
                      key={benefit}
                      className="rounded-full border border-sky-300/20 bg-sky-400/10 px-3 py-1 text-xs text-sky-100"
                    >
                      {benefit}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-[#102640] p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Conquistas</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {loyalty.badges.filter((badge) => badge.unlocked).length === 0 ? (
                    <span className="text-sm text-slate-400">Suas badges desbloqueadas aparecerao aqui.</span>
                  ) : (
                    loyalty.badges
                      .filter((badge) => badge.unlocked)
                      .slice(0, 4)
                      .map((badge) => (
                        <span
                          key={badge.id}
                          className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-100"
                        >
                          {badge.name}
                        </span>
                      ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </SectionCard>
      ) : null}

      {loyalty ? (
        <SectionCard title="Missoes" description="Objetivos ativos para acelerar nivel, engajamento e recorrencia">
          {loyalty.missions.length === 0 ? (
            <EmptyState title="Sem missoes ativas" description="As proximas missoes aparecerao aqui." />
          ) : (
            <div className="grid gap-3 lg:grid-cols-3">
              {loyalty.missions.map((mission) => (
                <article key={mission.id} className="rounded-2xl border border-white/10 bg-[#102640] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">{mission.type}</p>
                      <h3 className="mt-1 text-lg font-semibold text-white">{mission.name}</h3>
                    </div>
                    <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-2.5 py-1 text-xs text-amber-100">
                      +{mission.rewardPoints} pts
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">
                    {mission.description ?? "Missao ativa para acelerar seu progresso no programa."}
                  </p>
                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                      <span>
                        {mission.progressValue}/{mission.targetValue}
                      </span>
                      <span>{mission.status}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-900/70">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,#f59e0b,#38bdf8)]"
                        style={{ width: `${mission.progressPercent}%` }}
                      />
                    </div>
                    {mission.status === "COMPLETED" ? (
                      <ActionButton
                        size="sm"
                        className="mt-4 w-full"
                        disabled={claimingMissionId === mission.id}
                        onClick={() => void handleClaimMission(mission)}
                      >
                        {claimingMissionId === mission.id ? "Resgatando..." : "Resgatar missão"}
                      </ActionButton>
                    ) : mission.status === "CLAIMED" ? (
                      <div className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-center text-xs font-semibold text-emerald-100">
                        Pontos resgatados
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </SectionCard>
      ) : null}

      {policy ? (
        <SectionCard
          title="Politica de pontos"
          description={`Cada ponto vale ${BRL.format(policy.pointValueCents / 100)} em descontos. Validade: ${policy.expirationMonths} meses.`}
        >
          <p className="text-sm leading-6 text-slate-200">{policy.athletePolicyText}</p>
        </SectionCard>
      ) : null}

      <SectionCard
        title="Origem dos pontos"
        description="Pontos sao gerados automaticamente por eventos internos e ficam auditaveis no extrato."
      >
        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.35fr]">
          <div className="rounded-2xl border border-white/10 bg-[#102640] p-4">
            <p className="text-sm font-semibold text-white">Regras automaticas</p>
            <div className="mt-4 space-y-2 text-sm text-slate-300">
              {[
                "Inscricao confirmada",
                "Participacao validada em prova",
                "Treino ou desafio concluido",
                "Compra de foto ou recompensa elegivel",
              ].map((label) => (
                <div key={label} className="rounded-xl border border-white/10 bg-[#0b1f35] px-3 py-2">
                  {label}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {activityEntries.length === 0 ? (
              <EmptyState
                title="Sem lancamentos por atividade"
                description="Lancamentos aprovados pela administracao aparecerao aqui."
              />
            ) : (
              activityEntries.map((entry) => (
                <article key={entry.id} className="rounded-2xl border border-white/10 bg-[#102640] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-white">{entry.activityName ?? "Atividade"}</p>
                      <p className="text-xs text-slate-400">
                        {new Date(entry.createdAt).toLocaleDateString("pt-BR")} | {entry.source === "USER" ? "Registro anterior do atleta" : "Lancado pela assessoria"}
                      </p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs ${activityStatusTone(entry.status)}`}>
                      {activityStatusLabel(entry.status)}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-200">
                    <span className="rounded-full border border-sky-300/20 bg-sky-400/10 px-3 py-1 text-sky-100">
                      {entry.points} pts
                    </span>
                    {entry.proofUrl ? (
                      <a href={entry.proofUrl} target="_blank" rel="noreferrer" className="text-sky-200 underline underline-offset-2">
                        Ver comprovante
                      </a>
                    ) : null}
                  </div>
                  {entry.note ? <p className="mt-3 text-sm text-slate-300">{entry.note}</p> : null}
                </article>
              ))
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Catalogo" description="Selecione um item, simule e finalize o resgate">
        {loading ? (
          <LoadingState lines={5} />
        ) : error ? (
          <EmptyState
            title="Catálogo indisponível"
            description={error}
            action={
              <ActionButton intent="secondary" onClick={() => void loadRewards()}>
                Tentar novamente
              </ActionButton>
            }
          />
        ) : items.length === 0 ? (
          <EmptyState
            title="Sem recompensas disponiveis"
            description="Nenhum item ativo com estoque no momento."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => {
              const calculation = calculations[item.id];
              const busy = processingId === item.id;

              return (
                <article
                  key={item.id}
                  className="rounded-2xl border border-white/10 bg-[#102640] p-4"
                >
                  {item.imageUrl ? (
                    <div className="mb-3 h-36 w-full overflow-hidden rounded-xl border border-white/10 bg-[#0c1d33]">
                      <img
                        src={item.imageUrl}
                        alt={`Imagem de ${item.name}`}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : null}
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-slate-400">
                      {item.category}
                    </p>
                    <h3 className="text-lg font-semibold text-white">{item.name}</h3>
                    <p className="text-sm text-slate-300">
                      {item.description ?? "Sem descricao adicional."}
                    </p>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-lg border border-white/10 bg-[#0c1d33] p-2 text-slate-200">
                      <p className="text-xs text-slate-400">Pontos</p>
                      <p className="font-semibold">{item.pointsCost} pts</p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-[#0c1d33] p-2 text-slate-200">
                      <p className="text-xs text-slate-400">Preco</p>
                      <p className="font-semibold">{BRL.format(item.cashPriceCents / 100)}</p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-lg border border-white/10 bg-[#0c1d33] p-2 text-sm text-slate-200">
                    Estoque: <span className="font-semibold">{item.stockQuantity}</span>
                    <span className="ml-2 text-xs text-slate-400">
                      {item.allowMixed
                        ? "pontos + PIX"
                        : item.allowPoints && item.cashPriceCents === 0
                          ? "somente pontos"
                          : item.allowCash
                            ? "PIX"
                            : "pontos"}
                    </span>
                  </div>

                  <div className="mt-3 space-y-2">
                    <label className="text-xs text-slate-400">Pontos para usar (opcional)</label>
                    <input
                      type="number"
                      min={0}
                      value={pointsInput[item.id] ?? ""}
                      onChange={(event) =>
                        setPointsInput((prev) => ({
                          ...prev,
                          [item.id]: event.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-white/15 bg-[#0b1f35] px-3 py-2 text-sm text-white outline-none"
                      placeholder="Ex: 120"
                    />
                  </div>

                  {calculation ? (
                    <div className="mt-3 rounded-lg border border-sky-300/30 bg-sky-500/10 p-2 text-xs text-sky-100">
                      {calculation.explanation}
                    </div>
                  ) : null}

                  <div className="mt-4 flex gap-2">
                    <ActionButton
                      intent="secondary"
                      className="flex-1"
                      disabled={busy}
                      onClick={() => void handleCalculate(item)}
                    >
                      Simular
                    </ActionButton>
                    <ActionButton
                      className="flex-1"
                      disabled={busy}
                      onClick={() => void handleRedeem(item)}
                    >
                      Resgatar
                    </ActionButton>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Extrato de pontos" description="Origem dos creditos, debitos, resgates e expiracoes">
        {ledger.length === 0 ? (
          <EmptyState title="Sem movimentacoes" description="Seus pontos aparecerao aqui quando forem lancados." />
        ) : (
          <div className="space-y-2">
            {ledger.map((entry) => (
              <div
                key={entry.id}
                className="grid gap-2 rounded-xl border border-white/10 bg-[#102640] p-3 text-sm text-slate-200 md:grid-cols-[1fr_auto]"
              >
                <div>
                  <p className="font-semibold text-white">{entry.sourceLabel ?? entry.sourceType}</p>
                  <p className="text-xs text-slate-400">
                    {entry.description}
                    {entry.event?.name ? ` | ${entry.event.name}` : ""}
                  </p>
                </div>
                <div className="text-left md:text-right">
                  <p className={entry.points >= 0 ? "font-semibold text-emerald-300" : "font-semibold text-rose-300"}>
                    {entry.points >= 0 ? "+" : ""}
                    {entry.points} pts
                  </p>
                  <p className="text-xs text-slate-400">Saldo: {entry.balanceAfter} pts</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
