export function createCuidLike(prefix = "c"): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 12);
  return `${prefix}${ts}${rand}`;
}
