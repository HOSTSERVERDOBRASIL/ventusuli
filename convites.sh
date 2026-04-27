#!/bin/bash
set -e

echo "[1/7] Backup..."
BACKUP="backup-convites-load-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP"
cp -r src/services "$BACKUP/services"
cp -r src/app/api/invites "$BACKUP/api-invites" 2>/dev/null || true
cp -r src/app/api/admin/invites "$BACKUP/api-admin-invites" 2>/dev/null || true
cp -r src/app/api/super-admin/organization-invites "$BACKUP/api-super-admin-invites" 2>/dev/null || true

echo "[2/7] Criando helper safeJson..."
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

echo "[3/7] Corrigindo organization-service..."
python3 <<'PY'
from pathlib import Path

p = Path("src/services/organization-service.ts")
if not p.exists():
    raise SystemExit("Arquivo src/services/organization-service.ts nao encontrado")

s = p.read_text()

if 'import { safeJson } from "@/lib/safe-json";' not in s:
    lines = s.splitlines()
    insert_at = 0
    while insert_at < len(lines) and lines[insert_at].startswith("import "):
        insert_at += 1
    lines.insert(insert_at, 'import { safeJson } from "@/lib/safe-json";')
    s = "\n".join(lines) + "\n"

s = s.replace("await response.json()", "await safeJson(response)")

# Garante que deleteInvite nao tente ler JSON vazio
s = s.replace(
'''  if (!response.ok) {
    const payload = (await safeJson(response)) as { error?: { message?: string } };
    throw new Error(payload?.error?.message ?? "Erro ao excluir convite");
  }

  return (await safeJson(response)) as''',
'''  if (!response.ok) {
    const payload = (await safeJson(response)) as { error?: { message?: string } } | null;
    throw new Error(payload?.error?.message ?? "Erro ao excluir convite");
  }

  return { success: true } as'''
)

p.write_text(s)
PY

echo "[4/7] Corrigindo rotas DELETE para nunca retornar body vazio..."
python3 <<'PY'
from pathlib import Path

for p in [
    Path("src/app/api/invites/[id]/route.ts"),
    Path("src/app/api/admin/invites/[id]/route.ts"),
    Path("src/app/api/super-admin/organization-invites/[id]/route.ts"),
]:
    if not p.exists():
        continue

    s = p.read_text()

    if "NextResponse.json" not in s and "NextResponse" in s:
        pass

    s = s.replace(
        "return new NextResponse(null, { status: 204 });",
        'return NextResponse.json({ success: true });'
    )
    s = s.replace(
        "return new Response(null, { status: 204 });",
        'return NextResponse.json({ success: true });'
    )
    s = s.replace(
        "return NextResponse.json(null, { status: 204 });",
        'return NextResponse.json({ success: true });'
    )

    p.write_text(s)
PY

echo "[5/7] Padronizando token nos links..."
grep -RIl "inviteToken=" src 2>/dev/null | xargs -r sed -i 's/inviteToken=/token=/g'
grep -RIl "adminInviteToken=" src 2>/dev/null | xargs -r sed -i 's/adminInviteToken=/token=/g'
grep -RIl "organizationInviteToken=" src 2>/dev/null | xargs -r sed -i 's/organizationInviteToken=/token=/g'

echo "[6/7] Limpando cache e buildando..."
rm -rf .next
npm install
npm run build

echo "[7/7] Commit, push e restart..."
git add -A
git commit -m "fix carregar convites e json vazio" || true
git pull --rebase origin main || true
git push origin main || true

pm2 restart all || true

echo "OK. Agora teste a tela de convites novamente."
