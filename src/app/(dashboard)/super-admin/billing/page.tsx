"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { ActionButton } from "@/components/system/action-button";
import { DataTable, type DataTableColumn } from "@/components/system/data-table";
import { EmptyState } from "@/components/system/empty-state";
import { LoadingState } from "@/components/system/loading-state";
import { MetricCard } from "@/components/system/metric-card";
import { PageHeader } from "@/components/system/page-header";
import { SectionCard } from "@/components/system/section-card";
import { StatusBadge } from "@/components/system/status-badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";

interface OrganizationOption {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
}

interface PlatformInvoice {
  id: string;
  status: "OPEN" | "PAID" | "OVERDUE" | "CANCELLED";
  amountCents: number;
  dueAt: string;
  paidAt: string | null;
  periodStart: string;
  periodEnd: string;
  description: string | null;
  paymentMethod: string | null;
  documentUrl: string | null;
  organization: OrganizationOption;
}

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const today = new Date().toISOString().slice(0, 10);

function statusTone(status: PlatformInvoice["status"]): "positive" | "warning" | "danger" | "neutral" {
  if (status === "PAID") return "positive";
  if (status === "OVERDUE") return "danger";
  if (status === "OPEN") return "warning";
  return "neutral";
}

export default function SuperAdminBillingPage() {
  const { accessToken } = useAuthToken();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("ALL");
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [invoices, setInvoices] = useState<PlatformInvoice[]>([]);
  const [summary, setSummary] = useState({ paidCents: 0, openCents: 0, overdueCents: 0 });
  const [form, setForm] = useState({
    organizationId: "",
    amount: "",
    dueAt: today,
    periodStart: today,
    periodEnd: today,
    description: "Mensalidade da plataforma Ventu Suli",
    paymentMethod: "PIX",
    documentUrl: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      const [billingResponse, orgResponse] = await Promise.all([
        fetch(`/api/super-admin/billing?status=${status}`, {
          cache: "no-store",
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        }),
        fetch("/api/super-admin/organizations", {
          cache: "no-store",
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        }),
      ]);

      const billingPayload = (await billingResponse.json()) as {
        data?: PlatformInvoice[];
        summary?: typeof summary;
        error?: { message?: string };
      };
      const orgPayload = (await orgResponse.json()) as { data?: OrganizationOption[] };

      if (!billingResponse.ok) throw new Error(billingPayload.error?.message ?? "Falha ao carregar cobrancas.");
      setInvoices(billingPayload.data ?? []);
      setSummary(billingPayload.summary ?? { paidCents: 0, openCents: 0, overdueCents: 0 });
      setOrganizations(orgPayload.data ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao carregar locacao da plataforma.");
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [accessToken, status]);

  const currentMonthRevenue = useMemo(
    () =>
      invoices
        .filter((invoice) => invoice.status === "PAID")
        .reduce((sum, invoice) => sum + invoice.amountCents, 0),
    [invoices],
  );

  const createInvoice = async () => {
    const amount = Number(form.amount.replace(",", "."));
    if (!form.organizationId) {
      toast.error("Selecione a assessoria.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Informe um valor valido.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/super-admin/billing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          organizationId: form.organizationId,
          amountCents: Math.round(amount * 100),
          dueAt: new Date(`${form.dueAt}T12:00:00.000Z`).toISOString(),
          periodStart: new Date(`${form.periodStart}T00:00:00.000Z`).toISOString(),
          periodEnd: new Date(`${form.periodEnd}T23:59:59.999Z`).toISOString(),
          description: form.description.trim() || undefined,
          paymentMethod: form.paymentMethod.trim() || undefined,
          documentUrl: form.documentUrl.trim() || undefined,
        }),
      });

      const payload = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "Falha ao criar cobranca.");

      toast.success("Cobranca da plataforma criada.");
      setForm((current) => ({ ...current, amount: "", documentUrl: "" }));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao criar cobranca.");
    } finally {
      setSaving(false);
    }
  };

  const patchInvoice = async (id: string, action: "MARK_PAID" | "CANCEL" | "REOPEN") => {
    try {
      const response = await fetch(`/api/super-admin/billing/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ action }),
      });
      if (!response.ok) throw new Error("billing_patch_error");
      toast.success("Cobranca atualizada.");
      await load();
    } catch {
      toast.error("Nao foi possivel atualizar a cobranca.");
    }
  };

  const columns: DataTableColumn<PlatformInvoice>[] = [
    {
      key: "org",
      header: "Assessoria",
      className: "min-w-[220px]",
      cell: (row) => (
        <div>
          <p className="font-semibold text-white">{row.organization.name}</p>
          <p className="text-xs text-slate-400">{row.organization.plan} | {row.organization.slug}</p>
        </div>
      ),
    },
    { key: "amount", header: "Valor", cell: (row) => BRL.format(row.amountCents / 100) },
    {
      key: "period",
      header: "Periodo",
      className: "min-w-[180px]",
      cell: (row) =>
        `${format(new Date(row.periodStart), "dd/MM/yyyy", { locale: ptBR })} - ${format(new Date(row.periodEnd), "dd/MM/yyyy", { locale: ptBR })}`,
    },
    { key: "due", header: "Vencimento", cell: (row) => format(new Date(row.dueAt), "dd/MM/yyyy", { locale: ptBR }) },
    { key: "status", header: "Status", cell: (row) => <StatusBadge tone={statusTone(row.status)} label={row.status} /> },
    {
      key: "actions",
      header: "Acoes",
      className: "min-w-[210px]",
      cell: (row) => (
        <div className="flex flex-wrap gap-1.5">
          <button className="rounded-lg border border-white/10 px-2 py-1 text-xs text-white/70" onClick={() => void patchInvoice(row.id, "MARK_PAID")}>Baixar</button>
          <button className="rounded-lg border border-white/10 px-2 py-1 text-xs text-white/70" onClick={() => void patchInvoice(row.id, "REOPEN")}>Reabrir</button>
          <button className="rounded-lg border border-red-400/30 px-2 py-1 text-xs text-red-200" onClick={() => void patchInvoice(row.id, "CANCEL")}>Cancelar</button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Locacao da plataforma" subtitle="Monitoramento financeiro das assessorias que usam o Ventu Suli." />

      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard label="Recebido" value={BRL.format(summary.paidCents / 100)} tone="highlight" />
        <MetricCard label="Em aberto" value={BRL.format(summary.openCents / 100)} />
        <MetricCard label="Atrasado" value={BRL.format(summary.overdueCents / 100)} />
        <MetricCard label="Receita filtrada" value={BRL.format(currentMonthRevenue / 100)} />
      </div>

      <SectionCard title="Nova cobranca" description="Lance mensalidade/licenca da plataforma para uma assessoria">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Select value={form.organizationId} onChange={(event) => setForm((prev) => ({ ...prev, organizationId: event.target.value }))} className="border-white/10 bg-white/5 text-white">
            <option value="">Selecione a assessoria</option>
            {organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
          </Select>
          <Input value={form.amount} onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))} placeholder="Valor R$" className="border-white/10 bg-white/5 text-white" />
          <Input type="date" value={form.dueAt} onChange={(event) => setForm((prev) => ({ ...prev, dueAt: event.target.value }))} className="border-white/10 bg-white/5 text-white" />
          <Input value={form.paymentMethod} onChange={(event) => setForm((prev) => ({ ...prev, paymentMethod: event.target.value }))} placeholder="Forma pagamento" className="border-white/10 bg-white/5 text-white" />
          <Input type="date" value={form.periodStart} onChange={(event) => setForm((prev) => ({ ...prev, periodStart: event.target.value }))} className="border-white/10 bg-white/5 text-white" />
          <Input type="date" value={form.periodEnd} onChange={(event) => setForm((prev) => ({ ...prev, periodEnd: event.target.value }))} className="border-white/10 bg-white/5 text-white" />
          <Input value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} placeholder="Descricao" className="border-white/10 bg-white/5 text-white" />
          <Input value={form.documentUrl} onChange={(event) => setForm((prev) => ({ ...prev, documentUrl: event.target.value }))} placeholder="Comprovante/nota" className="border-white/10 bg-white/5 text-white" />
        </div>
        <div className="mt-3">
          <ActionButton disabled={saving} onClick={() => void createInvoice()}>{saving ? "Criando..." : "Criar cobranca"}</ActionButton>
        </div>
      </SectionCard>

      <SectionCard
        title="Cobrancas da plataforma"
        description="Controle de mensalidades, licencas e inadimplencia por assessoria"
      >
        <div className="mb-3 max-w-xs">
          <Select value={status} onChange={(event) => setStatus(event.target.value)} className="border-white/10 bg-white/5 text-white">
            <option value="ALL">Todos os status</option>
            <option value="OPEN">Em aberto</option>
            <option value="OVERDUE">Atrasado</option>
            <option value="PAID">Pago</option>
            <option value="CANCELLED">Cancelado</option>
          </Select>
        </div>
        {loading ? (
          <LoadingState lines={4} />
        ) : invoices.length === 0 ? (
          <EmptyState title="Sem cobrancas" description="Nenhuma cobranca de plataforma encontrada para o filtro." />
        ) : (
          <DataTable columns={columns} data={invoices} getRowKey={(row) => row.id} />
        )}
      </SectionCard>
    </div>
  );
}
