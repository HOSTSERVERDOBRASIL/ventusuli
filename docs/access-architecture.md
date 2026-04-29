# Arquitetura de Acesso (VentuSuli)

Data: 2026-04-20

## Objetivo

Definir acesso por papel de forma coerente para SaaS multi-tenant, sem heranca implicita entre plataforma e tenant.

## Principios

- SUPER_ADMIN opera a plataforma.
- ADMIN opera a assessoria (tenant).
- COACH opera trilha tecnica propria.
- ATHLETE opera jornada pessoal.
- Acesso sempre por policy explicita.

## Papeis

### SUPER_ADMIN (camada plataforma)

Permitido:

- `/super-admin`
- `/super-admin/organizations`
- `/super-admin/admin-invites`
- `/super-admin/billing`
- `/super-admin/audit`
- `/super-admin/support`

Bloqueado por padrao:

- `/admin/*`
- `/coach/*`
- rotas da jornada de atleta (`/`, `/provas`, `/minhas-inscricoes`, `/financeiro`, `/calendario`, `/evolucao`, `/comunidade`, `/avisos`, `/fotos`, `/recompensas`, `/meus-resgates`, `/patrocinadores`)

Regra de produto:

- Acesso de SUPER_ADMIN em tenant deve existir somente no futuro via impersonation explicita e auditavel.

### ADMIN (operacao da assessoria)

Permitido:

- `/admin`
- `/admin/eventos`
- `/admin/atletas`
- `/admin/financeiro`
- `/admin/recompensas`
- `/admin/resgates`
- `/admin/pontos`
- `/admin/fotos`
- `/admin/patrocinadores`
- `/admin/avisos`
- `/admin/configuracoes`

Tambem permitido:

- `/perfil`
- `/configuracoes/conta`

Bloqueado:

- `/super-admin/*`
- `/coach/*`
- jornada pessoal do atleta

### COACH (trilha tecnica)

Permitido:

- `/coach`
- `/coach/atletas`
- `/coach/treinos`
- `/coach/calendario`
- `/coach/comunidade`
- `/coach/avisos`

Tambem permitido:

- `/perfil`
- `/configuracoes/conta`

Bloqueado:

- `/admin/*`
- `/super-admin/*`
- jornada pessoal do atleta

### ATHLETE (jornada pessoal)

Permitido:

- `/`
- `/provas`
- `/minhas-inscricoes`
- `/financeiro`
- `/calendario`
- `/evolucao`
- `/comunidade`
- `/avisos`
- `/fotos`
- `/recompensas`
- `/meus-resgates`
- `/patrocinadores`
- `/perfil`
- `/configuracoes/conta`

Bloqueado:

- `/admin/*`
- `/coach/*`
- `/super-admin/*`

## Policies oficiais

- `SUPER_ADMIN_ONLY`: somente SUPER_ADMIN
- `ADMIN_ONLY`: somente ADMIN
- `COACH_AREA`: somente COACH
- `ATHLETE_AREA`: somente ATHLETE
- `TENANT_AUTHENTICATED`: ADMIN, COACH, ATHLETE
- `TENANT_STAFF`: ADMIN, COACH
- `NOTICES_READ`: ADMIN, COACH, ATHLETE
- `NOTICES_MANAGE`: somente ADMIN

## Dispatcher e redirecionamento

- `/dashboard` redireciona por papel:
  - SUPER_ADMIN -> `/super-admin`
  - ADMIN -> `/admin`
  - COACH -> `/coach`
  - ATHLETE com onboarding completo -> `/`
  - ATHLETE sem onboarding -> `/onboarding/atleta`
- `/atletas` e alias legado:
  - ADMIN -> `/admin/atletas`
  - COACH -> `/coach/atletas`

## Configuracoes separadas

- Conta pessoal: `/configuracoes/conta`
- Organizacao da assessoria: `/admin/configuracoes`
- `/configuracoes` atua como dispatcher por papel

## Rationale

- Evita vazamento de contexto entre plataforma e tenant.
- Elimina ambiguidade entre operacao administrativa, tecnica e jornada pessoal.
- Facilita manutencao e crescimento da aplicacao por trilhas claras.
