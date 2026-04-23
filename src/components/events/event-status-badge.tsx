import { EVENT_STATUS_LABEL, type EventStatus } from "@/components/events/types";
import { StatusBadge } from "@/components/system/status-badge";

function statusTone(status: EventStatus): "positive" | "warning" | "danger" | "neutral" {
  if (status === "PUBLISHED") return "positive";
  if (status === "DRAFT") return "warning";
  if (status === "CANCELLED") return "danger";
  return "neutral";
}

export function EventStatusBadge({ status }: { status: EventStatus }) {
  return <StatusBadge tone={statusTone(status)} label={EVENT_STATUS_LABEL[status]} className="text-[10px] uppercase tracking-[0.08em]" />;
}

