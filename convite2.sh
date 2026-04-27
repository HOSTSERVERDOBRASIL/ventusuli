#!/bin/bash
set -euo pipefail

log() { printf '\n[%s] %s\n' "$(date +%H:%M:%S)" "$1"; }

if [ ! -f package.json ] || [ ! -d src ] || [ ! -d prisma ]; then
  echo "ERRO: rode este script dentro da raiz do projeto VentuSuli."
  exit 1
fi

BACKUP_DIR="$HOME/backups-ventusuli/backup-convites-definitivo-$(date +%Y%m%d-%H%M%S)"
log "Criando backup em $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"
cp -r src "$BACKUP_DIR/src"
cp -r prisma "$BACKUP_DIR/prisma"

log "Removendo backups antigos da raiz para o Next nao compilar backup"
mkdir -p "$HOME/backups-ventusuli"
find . -maxdepth 1 -type d -name 'backup-*' -exec mv {} "$HOME/backups-ventusuli/" \; 2>/dev/null || true

log "Aplicando migracoes do banco para convites"
npx prisma migrate deploy
npx prisma generate

log "Criando helper de JSON seguro"
mkdir -p src/lib
cat > src/lib/safe-json.ts <<'TS'
export async function safeJson<T = unknown>(response: Response): Promise<T | null> {
  const text = await response.text().catch(() => "");
  if (!text || !text.trim()) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
TS

log "Aplicando patch definitivo nos convites"
python3 <<'PY'
from pathlib import Path

# 1) Validacao aceita token e inviteToken, e exige pelo menos um deles ou slug.
p = Path('src/lib/validations/auth.ts')
s = p.read_text()
s = s.replace('  organizationSlug: z.string().trim().optional(),\n  inviteToken: z.string().trim().optional(),', '  organizationSlug: z.string().trim().optional(),\n  token: z.string().trim().optional(),\n  inviteToken: z.string().trim().optional(),')
s = s.replace('    if (!data.organizationSlug && !data.inviteToken) {', '    if (!data.organizationSlug && !data.token && !data.inviteToken) {')
p.write_text(s)

# 2) Cadastro atleta: aceita body.token e body.inviteToken.
p = Path('src/app/api/auth/register-athlete/route.ts')
s = p.read_text()
s = s.replace('async function resolveEnrollmentTarget(input: {\n  organizationSlug?: string;\n  inviteToken?: string;\n})', 'async function resolveEnrollmentTarget(input: {\n  organizationSlug?: string;\n  token?: string;\n  inviteToken?: string;\n})')
s = s.replace('  if (input.inviteToken) {', '  const normalizedInviteToken = (input.token || input.inviteToken || "").trim();\n\n  if (normalizedInviteToken) {')
s = s.replace('      WHERE token = ${input.inviteToken}', '      WHERE token = ${normalizedInviteToken}')
s = s.replace('  const { name, email, password, organizationSlug, inviteToken } = parsed.data;', '  const { name, email, password, organizationSlug } = parsed.data;\n  const inviteToken = (parsed.data.token || parsed.data.inviteToken || "").trim() || undefined;')
s = s.replace('const enrollment = await resolveEnrollmentTarget({ organizationSlug, inviteToken });', 'const enrollment = await resolveEnrollmentTarget({ organizationSlug, token: inviteToken, inviteToken });')
s = s.replace('"Assessoria nao encontrada com os dados informados. Verifique slug ou convite."', '"Convite invalido, expirado, inativo ou ja utilizado. Solicite um novo convite."')
p.write_text(s)

# 3) Front atleta: le token e inviteToken, envia os dois por compatibilidade, usa JSON seguro.
p = Path('src/components/auth/RegisterAtletaForm.tsx')
s = p.read_text()
if 'import { safeJson } from "@/lib/safe-json";' not in s:
    marker = 'import { UserRole } from "@/types";'
    s = s.replace(marker, marker + '\nimport { safeJson } from "@/lib/safe-json";')
s = s.replace('    const token = searchParams.get("token");\n    if (token) {\n      setValue("inviteToken", token, { shouldValidate: true });\n    }', '    const token = searchParams.get("token") || searchParams.get("inviteToken");\n    if (token) {\n      setValue("inviteToken", token.trim(), { shouldValidate: true });\n    }')
s = s.replace('          inviteToken: data.inviteToken?.trim() || undefined,', '          token: data.inviteToken?.trim() || undefined,\n          inviteToken: data.inviteToken?.trim() || undefined,')
s = s.replace('const payload = (await response.json()) as RegisterResponse | { error?: { message?: string } };', 'const payload = (await safeJson<RegisterResponse | { error?: { message?: string } }>(response)) ?? {};')
s = s.replace('const payload = (await response.json()) as OrganizationBySlugResponse | { error?: { message?: string } };', 'const payload = (await safeJson<OrganizationBySlugResponse | { error?: { message?: string } }>(response)) ?? {};')
p.write_text(s)

# 4) Activate admin: JSON seguro no lookup e ativacao.
p = Path('src/components/auth/ActivateAdminForm.tsx')
s = p.read_text()
if 'import { safeJson } from "@/lib/safe-json";' not in s:
    marker = 'import { UserRole } from "@/types";'
    s = s.replace(marker, marker + '\nimport { safeJson } from "@/lib/safe-json";')
s = s.replace('const payload = (await response.json()) as InviteLookupPayload;', 'const payload = (await safeJson<InviteLookupPayload>(response)) ?? {};')
s = s.replace('const payload = (await response.json()) as ActivateResponse | { error?: { message?: string } };', 'const payload = (await safeJson<ActivateResponse | { error?: { message?: string } }>(response)) ?? {};')
p.write_text(s)

# 5) Links devem usar ?token=, mantendo backend compativel com inviteToken.
for p in [
    Path('src/app/api/invites/route.ts'),
    Path('src/app/api/admin/invites/route.ts'),
    Path('src/app/api/admin/invites/[id]/resend/route.ts'),
]:
    if p.exists():
        s = p.read_text().replace('?inviteToken=${invite.token}', '?token=${invite.token}')
        s = s.replace('?inviteToken=${resent.token}', '?token=${resent.token}')
        s = s.replace('/register/atleta?inviteToken=', '/register/atleta?token=')
        p.write_text(s)

# 6) API /api/invites: libera leitura/criacao para ADMIN, COACH e ATHLETE.
p = Path('src/app/api/invites/route.ts')
s = p.read_text()
s = s.replace('function canCreateInvite(role: UserRole): boolean {\n  return role === UserRole.ADMIN || role === UserRole.ATHLETE;\n}', 'function canCreateInvite(role: UserRole): boolean {\n  return role === UserRole.ADMIN || role === UserRole.COACH || role === UserRole.ATHLETE;\n}')
s = s.replace('signupUrl: `/register/atleta?inviteToken=${invite.token}`', 'signupUrl: `/register/atleta?token=${invite.token}`')
p.write_text(s)

# 7) DELETE nunca deve responder 204 vazio.
for p in [
    Path('src/app/api/invites/[id]/route.ts'),
    Path('src/app/api/admin/invites/[id]/route.ts'),
    Path('src/app/api/super-admin/organization-invites/[id]/route.ts'),
]:
    if p.exists():
        s = p.read_text()
        s = s.replace('return new NextResponse(null, { status: 204 });', 'return NextResponse.json({ success: true });')
        s = s.replace('return new Response(null, { status: 204 });', 'return NextResponse.json({ success: true });')
        s = s.replace('return NextResponse.json(null, { status: 204 });', 'return NextResponse.json({ success: true });')
        p.write_text(s)

# 8) Services: erro/lista de convites com safeJson para nunca quebrar em JSON vazio.
p = Path('src/services/organization-service.ts')
s = p.read_text()
if 'import { safeJson } from "@/lib/safe-json";' not in s:
    marker = 'import { buildAuthHeaders } from "@/services/runtime";'
    s = s.replace(marker, marker + '\nimport { safeJson } from "@/lib/safe-json";')
s = s.replace('    const text = await response.text();\n    if (!text) return new Error(fallback);\n    const payload = JSON.parse(text) as { error?: { message?: string } };\n    return new Error(payload.error?.message ?? fallback);', '    const payload = await safeJson<{ error?: { message?: string } }>(response);\n    return new Error(payload?.error?.message ?? fallback);')
s = s.replace('    const text = await response.text();\n    if (!text) throw new Error(fallback);\n    return JSON.parse(text) as T;', '    const payload = await safeJson<T>(response);\n    if (!payload) throw new Error(fallback);\n    return payload;')
p.write_text(s)
PY

log "Verificando se ainda existem links antigos inviteToken="
grep -RIn "inviteToken=" src || true

log "Limpando cache, instalando e buildando"
rm -rf .next
npm install
npm run build

log "Commitando e enviando para o GitHub"
git add -A
git commit -m "fix fluxo completo de convites" || true
git pull --rebase origin main
git push origin main

log "Reiniciando aplicacao"
pm2 restart all || true

log "Teste rapido das rotas de convite"
printf '\nDica: agora teste no navegador em aba anonima criando um convite novo.\n'
printf 'Se ainda falhar, rode: pm2 logs --lines 200\n'
