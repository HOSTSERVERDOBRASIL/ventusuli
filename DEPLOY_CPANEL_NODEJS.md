# Deploy no cPanel (Node.js App + PostgreSQL externo)

Este projeto pode rodar no cPanel **somente se a hospedagem tiver suporte a Node.js Application**.
Como o app usa **Next.js + Prisma + PostgreSQL**, o cenário recomendado no cPanel é:

- aplicação Node.js habilitada no painel
- banco PostgreSQL remoto/acessível pelo host do cPanel
- execução de build do Next.js no servidor
- migrations do Prisma aplicadas antes de iniciar a aplicação

> Observação: hospedagem cPanel compartilhada sem Node.js App normalmente **não** roda esse projeto corretamente.

## 1. Preparar arquivos

Envie os arquivos do projeto para uma pasta como:

```bash
/home/SEU_USUARIO/ventusuli
```

Você pode subir por Git, Gerenciador de Arquivos ou ZIP.

## 2. Criar o arquivo de ambiente

No servidor, copie:

```bash
cp .env.cpanel.example .env
```

Preencha principalmente:

- `NEXT_PUBLIC_APP_URL`
- `NEXTAUTH_URL`
- `DATABASE_URL`
- `JWT_SECRET`
- `NEXTAUTH_SECRET`
- `SUPER_ADMIN_EMAIL`
- `SUPER_ADMIN_PASSWORD`

### Exemplo de DATABASE_URL

```bash
postgresql://usuario:senha@host-do-postgres:5432/ventu_suli?schema=public
```

Se o seu provedor exigir SSL:

```bash
postgresql://usuario:senha@host-do-postgres:5432/ventu_suli?schema=public&sslmode=require
```

## 3. Configurar Node.js App no cPanel

No cPanel, abra **Setup Node.js App** e configure:

- **Node.js version**: 20.x ou superior
- **Application mode**: Production
- **Application root**: pasta do projeto
- **Application URL**: seu domínio/subdomínio
- **Application startup file**: `scripts/cpanel-start.mjs`

Esse startup file:

- cria `public/uploads` caso não exista
- aplica `prisma migrate deploy`
- inicia `next start`

Isso reduz dependência de shell wrapper e costuma funcionar melhor em provedores cPanel.

## 4. Instalar dependências

No terminal do cPanel/SSH:

```bash
cd ~/ventusuli
npm ci
```

## 5. Preparar uploads e buildar o projeto

```bash
npm run cpanel:build
```

Esse comando garante que `public/uploads` exista antes do build.

## 6. Aplicar migrations

```bash
npm run cpanel:migrate
```

Se quiser popular ambiente inicial/demonstrativo:

```bash
npm run cpanel:seed
```

## 7. Iniciar/reiniciar a app

Se o seu cPanel permitir definir o comando de startup, use:

```bash
npm run cpanel:start
```

Se o painel só reiniciar a aplicação já cadastrada, salve a app e clique em **Restart**.

## 8. Comandos úteis

```bash
npm run build
npm run cpanel:migrate
npm run cpanel:seed
npm run cpanel:start
```

## 9. Limitações importantes do cPanel

- este projeto **não usa MySQL**, usa **PostgreSQL**
- Prisma precisa que o `DATABASE_URL` esteja correto antes do build/start
- alguns planos cPanel encerram processos Node após inatividade ou bloqueiam apps mais pesadas
- upload local (`public/uploads`) depende de persistência do filesystem da hospedagem
- se você não tiver Redis/Upstash no cPanel, defina `RATE_LIMIT_BACKEND=memory`
- `RATE_LIMIT_BACKEND=memory` é aceitável apenas para instância única
- para produção mais estável, o ideal continua sendo VPS/Railway

## 10. Checklist rápido

- Node.js App habilitado
- `.env` preenchido
- `RATE_LIMIT_BACKEND=memory` se não houver Redis/Upstash
- PostgreSQL remoto acessível
- `npm ci` executado
- `npm run cpanel:build` executado
- `npm run cpanel:migrate` executado
- app reiniciada no painel
