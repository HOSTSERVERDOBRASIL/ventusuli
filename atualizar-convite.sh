#!/usr/bin/env bash
set -euo pipefail

log(){ printf '\n[%s] %s\n' "$(date +%H:%M:%S)" "$*"; }

log "Validando projeto"
test -d .git || { echo "ERRO: rode este script dentro da pasta do projeto VentuSuli"; exit 1; }
test -d src || { echo "ERRO: pasta src nao encontrada"; exit 1; }
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
BACKUP="backup-convites-json-v2-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP"

log "Backup dos arquivos principais"
for f in \
  src/services/organization-service.ts \
  'src/app/api/invites/[id]/route.ts' \
  'src/app/api/super-admin/organization-invites/[id]/route.ts' \
  package-lock.json package.json; do
  [ -f "$f" ] && cp --parents "$f" "$BACKUP"/ || true
done

log "Aplicando patch de JSON vazio e token"
# Corrige links antigos inviteToken= para token=
if grep -RIl 'inviteToken=' src >/tmp/ventusuli_invitetoken_files 2>/dev/null; then
  xargs -r sed -i 's/inviteToken=/token=/g' </tmp/ventusuli_invitetoken_files
fi

python3 - <<'PY'
from pathlib import Path
import re

# 1) Corrige o service: DELETE nao pode chamar response.json()
p = Path('src/services/organization-service.ts')
if p.exists():
    s = p.read_text()
    # garante helpers seguros se ainda existir response.json direto em respostas vazias
    if 'async function parseJsonResponse' not in s:
        marker = 'async function parseApiError'
        idx = s.find(marker)
        if idx != -1:
            helper = '''\nasync function parseJsonResponse<T>(response: Response, fallback: string): Promise<T> {\n  const text = await response.text();\n\n  if (!text.trim()) {\n    throw new Error(fallback);\n  }\n\n  try {\n    return JSON.parse(text) as T;\n  } catch {\n    throw new Error(fallback);\n  }\n}\n\n'''
            # insere depois da parseApiError inteira se conseguir
            m = re.search(r'async function parseApiError[\s\S]*?\n}\n', s)
            if m:
                s = s[:m.end()] + helper + s[m.end():]
    # troca chamadas simples response.json por parseJsonResponse nos principais metodos de convite/organizacao
    replacements = {
        'const payload = (await response.json()) as OrganizationResponse;': 'const payload = await parseJsonResponse<OrganizationResponse>(response, "Resposta invalida ao carregar configuracoes da organizacao.");',
        'const payload = (await response.json()) as { data: OrganizationSettings };': 'const payload = await parseJsonResponse<{ data: OrganizationSettings }>(response, "Resposta invalida ao salvar configuracoes da organizacao.");',
        'const payload = (await response.json()) as InviteListResponse;': 'const payload = await parseJsonResponse<InviteListResponse>(response, "Resposta invalida ao carregar convites.");',
        'const payload = (await response.json()) as InviteResponse;': 'const payload = await parseJsonResponse<InviteResponse>(response, "Resposta invalida ao processar convite.");',
    }
    for a,b in replacements.items():
        s = s.replace(a,b)

    # substitui qualquer implementacao da funcao deleteInvite por uma versao que nao le JSON
    new_func = '''export async function deleteInvite(inviteId: string, accessToken?: string | null): Promise<void> {\n  const response = await fetch(`/api/invites/${inviteId}`, {\n    method: "DELETE",\n    headers: buildAuthHeaders(accessToken),\n  });\n\n  if (!response.ok) {\n    throw await parseApiError(response, "Nao foi possivel excluir convite.");\n  }\n\n  // DELETE pode responder sem corpo. Nao chame response.json() aqui,\n  // pois isso gera: Unexpected end of JSON input.\n}\n'''
    s2, n = re.subn(r'export async function deleteInvite\([\s\S]*?\n}\n(?=\n|$)', new_func, s, count=1)
    if n:
        s = s2
    p.write_text(s)

# 2) Corrige rotas DELETE para sempre retornarem JSON, nao 204 vazio
for fname in ['src/app/api/invites/[id]/route.ts', 'src/app/api/super-admin/organization-invites/[id]/route.ts']:
    q = Path(fname)
    if not q.exists():
        continue
    t = q.read_text()
    t = t.replace('return new NextResponse(null, { status: 204 });', 'return NextResponse.json({ success: true });')
    t = t.replace('return new Response(null, { status: 204 });', 'return NextResponse.json({ success: true });')
    # se alguem colocou status 204 com json, normaliza para 200 json
    t = t.replace('return NextResponse.json(null, { status: 204 });', 'return NextResponse.json({ success: true });')
    q.write_text(t)
PY

log "Procurando response.json perigoso perto de DELETE"
if grep -RIn "response\.json()" src/services src/app 2>/dev/null; then
  echo "AVISO: revise os response.json acima. Se aparecer dentro de deleteInvite/excluir convite, ainda precisa corrigir."
else
  echo "OK: nenhum response.json direto encontrado em src/services/src/app."
fi

log "Instalando dependencias e gerando build"
npm install
npm run build

log "Commitando alteracoes"
git add src package.json package-lock.json 2>/dev/null || git add src package.json
if git diff --cached --quiet; then
  echo "Nada novo para commitar."
else
  git commit -m "fix convites json vazio"
fi

log "Atualizando branch e enviando para GitHub"
git pull --rebase origin "$BRANCH"
git push origin "$BRANCH"

log "Reiniciando aplicacao"
if command -v pm2 >/dev/null 2>&1; then
  pm2 restart all
elif command -v docker >/dev/null 2>&1 && [ -f docker-compose.yml -o -f compose.yml ]; then
  docker compose up -d --build
else
  echo "Nao encontrei pm2 nem docker compose. Reinicie sua aplicacao manualmente."
fi

log "Finalizado. Backup em: $BACKUP"
