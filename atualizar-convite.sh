#!/bin/sh
set -eu

# Uso:
#   sh atualizar-convites-no-servidor.sh
# Rode na raiz do projeto no servidor, dentro da pasta do git.

BRANCH="${BRANCH:-main}"
COMMIT_MSG="fix: corrigir convites e resposta JSON vazia"

echo "[1/8] Validando pasta do projeto..."
if [ ! -d .git ]; then
  echo "ERRO: rode este script dentro da raiz do projeto, onde existe a pasta .git"
  exit 1
fi
if [ ! -d src ]; then
  echo "ERRO: pasta src nao encontrada. Voce esta na raiz correta do projeto?"
  exit 1
fi

echo "[2/8] Salvando backup local dos arquivos alterados..."
BACKUP_DIR="backup-convites-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
for f in \
  "src/app/api/invites/[id]/route.ts" \
  "src/components/auth/AuthTokenProvider.tsx" \
  "src/services/organization-service.ts"; do
  if [ -f "$f" ]; then
    mkdir -p "$BACKUP_DIR/$(dirname "$f")"
    cp "$f" "$BACKUP_DIR/$f"
  fi
done

echo "[3/8] Atualizando codigo do GitHub antes do patch..."
git fetch origin
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
  git checkout "$BRANCH"
fi
git pull --rebase origin "$BRANCH"

echo "[4/8] Corrigindo links de convite inviteToken para token..."
if grep -RIl "inviteToken=" src >/tmp/ventusuli_invite_files.txt 2>/dev/null; then
  xargs sed -i 's/inviteToken=/token=/g' </tmp/ventusuli_invite_files.txt
fi
rm -f /tmp/ventusuli_invite_files.txt

echo "[5/8] Corrigindo DELETE de convite para sempre retornar JSON..."
INVITE_DELETE='src/app/api/invites/[id]/route.ts'
if [ -f "$INVITE_DELETE" ]; then
  sed -i 's/return new NextResponse(null, { status: 204 });/return NextResponse.json({ success: true });/g' "$INVITE_DELETE"
  sed -i 's/return new Response(null, { status: 204 });/return NextResponse.json({ success: true });/g' "$INVITE_DELETE"
fi

echo "[6/8] Protegendo parse de JSON vazio no AuthTokenProvider..."
AUTH='src/components/auth/AuthTokenProvider.tsx'
if [ -f "$AUTH" ] && grep -q 'await response.json()' "$AUTH"; then
  perl -0pi -e 's/const payload = \(await response\.json\(\)\) as \{ user\?: SessionUser \};\s*return payload\.user \?\? null;/const text = await response.text();\n    if (!text.trim()) return null;\n\n    const payload = JSON.parse(text) as { user?: SessionUser };\n    return payload.user ?? null;/s' "$AUTH"
fi

echo "[7/8] Instalando dependencias e validando build..."
npm install
npm run build

echo "[8/8] Commitando e enviando para o GitHub..."
git status --short
if git diff --quiet; then
  echo "Nada para commitar. As correcoes ja estavam aplicadas."
else
  git add src package.json package-lock.json 2>/dev/null || git add src
  git commit -m "$COMMIT_MSG"
  git push origin "$BRANCH"
fi

echo "Reiniciando aplicacao..."
if command -v pm2 >/dev/null 2>&1; then
  pm2 restart all
elif command -v docker >/dev/null 2>&1 && [ -f docker-compose.yml ]; then
  docker compose up -d --build
else
  echo "Reinicio automatico nao encontrado. Reinicie manualmente sua aplicacao Node/Next."
fi

echo "OK: correcoes aplicadas, build validado e GitHub atualizado na branch $BRANCH."
