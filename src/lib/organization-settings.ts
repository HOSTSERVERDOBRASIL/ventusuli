function readObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function cloneWithoutTelegramSecrets(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => cloneWithoutTelegramSecrets(item));
  }

  const source = readObject(value);
  if (!source) return value;

  const clone: Record<string, unknown> = {};

  for (const [key, entry] of Object.entries(source)) {
    if (key === "telegram_bot_token" || key === "telegramBotToken" || key === "bot_token") {
      continue;
    }

    clone[key] = cloneWithoutTelegramSecrets(entry);
  }

  return clone;
}

function getNestedTelegramBotToken(settings: unknown): string | null {
  const source = readObject(settings);
  if (!source) return null;

  const nestedIntegrations = readObject(source.integrations);
  const nestedTelegram = readObject(nestedIntegrations?.telegram);

  const nestedToken =
    (typeof nestedTelegram?.telegram_bot_token === "string" && nestedTelegram.telegram_bot_token) ||
    (typeof nestedTelegram?.bot_token === "string" && nestedTelegram.bot_token) ||
    null;

  if (nestedToken) return nestedToken;

  const rootToken =
    (typeof source.telegram_bot_token === "string" && source.telegram_bot_token) ||
    (typeof source.telegramBotToken === "string" && source.telegramBotToken) ||
    null;

  return rootToken;
}

export function sanitizeOrganizationSettings(settings: unknown): Record<string, unknown> | null {
  const sanitized = cloneWithoutTelegramSecrets(settings);
  return readObject(sanitized);
}

export function hasOrganizationTelegramBotToken(settings: unknown): boolean {
  const token = getNestedTelegramBotToken(settings);
  return Boolean(token && token.trim().length > 0);
}
