export const VENTU_SULI_BRAND_NAME = "Ventu Suli";
export const VENTU_SULI_LOGO_SRC = "/branding/ventu-suli-floripa-logo.png";

const PLACEHOLDER_LOGOS = [
  "cdn.seudominio.com/logo.png",
  "/branding/ventu-suli-logo.png",
  "/auth/ventu-suli-logo.png",
  "/auth/ventu-suli-floripa-logo.png",
];

function isAllowedLogoSource(logo: string): boolean {
  if (logo.startsWith("/")) return !logo.startsWith("//") && !logo.startsWith("/\\");

  try {
    const url = new URL(logo);
    if (url.protocol === "https:") return true;
    return process.env.NODE_ENV !== "production" && url.protocol === "http:";
  } catch {
    return false;
  }
}

export function resolveOrganizationLogo(logoUrl?: string | null): string {
  const logo = logoUrl?.trim();
  if (!logo) return VENTU_SULI_LOGO_SRC;

  const normalized = logo.toLowerCase();
  if (
    PLACEHOLDER_LOGOS.some((placeholder) => normalized.includes(placeholder)) ||
    !isAllowedLogoSource(logo)
  ) {
    return VENTU_SULI_LOGO_SRC;
  }

  return logo;
}
