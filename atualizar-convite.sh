#!/usr/bin/env bash
set -euo pipefail

log() { printf '\n[%s] %s\n' "$(date +%H:%M:%S)" "$*"; }

if [ ! -f package.json ] || [ ! -d src ]; then
  echo "ERRO: rode este script na raiz do projeto VentuSuli, onde existe package.json e pasta src."
  exit 1
fi

BACKUP="backup-token-todos-perfis-$(date +%Y%m%d-%H%M%S)"
log "Criando backup em $BACKUP"
mkdir -p "$BACKUP"
cp -a src "$BACKUP/src"
[ -f package.json ] && cp package.json "$BACKUP/package.json"
[ -f package-lock.json ] && cp package-lock.json "$BACKUP/package-lock.json"

log "Padronizando parametros de convite para token"
# Links/query params antigos para o padrao unico token.
grep -RIl --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git "inviteToken" src 2>/dev/null | xargs -r sed -i 's/inviteToken/token/g'
grep -RIl --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git "adminInviteToken" src 2>/dev/null | xargs -r sed -i 's/adminInviteToken/token/g'
grep -RIl --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git "organizationInviteToken" src 2>/dev/null | xargs -r sed -i 's/organizationInviteToken/token/g'
grep -RIl --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git "athleteInviteToken" src 2>/dev/null | xargs -r sed -i 's/athleteInviteToken/token/g'

# Corrige URLs montadas com parametros antigos.
grep -RIl --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git "inviteToken=" src 2>/dev/null | xargs -r sed -i 's/inviteToken=/token=/g'
grep -RIl --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git "adminInviteToken=" src 2>/dev/null | xargs -r sed -i 's/adminInviteToken=/token=/g'
grep -RIl --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git "organizationInviteToken=" src 2>/dev/null | xargs -r sed -i 's/organizationInviteToken=/token=/g'
grep -RIl --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git "athleteInviteToken=" src 2>/dev/null | xargs -r sed -i 's/athleteInviteToken=/token=/g'

log "Criando helper para ler token com compatibilidade"
mkdir -p src/lib
cat > src/lib/invite-token.ts <<'TS'
export function getInviteTokenFromSearchParams(searchParams: URLSearchParams): string {
  return (
    searchParams.get("token") ||
    searchParams.get("inviteToken") ||
    searchParams.get("adminInviteToken") ||
    searchParams.get("organizationInviteToken") ||
    searchParams.get("athleteInviteToken") ||
    ""
  ).trim();
}

export function getInviteTokenFromObject(input: unknown): string {
  if (!input || typeof input !== "object") return "";
  const data = input as Record<string, unknown>;
  const value =
    data.token ??
    data.inviteToken ??
    data.adminInviteToken ??
    data.organizationInviteToken ??
    data.athleteInviteToken ??
    "";
  return typeof value === "string" ? value.trim() : "";
}

export function appendInviteToken(url: string, token: string): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}token=${encodeURIComponent(token)}`;
}
TS

log "Corrigindo leituras comuns em paginas de cadastro/ativacao"
# Injeta compatibilidade sem quebrar se ja usa searchParams.get("token").
# Em arquivos de register/activate/onboarding, troca leituras diretas remanescentes por token com fallback.
find src/app -type f \( -name 'page.tsx' -o -name 'route.ts' -o -name '*.ts' -o -name '*.tsx' \) \
  | grep -E 'register|activate|invite|convite|onboarding|admin|athlete|atleta|organization|assessoria' \
  | while read -r f; do
      perl -0pi -e 's/searchParams\.get\("inviteToken"\)/searchParams.get("token") || searchParams.get("inviteToken")/g' "$f"
      perl -0pi -e 's/searchParams\.get\("adminInviteToken"\)/searchParams.get("token") || searchParams.get("adminInviteToken")/g' "$f"
      perl -0pi -e 's/searchParams\.get\("organizationInviteToken"\)/searchParams.get("token") || searchParams.get("organizationInviteToken")/g' "$f"
      perl -0pi -e 's/searchParams\.get\("athleteInviteToken"\)/searchParams.get("token") || searchParams.get("athleteInviteToken")/g' "$f"
    done

log "Corrigindo APIs para aceitarem token e aliases antigos"
# Se algum route.ts faz const { token } = await request.json(), isso ja funciona com token.
# Aqui adicionamos compatibilidade onde ainda existe desestruturacao de nomes antigos apos sed.
find src/app/api -type f -name 'route.ts' | while read -r f; do
  perl -0pi -e 's/const\s*\{\s*token\s*\}\s*=\s*await request\.json\(\);/const body = await request.json();\n  const token = (body.token || body.inviteToken || body.adminInviteToken || body.organizationInviteToken || body.athleteInviteToken || "").trim();/g' "$f"
done

log "Garantindo que endpoints DELETE nao respondam vazio"
find src/app/api -type f -name 'route.ts' | while read -r f; do
  perl -0pi -e 's/return\s+new\s+NextResponse\(null,\s*\{\s*status:\s*204\s*\}\s*\);/return NextResponse.json({ success: true });/g' "$f"
  perl -0pi -e 's/return\s+new\s+Response\(null,\s*\{\s*status:\s*204\s*\}\s*\);/return Response.json({ success: true });/g' "$f"
done

log "Criando helper safe-json"
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

log "Aplicando safe-json nos services principais"
# Evita quebrar por JSON vazio em services. Mantem cast existente quando possivel.
find src/services -type f -name '*.ts' | while read -r f; do
  if grep -q 'response.json()' "$f"; then
    if ! grep -q 'safeJson' "$f"; then
      perl -0pi -e 's/^(import .+?;\n)/$1import { safeJson } from "@\/lib\/safe-json";\n/s' "$f"
    fi
    perl -0pi -e 's/await response\.json\(\)/await safeJson(response)/g' "$f"
    perl -0pi -e 's/response\.json\(\)\.catch\(\(\) => null\)/safeJson(response)/g' "$f"
  fi
done

log "Relatorio de tokens antigos restantes"
OLD=$(grep -RIn --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git -E 'inviteToken|adminInviteToken|organizationInviteToken|athleteInviteToken' src || true)
if [ -n "$OLD" ]; then
  echo "$OLD"
  echo "AVISO: sobraram referencias antigas acima. Algumas podem estar apenas no helper de compatibilidade."
else
  echo "OK: nenhum alias antigo fora do helper."
fi

log "Limpando build anterior e gerando novo build"
rm -rf .next
npm install
npm run build

log "Commitando alteracoes"
git add -A
git commit -m "fix token convites todos perfis" || true

log "Atualizando e enviando para GitHub"
git pull --rebase origin main || {
  echo "Rebase falhou. Salvando alteracoes pendentes e tentando de novo."
  git stash push -u -m "auto-token-todos-perfis" || true
  git pull --rebase origin main
  git stash pop || true
  git add -A
  git commit -m "fix token convites todos perfis" || true
}
git push origin main

log "Reiniciando aplicacao"
if command -v pm2 >/dev/null 2>&1; then
  pm2 restart all
elif command -v docker >/dev/null 2>&1 && [ -f docker-compose.yml ]; then
  docker compose up -d --build
else
  echo "AVISO: nao encontrei pm2 nem docker compose. Reinicie a aplicacao manualmente."
fi

log "Concluido. Teste convites novos para super admin, admin/assessoria, atleta e qualquer perfil adicional."
