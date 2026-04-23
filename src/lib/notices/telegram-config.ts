interface TelegramSettings {
  telegram_enabled: boolean;
  telegram_chat_id: string | null;
  telegram_bot_token: string | null;
}

function readObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function resolveTelegramSettings(rawSettings: unknown): TelegramSettings {
  const settings = readObject(rawSettings);
  const integrations = readObject(settings?.integrations);
  const telegram = readObject(integrations?.telegram);

  const enabledFromNested = readBoolean(telegram?.telegram_enabled ?? telegram?.enabled);
  const chatIdFromNested = readString(telegram?.telegram_chat_id ?? telegram?.chat_id);
  const botTokenFromNested = readString(telegram?.telegram_bot_token ?? telegram?.bot_token);

  const enabledFromRoot = readBoolean(settings?.telegram_enabled);
  const chatIdFromRoot = readString(settings?.telegram_chat_id);
  const botTokenFromRoot = readString(settings?.telegram_bot_token);

  const envEnabled = process.env.TELEGRAM_NOTICES_ENABLED === "true";
  const envChatId = readString(process.env.TELEGRAM_CHAT_ID);
  const envBotToken = readString(process.env.TELEGRAM_BOT_TOKEN);

  const telegram_enabled = enabledFromNested ?? enabledFromRoot ?? envEnabled;
  const telegram_chat_id = chatIdFromNested ?? chatIdFromRoot ?? envChatId;
  const telegram_bot_token = botTokenFromNested ?? botTokenFromRoot ?? envBotToken;

  return {
    telegram_enabled,
    telegram_chat_id,
    telegram_bot_token,
  };
}
