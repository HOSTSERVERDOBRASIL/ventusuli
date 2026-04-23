import { NoticeAudience, NoticeStatus } from "@/services/types";

interface AdminNoticeFiltersProps {
  status: NoticeStatus | "ALL";
  audience: NoticeAudience | "ALL";
  startDate: string;
  endDate: string;
  onChange: (next: {
    status: NoticeStatus | "ALL";
    audience: NoticeAudience | "ALL";
    startDate: string;
    endDate: string;
  }) => void;
}

export function AdminNoticeFilters({ status, audience, startDate, endDate, onChange }: AdminNoticeFiltersProps) {
  return (
    <div className="grid gap-3 rounded-xl border border-white/10 bg-[#0f233d] p-3 md:grid-cols-4">
      <div className="space-y-1">
        <label className="text-[11px] uppercase tracking-wide text-slate-300">Status</label>
        <select
          value={status}
          onChange={(event) => onChange({ status: event.target.value as NoticeStatus | "ALL", audience, startDate, endDate })}
          className="w-full rounded-lg border border-white/15 bg-[#0b1d34] px-2.5 py-2 text-sm text-white outline-none"
        >
          <option value="ALL">Todos</option>
          <option value="DRAFT">Rascunho</option>
          <option value="PUBLISHED">Publicado</option>
          <option value="ARCHIVED">Arquivado</option>
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-[11px] uppercase tracking-wide text-slate-300">Audiência</label>
        <select
          value={audience}
          onChange={(event) => onChange({ status, audience: event.target.value as NoticeAudience | "ALL", startDate, endDate })}
          className="w-full rounded-lg border border-white/15 bg-[#0b1d34] px-2.5 py-2 text-sm text-white outline-none"
        >
          <option value="ALL">Todos</option>
          <option value="ATHLETES">Atletas</option>
          <option value="COACHES">Coaches</option>
          <option value="ADMINS">Admins</option>
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-[11px] uppercase tracking-wide text-slate-300">Início</label>
        <input
          type="date"
          value={startDate}
          onChange={(event) => onChange({ status, audience, startDate: event.target.value, endDate })}
          className="w-full rounded-lg border border-white/15 bg-[#0b1d34] px-2.5 py-2 text-sm text-white outline-none"
        />
      </div>

      <div className="space-y-1">
        <label className="text-[11px] uppercase tracking-wide text-slate-300">Fim</label>
        <input
          type="date"
          value={endDate}
          onChange={(event) => onChange({ status, audience, startDate, endDate: event.target.value })}
          className="w-full rounded-lg border border-white/15 bg-[#0b1d34] px-2.5 py-2 text-sm text-white outline-none"
        />
      </div>
    </div>
  );
}
