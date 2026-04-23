# Deploy VentuSuli em VPS Ubuntu (Docker + PostgreSQL + Caddy + SSL)

Este guia sobe o VentuSuli em uma VPS com:
- `app` (Next.js) em Docker
- `postgres` em Docker com volume persistente
- `caddy` como proxy reverso com HTTPS automático

## 1. Pré-requisitos

- VPS Ubuntu 22.04+ com IP público
- Domínio apontando para a VPS (registro `A`)
  - Exemplo: `app.seudominio.com -> <IP_DA_VPS>`
- Portas liberadas no firewall/security group:
  - `80/tcp`
  - `443/tcp`
  - `22/tcp` (SSH)

## 2. Instalar Docker e Compose Plugin

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
```

Saia e entre novamente na sessão SSH (para aplicar grupo `docker`).

## 3. Baixar projeto na VPS

```bash
git clone https://github.com/joaoferdev/VentoSuli-.git ventusuli
cd ventusuli
```

## 4. Configurar variáveis de produção

```bash
cp .env.production.example .env.production
nano .env.production
```

Ajuste obrigatoriamente:
- `DOMAIN`
- `NEXT_PUBLIC_APP_URL`
- `NEXTAUTH_URL`
- `JWT_SECRET`
- `NEXTAUTH_SECRET`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`

## 5. Subir stack de produção

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

## 6. Validar banco e app

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T app ./node_modules/.bin/prisma migrate status
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T app ./node_modules/.bin/prisma migrate deploy
```

Se for ambiente demo/staging:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T app npm run db:seed
```

## 7. Verificar HTTPS

Após alguns segundos/minutos (primeira emissão do certificado), acesse:

- `https://SEU_DOMAIN`

Caddy emitirá/renovará SSL automaticamente via Let's Encrypt.

## 8. Atualizações de deploy

```bash
cd ~/ventusuli
git pull origin main
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T app ./node_modules/.bin/prisma migrate deploy
```

## 9. Logs e troubleshooting

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f app
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f proxy
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f db
```

## 10. Backup rápido do PostgreSQL

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T db \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backup_$(date +%F_%H-%M-%S).sql
```

## Migração futura para banco externo

Quando migrar para banco gerenciado:
- altere `DATABASE_URL` (ou variáveis usadas para montá-la) para host externo
- remova/ignore o serviço `db` no compose de produção
- mantenha o app e Caddy iguais (sem reescrever aplicação)
