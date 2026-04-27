#!/bin/bash
set -e

FILE="src/services/organization-service.ts"

if [ ! -f "$FILE" ]; then
  echo "Arquivo não encontrado: $FILE"
  exit 1
fi

echo "Corrigindo import não usado: safeJson..."

# Remove safeJson quando está junto com outros imports: { safeJson, x } ou { x, safeJson }
sed -i 's/{[[:space:]]*safeJson,[[:space:]]*/{/g' "$FILE"
sed -i 's/,[[:space:]]*safeJson[[:space:]]*}/}/g' "$FILE"

# Remove linha inteira se era somente import { safeJson } ...
sed -i '/import[[:space:]]*{[[:space:]]*safeJson[[:space:]]*}[[:space:]]*from/d' "$FILE"

echo "Verificando resultado:"
grep -n "safeJson" "$FILE" || echo "safeJson removido com sucesso."

echo "Rodando lint nos arquivos staged..."
npx eslint --fix "$FILE" || true

echo "Agora rode:"
echo "git add $FILE"
echo "git commit -m \"chore: sincroniza alterações feitas no servidor\""
echo "git push origin main"
