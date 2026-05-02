export function renderTemplate(
  template: string,
  payload: Record<string, string | number | boolean | null | undefined>,
): string {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key: string) => {
    const value = payload[key];
    return value === null || value === undefined ? "" : String(value);
  });
}
