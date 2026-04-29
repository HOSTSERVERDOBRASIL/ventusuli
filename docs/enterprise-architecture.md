# Arquitetura Enterprise Backend + Banco

Data: 2026-04-29

## Diretriz principal

O objetivo nao e redesenhar a plataforma, mas elevar o layout atual para um padrao enterprise por meio de refinamento visual, melhor hierarquia de informacao, modularizacao das areas e padronizacao da experiencia.

## Abordagem

A plataforma deve evoluir como um modular monolith bem separado por dominios, com backend unico, modulos internos claros, PostgreSQL como banco transacional, eventos internos para automacoes e filas para tarefas pesadas.

Microservicos so devem ser extraidos quando houver motivo operacional real, como escala independente, ownership separado ou processamento assíncrono com volume alto.

## Stack recomendada

- Backend: Next.js atual como aplicacao full-stack, com servicos por dominio; NestJS/Laravel continuam como opcoes futuras se o backend for separado.
- Banco principal: PostgreSQL.
- Cache e filas: Redis.
- Fotos: object storage externo, nunca banco.
- Infra futura: Docker, CI/CD, observabilidade, CDN e orquestracao quando o volume justificar.

## Dominios

- Identity & Access: login, sessoes, MFA, RBAC, multi-tenant e auditoria.
- Athletes: perfil, status, preferencias, documentos e historico.
- Events: provas, modalidades, categorias, inscricoes, elegibilidade e resultados.
- Payments / Financeiro: pagamentos, receitas, despesas, reembolsos, repasses, comissoes e conciliacao.
- Points / Loyalty: carteira, regras automaticas, transacoes, expiracao e estorno.
- Rewards / Marketplace: recompensas, estoque, resgates e fulfillment.
- Photos / Photo Commerce: galerias, fotos, venda, unlock por pontos e download seguro.
- Sponsors: patrocinadores, campanhas, cupons, placements e metricas.
- Training / Coach: planos, sessoes, progresso e relacao coach-atleta.
- Community: posts, comentarios, reacoes, desafios e rankings.
- Notifications: in-app, e-mail, Telegram/WhatsApp/push quando habilitados.

## Regras de banco

- Toda tabela critica de tenant deve possuir `organization_id` ou equivalente atual (`organizationId`).
- Nenhuma consulta operacional deve buscar dados de tenant sem filtrar pela organizacao.
- Fotos ficam no storage externo; no PostgreSQL ficam storage key, metadata, status, preco e custo em pontos.
- Transacoes financeiras e de pontos precisam ser idempotentes e auditaveis.

## Pontos

O atleta nao solicita pontos.

Pontos sao gerados automaticamente por eventos internos, por exemplo:

- `event.registration_paid`
- `event.participation_confirmed`
- `training.session_completed`
- `photo.purchase_completed`
- `reward.redeemed`
- `challenge.completed`

Lancamentos manuais existem apenas para administracao e auditoria.

## Eventos internos

Eventos internos devem acionar tarefas como:

- gerar pontos automaticamente;
- enviar notificacoes;
- criar entradas financeiras;
- liberar fotos apos pagamento;
- atualizar metricas de patrocinador;
- alimentar analytics futuro.

## Layout enterprise sem redesign

Nao redesenhar o layout do zero.

Permitido:

- melhorar espacamentos, hierarquia, titulos, agrupamentos, cards, tabelas, filtros, botoes, estados vazios e responsividade;
- criar menus internos por modulo;
- reorganizar a ordem dos blocos quando isso melhora clareza operacional.

Nao permitido:

- alterar drasticamente a identidade visual;
- trocar a estrutura base da tela;
- mudar fluxos principais ja existentes sem necessidade de produto;
- substituir componentes principais por uma linguagem visual nova.

## Prioridade visual por modulo

Dashboard do atleta:

1. Provas lancadas.
2. Provas disponiveis.
3. Minhas inscricoes.
4. Pontos.
5. Fotos.
6. Recompensas.
7. Avisos.

Financeiro:

- Visao geral.
- Receitas.
- Despesas.
- Inscricoes.
- Fotos.
- Patrocinadores.
- Repasses.
- Relatorios.

Fotos:

- Minhas fotos.
- Fotos por prova.
- Comprar fotos.
- Desbloquear com pontos.
- Historico de fotos.

Patrocinadores:

- Patrocinadores ativos.
- Campanhas.
- Produtos patrocinados.
- Cupons.
- Metricas.

## Roadmap tecnico

1. Base enterprise: multi-tenant, RBAC, audit logs, modulos organizados, dashboard por perfil e financeiro separado.
2. Pontos e recompensas: regras automaticas, carteira, transacoes auditaveis, marketplace e resgates.
3. Fotos: storage externo, upload, watermark, galerias, venda, pontos e downloads assinados.
4. Patrocinadores: cadastro, campanhas, placements, metricas e portal.
5. Escala: filas, cache, CDN, analytics separado, observabilidade e relatorios avancados.
