import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BellRing, FileText, ShieldCheck, UserRoundPen } from "lucide-react";
import { type DataTableColumn, DataTable } from "@/components/system/data-table";
import { StatusBadge } from "@/components/system/status-badge";
import { managedAthleteLabel } from "@/lib/role-labels";
import { AthleteListRow } from "@/services/types";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function statusTone(status: AthleteListRow["status"]): "positive" | "warning" | "neutral" {
  if (status === "ACTIVE") return "positive";
  if (status === "PENDING_APPROVAL") return "warning";
  return "neutral";
}

function statusLabel(status: AthleteListRow["status"]): string {
  if (status === "ACTIVE") return "ATIVO";
  if (status === "PENDING_APPROVAL") return "PENDENTE";
  if (status === "REJECTED") return "REJEITADO";
  return "BLOQUEADO";
}

function initialsFromName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function financialTone(
  f: AthleteListRow["financialSituation"],
): "positive" | "warning" | "neutral" {
  if (f === "EM_DIA") return "positive";
  if (f === "PENDENTE") return "warning";
  return "neutral";
}

function ActionLink({
  href,
  icon: Icon,
  label,
  variant = "default",
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  variant?: "default" | "warning" | "success";
}) {
  const styles = {
    default:
      "border border-white/[0.1] bg-white/[0.04] text-white/60 hover:bg-white/[0.09] hover:text-white",
    warning: "border border-[#F4C542]/30 bg-[#F4C542]/10 text-[#F4C542] hover:bg-[#F4C542]/20",
    success: "border border-[#00C853]/30 bg-[#00C853]/10 text-[#00C853] hover:bg-[#00C853]/20",
  };

  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      className={`inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${styles[variant]}`}
    >
      <Icon className="h-3.5 w-3.5 flex-shrink-0" />
      <span>{label}</span>
    </Link>
  );
}

export function AthletesCrmTable({
  rows,
  basePath = "/atletas",
  showActions = true,
}: {
  rows: AthleteListRow[];
  basePath?: string;
  showActions?: boolean;
}) {
  const baseColumns: DataTableColumn<AthleteListRow>[] = [
    {
      key: "athlete",
      header: managedAthleteLabel(),
      className: "min-w-[280px]",
      cell: (row) => (
        <div className="flex items-center gap-3">
          {row.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={row.avatarUrl}
              alt={`Foto de ${row.name}`}
              className="h-11 w-11 rounded-full border border-white/10 object-cover"
            />
          ) : (
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#0F2743] text-sm font-bold text-[#F5A623]">
              {initialsFromName(row.name)}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="font-semibold text-white">{row.name}</p>
              {row.approvalPending && (
                <span className="rounded-full border border-[#F4C542]/40 bg-[#F4C542]/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#F4C542]">
                  Aprovação pendente
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[11px] text-white/40">{row.email}</p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#8eb0dc]">
              {row.memberNumber ?? "Sem matrícula"}
            </p>
            {row.invitedByName ? (
              <p className="mt-0.5 text-[10px] text-white/35">
                Convite: {row.invitedByName}
                {row.invitedByMemberNumber ? ` (${row.invitedByMemberNumber})` : ""}
              </p>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      className: "min-w-[90px]",
      cell: (row) => <StatusBadge tone={statusTone(row.status)} label={statusLabel(row.status)} />,
    },
    {
      key: "next",
      header: "Próxima prova",
      className: "min-w-[160px]",
      cell: (row) =>
        row.nextEventDate ? (
          <div>
            <p className="text-[12px] font-medium leading-snug text-white">
              {row.nextEventName ?? "-"}
            </p>
            <p className="mt-0.5 text-[10px] text-white/40">
              {format(new Date(row.nextEventDate), "dd/MM/yyyy", { locale: ptBR })}
              {" · "}
              {row.registrationsCount} inscr.
            </p>
          </div>
        ) : (
          <span className="text-[11px] text-white/25">-</span>
        ),
    },
    {
      key: "financial",
      header: "Financeiro",
      className: "min-w-[200px]",
      cell: (row) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <StatusBadge
              tone={financialTone(row.financialSituation)}
              label={row.financialSituation}
            />
            <span className="text-[11px] text-white/50">
              {BRL.format(row.pendingAmountCents / 100)} aberto
            </span>
          </div>
          <p className="text-[10px] text-white/30">
            {row.lastPaymentAt
              ? `Ult. pagto: ${format(new Date(row.lastPaymentAt), "dd/MM/yy", { locale: ptBR })}`
              : "Sem pagamentos"}
          </p>
        </div>
      ),
    },
  ];

  const actionColumn: DataTableColumn<AthleteListRow> = {
    key: "actions",
    header: "Ações",
    className: "min-w-[260px]",
    cell: (row) => (
      <div className="flex flex-wrap items-center gap-1.5">
        <ActionLink href={`${basePath}/${row.id}`} icon={FileText} label="Ver" />
        <ActionLink
          href={`${basePath}/${row.id}#athlete-edit`}
          icon={UserRoundPen}
          label="Editar"
        />
        <ActionLink
          href={`/admin/financeiro?status=PENDING&athlete=${encodeURIComponent(row.name)}`}
          icon={BellRing}
          label="Financeiro"
          variant="warning"
        />
        {row.approvalPending ? (
          <ActionLink
            href={`${basePath}/${row.id}#athlete-approval`}
            icon={ShieldCheck}
            label="Aprovar"
            variant="success"
          />
        ) : null}
      </div>
    ),
  };

  const columns = showActions ? [...baseColumns, actionColumn] : baseColumns;

  return <DataTable columns={columns} data={rows} getRowKey={(row) => row.id} />;
}
