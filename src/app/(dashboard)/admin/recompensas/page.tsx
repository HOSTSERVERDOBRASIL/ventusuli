"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ActionButton } from "@/components/system/action-button";
import { DataTable, type DataTableColumn } from "@/components/system/data-table";
import { EmptyState } from "@/components/system/empty-state";
import { LoadingState } from "@/components/system/loading-state";
import { PageHeader } from "@/components/system/page-header";
import { SectionCard } from "@/components/system/section-card";
import { StatusBadge } from "@/components/system/status-badge";
import { uploadImageFile } from "@/services/upload-service";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";

interface RewardItem {
  id: string;
  name: string;
  category: string;
  imageUrl: string | null;
  pointsCost: number;
  cashPriceCents: number;
  stockQuantity: number;
  active: boolean;
  maxPointsDiscountPercent: number;
  minimumCashCents: number;
  allowMixed: boolean;
  allowPoints: boolean;
  allowCash: boolean;
}

interface RewardsPayload {
  data: RewardItem[];
}

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const initialForm = {
  name: "",
  category: "Kit",
  imageUrl: "",
  pointsCost: "200",
  cashPriceCents: "5900",
  stockQuantity: "10",
  maxPointsDiscountPercent: "40",
  minimumCashCents: "0",
  allowPoints: true,
  allowCash: true,
  allowMixed: true,
};

export default function AdminRecompensasPage() {
  const { accessToken } = useAuthToken();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<RewardItem[]>([]);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/rewards?limit=200", { cache: "no-store" });
      const payload = (await response.json()) as RewardsPayload;
      if (!response.ok) throw new Error("admin_rewards_unavailable");
      setItems(payload.data ?? []);
    } catch {
      toast.error("Nao foi possivel carregar as recompensas do admin.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const summary = useMemo(() => {
    const active = items.filter((item) => item.active).length;
    const stock = items.reduce((sum, item) => sum + item.stockQuantity, 0);
    return { active, stock };
  }, [items]);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);

    try {
      const response = await fetch("/api/admin/rewards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          category: form.category,
          description: null,
          imageUrl: form.imageUrl.trim() ? form.imageUrl.trim() : null,
          pointsCost: Number(form.pointsCost),
          cashPriceCents: Number(form.cashPriceCents),
          allowPoints: form.allowPoints,
          allowCash: form.allowCash,
          allowMixed: form.allowMixed,
          maxPointsDiscountPercent: Number(form.maxPointsDiscountPercent),
          minimumCashCents: Number(form.minimumCashCents),
          stockQuantity: Number(form.stockQuantity),
          active: true,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: { message?: string } };
        throw new Error(payload.error?.message ?? "Nao foi possivel criar item.");
      }

      toast.success("Item de recompensa criado.");
      setForm(initialForm);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao criar item.");
    } finally {
      setSaving(false);
    }
  };

  const patchItem = async (id: string, body: object) => {
    const response = await fetch(`/api/admin/rewards/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: { message?: string } };
      throw new Error(payload.error?.message ?? "Falha ao atualizar item.");
    }
  };

  const adjustStock = async (id: string) => {
    const raw = window.prompt("Ajuste de estoque (ex: 5 ou -3):", "1");
    if (!raw) return;
    const adjustment = Number(raw);
    if (!Number.isInteger(adjustment)) return;

    try {
      const response = await fetch(`/api/admin/rewards/${id}/stock`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adjustment, reason: "Ajuste manual via painel" }),
      });
      if (!response.ok) throw new Error("stock_update_error");
      toast.success("Estoque atualizado.");
      await load();
    } catch {
      toast.error("Nao foi possivel ajustar o estoque.");
    }
  };

  const columns: DataTableColumn<RewardItem>[] = [
    {
      key: "name",
      header: "Item",
      cell: (row) => (
        <div className="flex items-center gap-2">
          {row.imageUrl ? (
            <div className="h-10 w-10 overflow-hidden rounded-lg border border-white/10 bg-[#0f233d]">
              <img
                src={row.imageUrl}
                alt={`Imagem de ${row.name}`}
                className="h-full w-full object-cover"
              />
            </div>
          ) : null}
          <div>
            <p className="font-semibold text-white">{row.name}</p>
            <p className="text-xs text-slate-400">{row.category}</p>
          </div>
        </div>
      ),
      className: "min-w-[220px]",
    },
    { key: "price", header: "Preco", cell: (row) => BRL.format(row.cashPriceCents / 100) },
    { key: "points", header: "Pontos", cell: (row) => `${row.pointsCost} pts` },
    {
      key: "policy",
      header: "Troca",
      cell: (row) =>
        row.allowMixed
          ? `Pontos + PIX (max. ${row.maxPointsDiscountPercent}%)`
          : row.allowPoints && row.cashPriceCents === 0
            ? "Somente pontos"
            : row.allowCash && !row.allowPoints
              ? "Somente PIX"
              : "Pontos",
      className: "min-w-[170px]",
    },
    { key: "stock", header: "Estoque", cell: (row) => String(row.stockQuantity) },
    {
      key: "active",
      header: "Status",
      cell: (row) => (
        <StatusBadge
          label={row.active ? "ATIVO" : "INATIVO"}
          tone={row.active ? "positive" : "neutral"}
        />
      ),
    },
    {
      key: "actions",
      header: "AÃ§Ãµes",
      className: "min-w-[160px]",
      cell: (row) => (
        <div className="flex flex-nowrap gap-1.5">
          <label className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border border-[#2f5d8f]/60 bg-[#12355d] px-2.5 text-[11px] font-semibold text-[#dce9ff] transition hover:bg-[#18436f] whitespace-nowrap">
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.currentTarget.value = "";
                if (!file) return;
                try {
                  const uploaded = await uploadImageFile(file, "rewards", accessToken);
                  await patchItem(row.id, { imageUrl: uploaded.url });
                  toast.success("Imagem atualizada.");
                  await load();
                } catch {
                  toast.error("Falha ao atualizar imagem.");
                }
              }}
            />
            Upload img
          </label>
          <button
            type="button"
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-white/[0.1] bg-white/[0.04] px-2.5 text-[11px] font-semibold text-white/70 transition hover:bg-white/[0.09] hover:text-white whitespace-nowrap"
            onClick={async () => {
              try {
                await patchItem(row.id, { imageUrl: null });
                toast.success("Imagem removida.");
                await load();
              } catch {
                toast.error("Falha ao remover imagem.");
              }
            }}
          >
            Remover img
          </button>
          <button
            type="button"
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-white/[0.1] bg-white/[0.04] px-2.5 text-[11px] font-semibold text-white/70 transition hover:bg-white/[0.09] hover:text-white whitespace-nowrap"
            onClick={() => void adjustStock(row.id)}
          >
            Estoque
          </button>
          <button
            type="button"
            className={`inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold transition whitespace-nowrap ${
              row.active
                ? "border border-[#FF4444]/30 bg-[#FF4444]/10 text-[#FF4444] hover:bg-[#FF4444]/20"
                : "border border-[#00C853]/30 bg-[#00C853]/10 text-[#00C853] hover:bg-[#00C853]/20"
            }`}
            onClick={async () => {
              try {
                await patchItem(row.id, { active: !row.active });
                toast.success("Status atualizado.");
                await load();
              } catch {
                toast.error("Falha ao alternar status.");
              }
            }}
          >
            {row.active ? "Desativar" : "Ativar"}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recompensas admin"
        subtitle="Cadastro, estoque e controle do catalogo de recompensas."
      />

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1.9fr]">
        <SectionCard title="Novo item" description="Crie recompensas para atletas e grupos">
          <form className="space-y-3" onSubmit={handleCreate}>
            <input
              className="w-full rounded-lg border border-white/[0.1] bg-white/[0.05] px-3 py-2 text-[13px] text-white placeholder:text-white/30"
              placeholder="Nome"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
            <input
              className="w-full rounded-lg border border-white/[0.1] bg-white/[0.05] px-3 py-2 text-[13px] text-white placeholder:text-white/30"
              placeholder="Categoria"
              value={form.category}
              onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
              required
            />
            <input
              className="w-full rounded-lg border border-white/[0.1] bg-white/[0.05] px-3 py-2 text-[13px] text-white placeholder:text-white/30"
              placeholder="URL da imagem (opcional)"
              value={form.imageUrl}
              onChange={(event) => setForm((prev) => ({ ...prev, imageUrl: event.target.value }))}
            />
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center rounded-lg border border-white/[0.1] bg-white/[0.08] px-3 py-2 text-[12px] font-medium text-white/80 transition hover:bg-white/[0.14]">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml"
                  className="hidden"
                  disabled={uploadingImage}
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    event.currentTarget.value = "";
                    if (!file) return;
                    setUploadingImage(true);
                    try {
                      const uploaded = await uploadImageFile(file, "rewards", accessToken);
                      setForm((prev) => ({ ...prev, imageUrl: uploaded.url }));
                      toast.success("Imagem enviada.");
                    } catch (error) {
                      toast.error(
                        error instanceof Error ? error.message : "Falha ao enviar imagem.",
                      );
                    } finally {
                      setUploadingImage(false);
                    }
                  }}
                />
                {uploadingImage ? "Enviando..." : "Upload da imagem"}
              </label>
              <button
                type="button"
                className="rounded-lg border border-white/[0.1] bg-transparent px-3 py-2 text-[12px] text-white/70 transition hover:bg-white/[0.08]"
                onClick={() => setForm((prev) => ({ ...prev, imageUrl: "" }))}
              >
                Limpar
              </button>
            </div>
            {form.imageUrl ? (
              <div className="h-28 w-full overflow-hidden rounded-lg border border-white/[0.1] bg-[#0f233d]">
                <img
                  src={form.imageUrl}
                  alt="Preview da recompensa"
                  className="h-full w-full object-cover"
                />
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <input
                className="rounded-lg border border-white/[0.1] bg-white/[0.05] px-3 py-2 text-[13px] text-white"
                placeholder="Pontos"
                type="number"
                value={form.pointsCost}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, pointsCost: event.target.value }))
                }
                required
              />
              <input
                className="rounded-lg border border-white/[0.1] bg-white/[0.05] px-3 py-2 text-[13px] text-white"
                placeholder="Preco (centavos)"
                type="number"
                value={form.cashPriceCents}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, cashPriceCents: event.target.value }))
                }
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                className="rounded-lg border border-white/[0.1] bg-white/[0.05] px-3 py-2 text-[13px] text-white"
                placeholder="Estoque"
                type="number"
                value={form.stockQuantity}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, stockQuantity: event.target.value }))
                }
                required
              />
              <input
                className="rounded-lg border border-white/[0.1] bg-white/[0.05] px-3 py-2 text-[13px] text-white"
                placeholder="Max desconto (%)"
                type="number"
                value={form.maxPointsDiscountPercent}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, maxPointsDiscountPercent: event.target.value }))
                }
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                className="rounded-lg border border-white/[0.1] bg-white/[0.05] px-3 py-2 text-[13px] text-white"
                placeholder="Minimo em PIX (centavos)"
                type="number"
                value={form.minimumCashCents}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, minimumCashCents: event.target.value }))
                }
                required
              />
              <div className="rounded-lg border border-white/[0.1] bg-white/[0.05] px-3 py-2 text-[12px] text-white/80">
                Valor do ponto definido em Pontos admin
              </div>
            </div>
            <div className="grid gap-2 rounded-lg border border-white/[0.1] bg-white/[0.04] p-3 text-[12px] text-white/80">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.allowPoints}
                  onChange={(event) => setForm((prev) => ({ ...prev, allowPoints: event.target.checked }))}
                />
                Permitir troca com pontos
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.allowCash}
                  onChange={(event) => setForm((prev) => ({ ...prev, allowCash: event.target.checked }))}
                />
                Permitir pagamento em PIX
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.allowMixed}
                  onChange={(event) => setForm((prev) => ({ ...prev, allowMixed: event.target.checked }))}
                />
                Permitir pontos + PIX
              </label>
            </div>
            <ActionButton type="submit" disabled={saving || !form.name.trim()} className="w-full">
              {saving ? "Salvando..." : "Criar recompensa"}
            </ActionButton>
          </form>
        </SectionCard>

        <SectionCard
          title="Catalogo administrativo"
          description={`Itens ativos: ${summary.active} | Estoque total: ${summary.stock}`}
        >
          {loading ? (
            <LoadingState lines={4} />
          ) : items.length === 0 ? (
            <EmptyState
              title="Nenhum item cadastrado"
              description="Crie o primeiro item no formulario ao lado."
            />
          ) : (
            <DataTable columns={columns} data={items} getRowKey={(row) => row.id} />
          )}
        </SectionCard>
      </div>
    </div>
  );
}
