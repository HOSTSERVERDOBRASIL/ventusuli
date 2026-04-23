const RELATIVE_IMAGE_PREFIXES = ["/uploads/", "/branding/"];

export function isAllowedImageUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;

  if (RELATIVE_IMAGE_PREFIXES.some((prefix) => trimmed.startsWith(prefix))) {
    return true;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}
