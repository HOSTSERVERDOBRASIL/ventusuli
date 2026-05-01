"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format, formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CircleDollarSign,
  ClipboardList,
  FileBarChart2,
  Plus,
  Users,
} from "lucide-react";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { ActionButton } from "@/components/system/action-button";
import { type DataTableColumn, DataTable } from "@/components/system/data-table";
import { EmptyState } from "@/components/system/empty-state";
import { LoadingState } from "@/components/system/loading-state";
import { MetricCard } from "@/components/system/metric-card";
import { ModuleTabs, type ModuleTabItem } from "@/components/system/module-tabs";
import { PageHeader } from "@/components/system/page-header";
import { SectionCard } from "@/components/system/section-card";
import { StatusBadge } from "@/components/system/status-badge";
import { getAdminOverview } from "@/services/admin-service";
import { AdminOverviewData } from "@/services/types";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

type PaymentTone = "positive" | "warning" | "danger" | "neutral";
type AdminOverviewTab = "overview" | "attention" | "activity" | "shortcuts";

function paymentTone(status: string): PaymentTone {
  if (status === "PAID") return "positive";
  if (status === "PENDING") return "warning";
  if (status === "EXPIRED" || status === "CANCELLED") return "danger";
  return "neutral";
}

function paymentLabel(status: string): string {
  if (status === "PAID") return "Pago";
  if (status === "PENDING") return "Pendente";
  if (status === "EXPIRED") return "Expirado";
  if (status === "CANCELLED") return "Cancelado";
  return status;
}

function eventStatusLabel(status: string): string {
  if (status === "PUBLISHED") return "Publicado";
  if (status === "DRAFT") return "Rascunho";
  if (status === "CANCELLED") return "Cancelado";
  if (status === "FINISHED") return "Finalizado";
  return status;
}

export default function AdminOverviewPage() {
  const { accessToken } = useAuthToken();
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AdminOverviewTab>("overview");

  const load = async (cancelledRef?: { value: boolean }) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const payload = await getAdminOverview(accessToken);
      if (!cancelledRef?.value) setData(payload);
    } catch (error) {
      if (!cancelledRef?.value) {
        setData(null);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar os dados administrativos.",
        );
      }
    } finally {
      if (!cancelledRef?.value) setLoading(false);
    }
  };

  useEffect(() => {
    const cancelledRef = { value: false };
    void load(cancelledRef);
    return () => {
      cancelledRef.value = true;
    };
  }, [accessToken]);

  const rows = useMemo(() => data?.report.data ?? [], [data?.report.data]);
  const events = useMemo(() => data?.events ?? [], [data?.events]);

  const now = useMemo(() => new Date(), []);
  const upcomingEvents = useMemo(
    () =>
      events
        .filter((event) => new Date(event.event_date) >= now)
        .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
        .slice(0, 5),
    [events, now],
  );

  const pendingRows = useMemo(() => rows.filter((row) => row.payment_status === "PENDING"), [rows]);
  const pendingAthletes = useMemo(
    () => new Set(pendingRows.map((row) => row.athlete_email)).size,
    [pendingRows],
  );
  const draftEvents = useMemo(
    () => events.filter((event) => event.status === "DRAFT").length,
    [events],
  );

  const dueSoonEvents = useMemo(
    () =>
      events.filter((event) => {
        const eventDate = new Date(event.event_date);
        const diffDays = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return diffDays >= 0 && diffDays <= 14;
      }).length,
    [events, now],
  );

  const attentionItems = useMemo(
    () => [
      {
        id: "pending_finance",
        title: "Cobranças pendentes",
        value: pendingRows.length,
        detail: `${BRL.format((data?.report.totals.totalPendente ?? 0) / 100)} em aberto`,
        href: "/admin/financeiro?status=PENDING&due=ALL",
        tone: "warning" as const,
      },
      {
        id: "draft_events",
        title: "Provas em rascunho",
        value: draftEvents,
        detail: "Podem travar novas inscrições",
        href: "/admin/eventos?status=DRAFT",
        tone: "info" as const,
      },
      {
        id: "due_soon",
        title: "Provas em até 14 dias",
        value: dueSoonEvents,
        detail: "Acompanhe operação e comunicação",
        href: "/admin/eventos?window=next14d",
        tone: "positive" as const,
      },
      {
        id: "athletes_pending",
        title: "Atletas com pendência",
        value: pendingAthletes,
        detail: "Necessitam acompanhamento",
        href: "/admin/atletas?financial=PENDENTE",
        tone: "warning" as const,
      },
    ],
    [
      data?.report.totals.totalPendente,
      draftEvents,
      dueSoonEvents,
      pendingAthletes,
      pendingRows.length,
    ],
  );
  const tabs = useMemo<ModuleTabItem<AdminOverviewTab>[]>(
    () => [
      {
        key: "overview",
        label: "Painel",
        audience: "Diretoria",
        description: "Receita, pendencias, associados e provas publicadas.",
        icon: FileBarChart2,
        metricLabel: "Receita",
        metricValue: BRL.format((data?.metrics.receitaMes ?? 0) / 100),
        metricTone: "info",
      },
      {
        key: "attention",
        label: "Atencao",
        audience: "Operacao",
        description: "Cobranças pendentes, rascunhos e proximas provas.",
        icon: AlertTriangle,
        metricLabel: "Itens",
        metricValue: attentionItems.reduce((sum, item) => sum + item.value, 0),
        metricTone: attentionItems.some((item) => item.tone === "warning") ? "warning" : "positive",
      },
      {
        key: "activity",
        label: "Atividade",
        audience: "Auditoria",
        description: "Ultimas movimentacoes financeiras e inscricoes.",
        icon: ClipboardList,
        metricLabel: "Registros",
        metricValue: rows.length,
        metricTone: rows.length > 0 ? "positive" : "neutral",
      },
      {
        key: "shortcuts",
        label: "Atalhos",
        audience: "Equipe",
        description: "Entrada rapida para os modulos de execucao.",
        icon: ArrowRight,
        metricLabel: "Modulos",
        metricValue: 4,
        metricTone: "info",
      },
    ],
    [attentionItems, data?.metrics.receitaMes, rows.length],
  );

  const recentColumns: DataTableColumn<(typeof rows)[number]>[] = [
    {
      key: "athlete",
      header: "Atleta",
      cell: (row) => row.athlete_name,
      className: "min-w-[160px]",
    },
    { key: "event", header: "Prova", cell: (row) => row.event_name, className: "min-w-[220px]" },
    { key: "amount", header: "Valor", cell: (row) => BRL.format(row.amount_cents / 100) },
    {
      key: "status",
      header: "Status",
      cell: (row) => (
        <StatusBadge
          tone={paymentTone(row.payment_status)}
          label={paymentLabel(row.payment_status)}
        />
      ),
      className: "min-w-[150px]",
    },
    {
      key: "when",
      header: "Quando",
      cell: (row) =>
        formatDistanceToNowStrict(new Date(row.created_at), { addSuffix: true, locale: ptBR }),
      className: "min-w-[150px]",
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <LoadingState lines={2} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} className="surface-shimmer h-28 rounded-2xl" />
          ))}
        </div>
        <LoadingState lines={5} />
      </div>
    );
  }

  if (!data) {
    return (
      <EmptyState
        title="Painel indisponível"
        description={errorMessage ?? "Não foi possível carregar os dados administrativos."}
        action={<ActionButton onClick={() => void load()}>Tentar novamente</ActionButton>}
      />
    );
  }

  return (
    <div className="space-y-6 text-white">
      <PageHeader
        title="Cockpit administrativo"
        subtitle="Diagnóstico da operação em segundos, com foco no que exige ação agora."
        actions={
          <>
            <ActionButton asChild>
              <Link href="/admin/eventos/novo">
                <Plus className="mr-2 h-4 w-4" /> Nova prova
              </Link>
            </ActionButton>
            <ActionButton asChild intent="secondary">
              <Link href="/admin/financeiro">
                <CircleDollarSign className="mr-2 h-4 w-4" /> Financeiro
              </Link>
            </ActionButton>
          </>
        }
      />

      <SectionCard
        title="Modulo administrativo"
        description="Separe leitura executiva, alertas, atividade recente e atalhos."
      >
        <ModuleTabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={setActiveTab}
          columnsClassName="md:grid-cols-4"
        />
      </SectionCard>

      <section className={activeTab === "overview" ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-5" : "hidden"}>
        <MetricCard
          label="Receita do mês"
          value={BRL.format(data.metrics.receitaMes / 100)}
          tone="highlight"
        />
        <MetricCard label="Cobranças pendentes" value={data.metrics.inscricoesPendentes} />
        <MetricCard
          label="Total em aberto"
          value={BRL.format(data.report.totals.totalPendente / 100)}
        />
        <MetricCard label="Atletas ativos" value={data.metrics.atletasAtivos} />
        <MetricCard label="Provas publicadas" value={data.metrics.provasPublicadas} />
      </section>

      <div className={activeTab === "attention" ? "grid gap-4 xl:grid-cols-[1.4fr_1fr]" : "hidden"}>
        <SectionCard
          title="Precisa da sua atenção"
          description="Itens de urgência para priorização imediata"
        >
          <div className="space-y-2.5">
            {attentionItems.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-[#0f233d] px-3 py-3 transition hover:border-[#2e6399]"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="text-xs text-slate-300">{item.detail}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge tone={item.tone} label={String(item.value)} className="text-xs" />
                  <ArrowRight className="h-4 w-4 text-slate-300" />
                </div>
              </Link>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Agenda e próximas provas"
          description="Visibilidade dos próximos eventos operacionais"
        >
          {upcomingEvents.length === 0 ? (
            <EmptyState
              title="Sem próximas provas"
              description="Publique novas provas para iniciar a agenda."
            />
          ) : (
            <div className="space-y-2.5">
              {upcomingEvents.map((event) => (
                <Link
                  key={event.id}
                  href={`/admin/eventos/${event.id}`}
                  className="block rounded-xl border border-white/10 bg-[#0f233d] px-3 py-3 transition hover:border-[#2e6399]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      {event.image_url ? (
                        <div className="h-10 w-14 overflow-hidden rounded-md border border-white/10 bg-[#0c1d33]">
                          <img
                            src={event.image_url}
                            alt={`Imagem da prova ${event.name}`}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : null}
                      <p className="text-sm font-semibold text-white">{event.name}</p>
                    </div>
                    <StatusBadge
                      tone={
                        event.status === "PUBLISHED"
                          ? "positive"
                          : event.status === "DRAFT"
                            ? "warning"
                            : "danger"
                      }
                      label={eventStatusLabel(event.status)}
                      className="text-[10px]"
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-300">
                    {format(new Date(event.event_date), "dd/MM/yyyy", { locale: ptBR })} •{" "}
                    {event.city}/{event.state}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {event.registrations_count} inscrições
                  </p>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard
        className={activeTab === "activity" ? undefined : "hidden"}
        title="Operação recente"
        description="Últimas movimentações financeiras e inscrições em andamento"
      >
        {rows.length === 0 ? (
          <EmptyState
            title="Sem operação recente"
            description="As últimas transações serão exibidas aqui."
          />
        ) : (
          <DataTable
            columns={recentColumns}
            data={rows.slice(0, 7)}
            getRowKey={(row) => row.payment_id}
          />
        )}
      </SectionCard>

      <SectionCard
        className={activeTab === "shortcuts" ? undefined : "hidden"}
        title="Atalhos administrativos"
        description="Entrada direta para os módulos de execução"
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Link
            href="/admin/eventos?status=ALL"
            className="rounded-xl border border-white/10 bg-[#0f233d] p-3 transition hover:border-[#2e6399]"
          >
            <ClipboardList className="h-5 w-5 text-sky-300" />
            <p className="mt-2 text-sm font-semibold text-white">Gestão de provas</p>
            <p className="text-xs text-slate-300">Publicar, editar e acompanhar calendário.</p>
          </Link>

          <Link
            href="/admin/financeiro?status=PENDING&due=ALL"
            className="rounded-xl border border-white/10 bg-[#0f233d] p-3 transition hover:border-[#2e6399]"
          >
            <FileBarChart2 className="h-5 w-5 text-emerald-300" />
            <p className="mt-2 text-sm font-semibold text-white">Financeiro</p>
            <p className="text-xs text-slate-300">Cobranças, status PIX e relatórios.</p>
          </Link>

          <Link
            href="/admin/atletas?status=ALL&financial=ALL"
            className="rounded-xl border border-white/10 bg-[#0f233d] p-3 transition hover:border-[#2e6399]"
          >
            <Users className="h-5 w-5 text-amber-300" />
            <p className="mt-2 text-sm font-semibold text-white">Atletas</p>
            <p className="text-xs text-slate-300">Base ativa, pendências e relacionamento.</p>
          </Link>

          <Link
            href="/admin/eventos?window=next14d"
            className="rounded-xl border border-white/10 bg-[#0f233d] p-3 transition hover:border-[#2e6399]"
          >
            <CalendarClock className="h-5 w-5 text-violet-300" />
            <p className="mt-2 text-sm font-semibold text-white">Calendário</p>
            <p className="text-xs text-slate-300">Visão temporal de compromissos e provas.</p>
          </Link>
        </div>

        {(pendingRows.length > 0 || draftEvents > 0) && (
          <div className="mt-4 rounded-xl border border-amber-300/30 bg-amber-400/10 p-3 text-sm text-amber-100">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4" />
              Ação recomendada agora
            </div>
            <p className="mt-1 text-xs text-amber-100/90">
              Priorize cobrança de pendências e publicação de provas em rascunho para manter
              conversão e operação fluida.
            </p>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
