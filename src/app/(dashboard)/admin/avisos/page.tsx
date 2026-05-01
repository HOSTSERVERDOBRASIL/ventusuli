"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, FileText, History } from "lucide-react";
import { toast } from "sonner";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { AdminNoticeFilters } from "@/components/notices/admin-notice-filters";
import { NoticeCard } from "@/components/notices/notice-card";
import { NoticeComposer, NoticeComposerPayload } from "@/components/notices/notice-composer";
import { ActionButton } from "@/components/system/action-button";
import { EmptyState } from "@/components/system/empty-state";
import { LoadingState } from "@/components/system/loading-state";
import { MetricCard } from "@/components/system/metric-card";
import { ModuleTabs, type ModuleTabItem } from "@/components/system/module-tabs";
import { PageHeader } from "@/components/system/page-header";
import { SectionCard } from "@/components/system/section-card";
import {
  createNotice,
  getNotices,
  publishNotice,
  resendNoticeTelegram,
} from "@/services/notice-service";
import { NoticeAudience, NoticeItem, NoticeStatus } from "@/services/types";

interface FilterState {
  status: NoticeStatus | "ALL";
  audience: NoticeAudience | "ALL";
  startDate: string;
  endDate: string;
}

type NoticeModuleTab = "overview" | "compose" | "history";

export default function AdminAvisosPage() {
  const { accessToken, hydrated } = useAuthToken();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [filters, setFilters] = useState<FilterState>({
    status: "ALL",
    audience: "ALL",
    startDate: "",
    endDate: "",
  });
  const [activeTab, setActiveTab] = useState<NoticeModuleTab>("overview");

  const loadNotices = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const startDateIso = filters.startDate
        ? new Date(`${filters.startDate}T00:00:00.000Z`).toISOString()
        : undefined;
      const endDateIso = filters.endDate
        ? new Date(`${filters.endDate}T23:59:59.999Z`).toISOString()
        : undefined;

      const data = await getNotices({
        accessToken,
        ...(filters.status !== "ALL" ? { status: filters.status } : {}),
        ...(filters.audience !== "ALL" ? { audience: filters.audience } : {}),
        ...(startDateIso ? { startDate: startDateIso } : {}),
        ...(endDateIso ? { endDate: endDateIso } : {}),
      });
      setNotices(data);
    } catch (error) {
      setNotices([]);
      const message = error instanceof Error ? error.message : "Falha ao carregar avisos.";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!hydrated) return;
    void loadNotices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, accessToken, filters]);

  const metrics = useMemo(() => {
    const published = notices.filter((notice) => notice.status === "PUBLISHED").length;
    const drafts = notices.filter((notice) => notice.status === "DRAFT").length;
    const failedTelegram = notices.filter((notice) =>
      notice.deliveries?.some(
        (delivery) => delivery.channel === "TELEGRAM" && delivery.status === "FAILED",
      ),
    ).length;

    return { published, drafts, failedTelegram, total: notices.length };
  }, [notices]);

  const tabs = useMemo<ModuleTabItem<NoticeModuleTab>[]>(
    () => [
      {
        key: "overview",
        label: "Painel",
        audience: "Gestao",
        description: "Volume, publicacoes, rascunhos e falhas de entrega.",
        icon: BarChart3,
        metricLabel: "Total",
        metricValue: metrics.total,
        metricTone: "info",
      },
      {
        key: "compose",
        label: "Criar",
        audience: "Comunicacao",
        description: "Novo aviso para atletas, treinadores ou administracao.",
        icon: FileText,
        metricLabel: "Rascunhos",
        metricValue: metrics.drafts,
        metricTone: metrics.drafts > 0 ? "warning" : "positive",
      },
      {
        key: "history",
        label: "Historico",
        audience: "Auditoria",
        description: "Filtro por periodo, audiencia, status e entregas.",
        icon: History,
        metricLabel: "Falhas",
        metricValue: metrics.failedTelegram,
        metricTone: metrics.failedTelegram > 0 ? "danger" : "positive",
      },
    ],
    [metrics],
  );

  const handleCreate = async (payload: NoticeComposerPayload) => {
    setSubmitting(true);
    try {
      await createNotice(payload, accessToken);
      toast.success("Aviso salvo como rascunho.");
      await loadNotices();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar aviso.");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublish = async (noticeId: string) => {
    setPublishingId(noticeId);
    try {
      const updated = await publishNotice(noticeId, accessToken);
      const telegramDelivery = updated.deliveries?.find(
        (delivery) => delivery.channel === "TELEGRAM",
      );

      if (updated.telegram_enabled && telegramDelivery?.status === "FAILED") {
        toast.warning(
          telegramDelivery.error_message
            ? `Aviso publicado no app. Telegram falhou: ${telegramDelivery.error_message}`
            : "Aviso publicado no app. Telegram falhou e foi registrado no historico.",
        );
      } else {
        toast.success("Aviso publicado com sucesso.");
      }

      await loadNotices();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível publicar aviso.");
    } finally {
      setPublishingId(null);
    }
  };

  const handleResendTelegram = async (noticeId: string) => {
    setResendingId(noticeId);
    try {
      const updated = await resendNoticeTelegram(noticeId, accessToken);
      const telegramDelivery = updated.deliveries?.find(
        (delivery) => delivery.channel === "TELEGRAM",
      );
      if (telegramDelivery?.status === "FAILED") {
        toast.warning(
          telegramDelivery.error_message
            ? `Reenvio falhou: ${telegramDelivery.error_message}`
            : "Reenvio tentou novamente, mas Telegram ainda falhou.",
        );
      } else {
        toast.success("Reenvio Telegram concluido.");
      }
      await loadNotices();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível reenviar para Telegram.",
      );
    } finally {
      setResendingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Administração de Avisos"
        subtitle="Gestão completa de comunicados oficiais, agendamento e entregas por canal."
      />

      <SectionCard
        title="Modulo de avisos"
        description="Separe acompanhamento, criacao e auditoria em abas objetivas."
      >
        <ModuleTabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={setActiveTab}
          columnsClassName="md:grid-cols-3"
        />
      </SectionCard>

      <div
        className={activeTab === "overview" ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-4" : "hidden"}
      >
        <MetricCard label="Total" value={metrics.total} />
        <MetricCard label="Publicados" value={metrics.published} />
        <MetricCard label="Rascunhos" value={metrics.drafts} />
        <MetricCard label="Falhas Telegram" value={metrics.failedTelegram} tone="highlight" />
      </div>

      <SectionCard
        className={activeTab === "compose" ? undefined : "hidden"}
        title="Novo aviso"
        description="Crie um rascunho e publique quando estiver pronto"
      >
        <NoticeComposer submitting={submitting} onSubmit={handleCreate} />
      </SectionCard>

      <SectionCard
        className={activeTab === "history" ? undefined : "hidden"}
        title="Histórico e entregas"
        description="Filtre por status, audiência e período para auditoria operacional"
      >
        <div className="space-y-3">
          <AdminNoticeFilters
            status={filters.status}
            audience={filters.audience}
            startDate={filters.startDate}
            endDate={filters.endDate}
            onChange={(next) => setFilters((prev) => ({ ...prev, ...next }))}
          />
          {loading ? (
            <LoadingState lines={4} />
          ) : notices.length === 0 ? (
            <EmptyState
              title="Nenhum aviso encontrado"
              description={
                errorMessage
                  ? "Não foi possível carregar os avisos agora."
                  : "Não há registros para os filtros aplicados."
              }
              action={
                errorMessage ? (
                  <ActionButton onClick={() => void loadNotices()}>Tentar novamente</ActionButton>
                ) : undefined
              }
            />
          ) : (
            <div className="space-y-3">
              {notices.map((notice) => (
                <NoticeCard
                  key={notice.id}
                  notice={notice}
                  canPublish
                  publishing={publishingId === notice.id}
                  canResendTelegram
                  resendingTelegram={resendingId === notice.id}
                  onPublish={handlePublish}
                  onResendTelegram={handleResendTelegram}
                />
              ))}
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
