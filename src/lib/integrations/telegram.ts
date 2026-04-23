import { logError, logIntegration, logWarn } from "@/lib/logger";

export interface TelegramNoticePayload {
  title: string;
  body: string;
  audience: string;
  organizationName?: string | null;
}

export interface TelegramTargetConfig {
  enabled: boolean;
  chatId: string | null;
  botToken: string | null;
}

export interface TelegramSendResult {
  success: boolean;
  skipped: boolean;
  externalId?: string;
  errorMessage?: string;
}

function buildMessage(payload: TelegramNoticePayload): string {
  const header = payload.organizationName ? `📣 *${payload.organizationName}*` : "📣 *Ventu Suli*";
  const audience = `Publico: ${payload.audience}`;
  return `${header}\n\n*${payload.title}*\n${payload.body}\n\n_${audience}_`;
}

export async function sendNoticeToTelegram(
  payload: TelegramNoticePayload,
  target: TelegramTargetConfig,
): Promise<TelegramSendResult> {
  logIntegration("telegram", "send_notice_requested", {
    audience: payload.audience,
    hasOrgName: Boolean(payload.organizationName),
    enabled: target.enabled,
  });

  if (!target.enabled) {
    logWarn("[integration:telegram] skipped_send", { reason: "disabled" });
    return { success: false, skipped: true, errorMessage: "Integracao Telegram desabilitada para esta organizacao." };
  }

  const botToken = target.botToken;
  const chatId = target.chatId;

  if (!botToken || !chatId) {
    logWarn("[integration:telegram] skipped_send", { reason: "missing_credentials" });
    return { success: false, skipped: true, errorMessage: "Credenciais Telegram ausentes para esta organizacao." };
  }

  const endpoint = `https://api.telegram.org/bot${botToken}/sendMessage`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: buildMessage(payload),
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      }),
    });

    const raw = (await response.json().catch(() => null)) as
      | { ok?: boolean; result?: { message_id?: number }; description?: string }
      | null;

    if (!response.ok || !raw?.ok) {
      logError("[integration:telegram] send_failed", {
        status: response.status,
        description: raw?.description ?? null,
      });
      return {
        success: false,
        skipped: false,
        errorMessage: raw?.description ?? "Falha ao enviar aviso para Telegram.",
      };
    }

    logIntegration("telegram", "send_success", {
      externalId: raw.result?.message_id ? String(raw.result.message_id) : null,
    });

    return {
      success: true,
      skipped: false,
      externalId: raw.result?.message_id ? String(raw.result.message_id) : undefined,
    };
  } catch (error) {
    logError("[integration:telegram] send_exception", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      skipped: false,
      errorMessage: error instanceof Error ? error.message : "Erro inesperado no envio Telegram.",
    };
  }
}
