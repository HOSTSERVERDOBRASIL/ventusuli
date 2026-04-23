import { useState } from "react";
import { ActionButton } from "@/components/system/action-button";
import { NoticeAudience } from "@/services/types";

const AUDIENCE_OPTIONS: Array<{ value: NoticeAudience; label: string }> = [
  { value: "ALL", label: "Todos" },
  { value: "ATHLETES", label: "Atletas" },
  { value: "COACHES", label: "Coaches" },
  { value: "ADMINS", label: "Administradores" },
];

export interface NoticeComposerPayload {
  title: string;
  body: string;
  audience: NoticeAudience;
  pinned: boolean;
  telegram_enabled: boolean;
  publish_at: string | null;
}

interface NoticeComposerProps {
  submitting?: boolean;
  onSubmit: (payload: NoticeComposerPayload) => Promise<void>;
}

export function NoticeComposer({ submitting = false, onSubmit }: NoticeComposerProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<NoticeAudience>("ALL");
  const [pinned, setPinned] = useState(false);
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [publishAt, setPublishAt] = useState("");

  const canSubmit = title.trim().length >= 3 && body.trim().length >= 5 && !submitting;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <label
            htmlFor="notice-title"
            className="text-xs font-semibold uppercase tracking-wide text-slate-300"
          >
            Titulo
          </label>
          <input
            id="notice-title"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full rounded-lg border border-white/15 bg-[#0b1f35] px-3 py-2 text-sm text-white outline-none"
            placeholder="Ex: Alteracao de horario do treino"
            maxLength={120}
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="notice-audience"
            className="text-xs font-semibold uppercase tracking-wide text-slate-300"
          >
            Publico
          </label>
          <select
            id="notice-audience"
            value={audience}
            onChange={(event) => setAudience(event.target.value as NoticeAudience)}
            className="w-full rounded-lg border border-white/15 bg-[#0b1f35] px-3 py-2 text-sm text-white outline-none"
          >
            {AUDIENCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="notice-body"
          className="text-xs font-semibold uppercase tracking-wide text-slate-300"
        >
          Corpo do aviso
        </label>
        <textarea
          id="notice-body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className="min-h-28 w-full rounded-lg border border-white/15 bg-[#0b1f35] px-3 py-2 text-sm text-white outline-none"
          placeholder="Detalhe aqui a comunicacao oficial para os usuarios."
          maxLength={5000}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <div className="space-y-1.5">
          <label
            htmlFor="notice-publish-at"
            className="text-xs font-semibold uppercase tracking-wide text-slate-300"
          >
            Agendar publicacao (opcional)
          </label>
          <input
            id="notice-publish-at"
            type="datetime-local"
            value={publishAt}
            onChange={(event) => setPublishAt(event.target.value)}
            className="w-full rounded-lg border border-white/15 bg-[#0b1f35] px-3 py-2 text-sm text-white outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-white/10 bg-[#0b1d34] px-3 py-2 text-sm text-slate-200">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(event) => setPinned(event.target.checked)}
            />
            Fixo
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={telegramEnabled}
              onChange={(event) => setTelegramEnabled(event.target.checked)}
            />
            Enviar Telegram
          </label>
        </div>
      </div>

      <div className="flex justify-end">
        <ActionButton
          size="sm"
          disabled={!canSubmit}
          onClick={async () => {
            const normalizedPublishAt = publishAt ? new Date(publishAt).toISOString() : null;
            await onSubmit({
              title: title.trim(),
              body: body.trim(),
              audience,
              pinned,
              telegram_enabled: telegramEnabled,
              publish_at: normalizedPublishAt,
            });

            setTitle("");
            setBody("");
            setAudience("ALL");
            setPinned(false);
            setTelegramEnabled(false);
            setPublishAt("");
          }}
        >
          {submitting ? "Salvando..." : "Salvar rascunho"}
        </ActionButton>
      </div>
    </div>
  );
}
