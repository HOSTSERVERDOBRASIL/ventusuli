"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { AthletesCrmTable } from "@/components/athletes/athletes-crm-table";
import { AthletesSummaryCards } from "@/components/athletes/athletes-summary-cards";
import { ActionButton } from "@/components/system/action-button";
import { EmptyState } from "@/components/system/empty-state";
import { LoadingState } from "@/components/system/loading-state";
import { PageHeader } from "@/components/system/page-header";
import { SectionCard } from "@/components/system/section-card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { getAthletesList } from "@/services/athletes-service";
import { AthleteListRow, AthletesListSummary } from "@/services/types";

const EMPTY_SUMMARY: AthletesListSummary = {
  totalAthletes: 0,
  active: 0,
  pendingApproval: 0,
  rejected: 0,
  blocked: 0,
  totalPendingCents: 0,
  totalPaidCents: 0,
};

export default function CoachAtletasPage() {
  const { accessToken } = useAuthToken();
  const [rows, setRows] = useState<AthleteListRow[]>([]);
  const [summary, setSummary] = useState<AthletesListSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<
    "ALL" | "PENDING_APPROVAL" | "ACTIVE" | "REJECTED" | "BLOCKED"
  >("ALL");
  const [financial, setFinancial] = useState<"ALL" | "EM_DIA" | "PENDENTE" | "SEM_HISTORICO">(
    "ALL",
  );
  const [sortBy, setSortBy] = useState<
    "name" | "registrations" | "nextEvent" | "pending" | "paid" | "lastPayment"
  >("nextEvent");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 1 });

  const load = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const payload = await getAthletesList({
        q: query || undefined,
        status,
        financial,
        sortBy,
        sortDir: "asc",
        page,
        pageSize: 10,
        accessToken,
      });

      setRows(payload.data);
      setSummary(payload.summary);
      setMeta(payload.meta);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível carregar atletas.";
      setRows([]);
      setSummary(EMPTY_SUMMARY);
      setMeta({ page: 1, pageSize: 10, total: 0, totalPages: 1 });
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      await load();
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [accessToken, page, query, status, financial, sortBy]);

  const technicalFocus = useMemo(() => {
    const pendingApproval = rows.filter((item) => item.status === "PENDING_APPROVAL").length;
    const blocked = rows.filter((item) => item.status === "BLOCKED").length;
    const withUpcomingEvent = rows.filter((item) => Boolean(item.nextEventDate)).length;
    return { pendingApproval, blocked, withUpcomingEvent };
  }, [rows]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Coach • Atletas"
        subtitle="Acompanhamento técnico e esportivo da base de atletas da assessoria."
      />

      {loading ? <LoadingState lines={3} /> : <AthletesSummaryCards summary={summary} />}

      <div className="grid gap-3 sm:grid-cols-3">
        <SectionCard title="Aprovação pendente" description="Atletas aguardando liberação">
          <p className="text-2xl font-bold text-white">{technicalFocus.pendingApproval}</p>
        </SectionCard>
        <SectionCard title="Com prova próxima" description="Atletas com evento futuro cadastrado">
          <p className="text-2xl font-bold text-white">{technicalFocus.withUpcomingEvent}</p>
        </SectionCard>
        <SectionCard title="Bloqueados" description="Atletas com acesso bloqueado">
          <p className="text-2xl font-bold text-white">{technicalFocus.blocked}</p>
        </SectionCard>
      </div>

      <SectionCard
        title="Base técnica"
        description="Use filtros de status, financeiro e ordenação para priorizar atendimento esportivo."
      >
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_220px_220px_220px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(event) => {
                  setPage(1);
                  setQuery(event.target.value);
                }}
                placeholder="Buscar atleta por nome ou email"
                className="border-white/[0.1] bg-white/[0.05] pl-10 text-white placeholder:text-white/30"
              />
            </div>

            <Select
              value={status}
              onChange={(event) => {
                setPage(1);
                setStatus(
                  event.target.value as
                    | "ALL"
                    | "PENDING_APPROVAL"
                    | "ACTIVE"
                    | "REJECTED"
                    | "BLOCKED",
                );
              }}
              className="border-white/[0.1] bg-white/[0.05] text-white"
            >
              <option value="ALL">Todos os status</option>
              <option value="ACTIVE">Ativo</option>
              <option value="PENDING_APPROVAL">Pendente aprovação</option>
              <option value="REJECTED">Rejeitado</option>
              <option value="BLOCKED">Bloqueado</option>
            </Select>

            <Select
              value={financial}
              onChange={(event) => {
                setPage(1);
                setFinancial(event.target.value as "ALL" | "EM_DIA" | "PENDENTE" | "SEM_HISTORICO");
              }}
              className="border-white/[0.1] bg-white/[0.05] text-white"
            >
              <option value="ALL">Financeiro (todos)</option>
              <option value="EM_DIA">Em dia</option>
              <option value="PENDENTE">Pendente</option>
              <option value="SEM_HISTORICO">Sem histórico</option>
            </Select>

            <Select
              value={sortBy}
              onChange={(event) => {
                setPage(1);
                setSortBy(
                  event.target.value as
                    | "name"
                    | "registrations"
                    | "nextEvent"
                    | "pending"
                    | "paid"
                    | "lastPayment",
                );
              }}
              className="border-white/[0.1] bg-white/[0.05] text-white"
            >
              <option value="nextEvent">Ordenar por próxima prova</option>
              <option value="name">Ordenar por nome</option>
              <option value="registrations">Ordenar por inscrições</option>
              <option value="pending">Ordenar por pendências</option>
              <option value="paid">Ordenar por pagamentos</option>
              <option value="lastPayment">Ordenar por último pagamento</option>
            </Select>
          </div>

          {loading ? (
            <LoadingState lines={4} />
          ) : errorMessage ? (
            <EmptyState
              title="Listagem indisponível"
              description={errorMessage}
              action={<ActionButton onClick={() => void load()}>Tentar novamente</ActionButton>}
            />
          ) : rows.length === 0 ? (
            <EmptyState
              title="Nenhum atleta encontrado"
              description="Ajuste os filtros para visualizar os atletas da assessoria."
            />
          ) : (
            <AthletesCrmTable rows={rows} showActions={false} />
          )}

          <div className="flex items-center justify-between text-xs text-slate-300">
            <p>
              Página {meta.page} de {meta.totalPages} • {meta.total} atletas
            </p>
            <div className="flex gap-2">
              <ActionButton
                size="sm"
                intent="secondary"
                disabled={meta.page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                Anterior
              </ActionButton>
              <ActionButton
                size="sm"
                intent="secondary"
                disabled={meta.page >= meta.totalPages}
                onClick={() => setPage((prev) => Math.min(meta.totalPages, prev + 1))}
              >
                Próxima
              </ActionButton>
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
