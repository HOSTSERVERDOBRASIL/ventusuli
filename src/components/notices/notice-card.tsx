import { BellRing, Pin, RotateCcw, Send, ShieldAlert, User2 } from "lucide-react";
import { StatusBadge } from "@/components/system/status-badge";
import { NoticeItem } from "@/services/types";

function statusLabel(status: NoticeItem["status"]): string {
  if (status === "PUBLISHED") return "PUBLICADO";
  if (status === "ARCHIVED") return "ARQUIVADO";
  return "RASCUNHO";
}

function statusTone(status: NoticeItem["status"]): "positive" | "warning" | "neutral" {
  if (status === "PUBLISHED") return "positive";
  if (status === "ARCHIVED") return "neutral";
  return "warning";
}

function audienceLabel(audience: NoticeItem["audience"]): string {
  if (audience === "ATHLETES") return "Atletas";
  if (audience === "COACHES") return "Coaches";
  if (audience === "ADMINS") return "Administradores";
  return "Todos";
}

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function deliveryStatusLabel(status: string): string {
  if (status === "SENT") return "Enviado";
  if (status === "FAILED") return "Falhou";
  if (status === "PENDING") return "Pendente";
  return status;
}

function deliveryChannelLabel(channel: string): string {
  if (channel === "IN_APP") return "No app";
  if (channel === "TELEGRAM") return "Telegram";
  return channel;
}

interface NoticeCardProps {
  notice: NoticeItem;
  canPublish: boolean;
  publishing?: boolean;
  canResendTelegram?: boolean;
  resendingTelegram?: boolean;
  onPublish?: (noticeId: string) => void;
  onResendTelegram?: (noticeId: string) => void;
}

export function NoticeCard({
  notice,
  canPublish,
  publishing = false,
  canResendTelegram = false,
  resendingTelegram = false,
  onPublish,
  onResendTelegram,
}: NoticeCardProps) {
  const telegramDelivery = notice.deliveries?.find((delivery) => delivery.channel === "TELEGRAM");
  const orderedDeliveries = [...(notice.deliveries ?? [])].sort((a, b) => {
    if (a.channel === b.channel) return 0;
    if (a.channel === "IN_APP") return -1;
    if (b.channel === "IN_APP") return 1;
    return a.channel.localeCompare(b.channel);
  });

  return (
    <article className="rounded-2xl border border-white/10 bg-[#102640] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.2)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            label={statusLabel(notice.status)}
            tone={statusTone(notice.status)}
            className="text-[10px]"
          />
          <StatusBadge label={audienceLabel(notice.audience)} tone="info" className="text-[10px]" />
          {notice.pinned ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/40 bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold text-amber-100">
              <Pin className="h-3 w-3" /> Fixo
            </span>
          ) : null}
          {notice.is_global ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-sky-300/40 bg-sky-400/15 px-2 py-0.5 text-[10px] font-semibold text-sky-100">
              Global
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {canPublish && notice.status === "DRAFT" && onPublish ? (
            <button
              type="button"
              onClick={() => onPublish(notice.id)}
              disabled={publishing}
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send className="h-3.5 w-3.5" />
              {publishing ? "Publicando..." : "Publicar"}
            </button>
          ) : null}

          {canResendTelegram &&
          notice.status === "PUBLISHED" &&
          notice.telegram_enabled &&
          onResendTelegram ? (
            <button
              type="button"
              onClick={() => onResendTelegram(notice.id)}
              disabled={resendingTelegram}
              className="inline-flex items-center gap-1 rounded-lg border border-sky-300/40 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-100 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {resendingTelegram ? "Reenviando..." : "Reenviar Telegram"}
            </button>
          ) : null}
        </div>
      </div>

      <h3 className="mt-3 text-lg font-semibold text-white">{notice.title}</h3>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
        {notice.body}
      </p>

      <div className="mt-4 grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
        <p className="inline-flex items-center gap-1.5">
          <BellRing className="h-3.5 w-3.5 text-[#8eb0dc]" /> Publicacao:{" "}
          {formatDate(notice.publish_at)}
        </p>
        <p className="inline-flex items-center gap-1.5">
          <User2 className="h-3.5 w-3.5 text-[#8eb0dc]" /> Criado por:{" "}
          {notice.creator_name ?? "Equipe"}
        </p>
      </div>

      {orderedDeliveries.length > 0 || notice.telegram_enabled ? (
        <div className="mt-3 rounded-lg border border-[#24486f] bg-[#0b1d34] px-3 py-2 text-xs text-[#cde2ff]">
          <p className="font-semibold">Historico de entregas</p>
          <div className="mt-2 space-y-1.5">
            {orderedDeliveries.map((delivery) => (
              <p key={delivery.id}>
                <span className="font-semibold">{deliveryChannelLabel(delivery.channel)}:</span>{" "}
                {deliveryStatusLabel(delivery.status)}
                {typeof delivery.attempt_count === "number"
                  ? ` (tentativas: ${delivery.attempt_count})`
                  : ""}
                {delivery.last_attempt_at
                  ? ` · ultima tentativa: ${formatDate(delivery.last_attempt_at)}`
                  : ""}
                {delivery.sent_at ? ` · enviado: ${formatDate(delivery.sent_at)}` : ""}
                {delivery.error_message ? ` · motivo: ${delivery.error_message}` : ""}
              </p>
            ))}
          </div>
          {notice.telegram_enabled && !telegramDelivery ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-amber-100">
              <ShieldAlert className="h-3.5 w-3.5" />
              Aguardando tentativa de envio.
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
