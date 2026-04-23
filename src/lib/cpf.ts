/** Removes all non-digit characters from a CPF string. */
export function normalizeCpf(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** Formats 11 raw digits as ###.###.###-## */
export function formatCpf(raw: string): string {
  const d = normalizeCpf(raw);
  if (d.length !== 11) return raw;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
}

/**
 * Validates a CPF string (accepts formatted or raw digits).
 * Returns true only for structurally and mathematically valid CPFs.
 */
export function isValidCpf(raw: string): boolean {
  const cpf = normalizeCpf(raw);

  if (cpf.length !== 11) return false;
  // Reject sequences like 111.111.111-11
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(cpf[i]) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== Number(cpf[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(cpf[i]) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== Number(cpf[10])) return false;

  return true;
}
