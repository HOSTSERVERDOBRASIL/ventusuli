"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [pointsInput, setPointsInput] = useState<Record<string, string>>({});
  const [calculations, setCalculations] = useState<Record<string, CalculationResult>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadRewards = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/rewards", {
        cache: "no-store",
        headers: buildAuthHeaders(accessToken),
      });
      const payload = (await response.json()) as RewardsResponse;
      if (!response.ok) throw new Error("rewards_unavailable");
      setItems(payload.data ?? []);
      setBalance(payload.currentBalance ?? 0);
    } catch (error) {
      setItems([]);
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

  const totalStock = useMemo(
    () => items.reduce((sum, item) => sum + item.stockQuantity, 0),
    [items],
  );

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
        <MetricCard label="Estoque total" value={String(totalStock)} />
      </div>

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
    </div>
  );
}
