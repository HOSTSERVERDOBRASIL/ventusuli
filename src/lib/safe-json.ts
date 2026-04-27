export async function safeJson<T = unknown>(response: Response): Promise<T | null> {
  const text = await response.text().catch(() => "");
  if (!text || !text.trim()) return null;

  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
