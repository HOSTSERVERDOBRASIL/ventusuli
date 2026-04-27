"use client";

import { useEffect, useState } from "react";
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
  const [pointsInput, setPointsInput] = useState<Record<string, string>>({});
  const [calculations, setCalculations] = useState<Record<string, CalculationResult>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadRewards = async () => {
    setLoading(true);
    setError(null);
    try {
      const [response, ledgerResponse, summaryResponse] = await Promise.all([
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
      ]);
      const payload = (await response.json()) as RewardsResponse;
      if (!response.ok) throw new Error("rewards_unavailable");
      const ledgerPayload = (await ledgerResponse.json()) as { data?: LedgerEntry[] };
      const summaryPayload = (await summaryResponse.json()) as { data?: PointSummary };
      setItems(payload.data ?? []);
      setBalance(payload.currentBalance ?? 0);
      setPolicy(payload.pointsPolicy ?? null);
      setLedger(ledgerResponse.ok ? ledgerPayload.data ?? [] : []);
      setPointSummary(summaryResponse.ok ? summaryPayload.data ?? { pointsExpiringIn30Days: 0 } : { pointsExpiringIn30Days: 0 });
    } catch (error) {
      setItems([]);
      setLedger([]);
      setPointSummary({ pointsExpiringIn30Days: 0 });
      setError(
        error instanceof Error
          ? error.message
          : "Nao foi possivel carregar o catalogo de recompensas.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!hydrated) return;
    void loadRewards();
  }, [accessToken, hydrated]);

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
        <MetricCard label="Saldo atual" value={`${balance} pts`} tone="highlight" />
        <MetricCard label="Itens disponiveis" value={String(items.length)} />
        <MetricCard label="A expirar" value={`${pointSummary.pointsExpiringIn30Days} pts`} />
      </div>

      {policy ? (
        <SectionCard
          title="Politica de pontos"
          description={`Cada ponto vale ${BRL.format(policy.pointValueCents / 100)} em descontos. Validade: ${policy.expirationMonths} meses.`}
        >
          <p className="text-sm leading-6 text-slate-200">{policy.athletePolicyText}</p>
        </SectionCard>
      ) : null}

      <SectionCard title="Catalogo" description="Selecione um item, simule e finalize o resgate">
        {loading ? (
          <LoadingState lines={5} />
        ) : error ? (
          <EmptyState
            title="CatÃ¡logo indisponÃ­vel"
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
