const FALLBACK_PUBLIC_APP_URL = "https://sistema.ventusuli.com.br";
const LOCAL_HOSTS = new Set(["0.0.0.0", "localhost", "127.0.0.1"]);

function cleanUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export function getPublicAppUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const candidate = configuredUrl || FALLBACK_PUBLIC_APP_URL;

  try {
    const parsed = new URL(candidate);
    const isProduction = process.env.NODE_ENV === "production";

    if (isProduction && LOCAL_HOSTS.has(parsed.hostname)) {
      return FALLBACK_PUBLIC_APP_URL;
    }

    return cleanUrl(candidate);
  } catch {
    return FALLBACK_PUBLIC_APP_URL;
  }
}

export function buildPublicInviteUrl(token: string): string {
  return `${getPublicAppUrl()}/register/atleta?inviteToken=${encodeURIComponent(token)}`;
}
