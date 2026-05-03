# Spec Forte do Sistema VentuSuli

Data: 2026-05-03

## 0. Estado Atual da Implementacao

Esta secao registra o estado real do sistema apos a entrega da agenda oficial de provas, a revisao de escopo para producao e o primeiro corte do cockpit da prova.

### Terminologia do Tenant Ventu Suli

- O sistema suporta tipos/modelos como `GRUPO_CORRIDA`, `ASSESSORIA`, `ASSOCIACAO`, `CLUBE` e perfis tecnicos como treinador.
- Para o tenant/produto Ventu Suli, a nomenclatura principal exibida ao usuario deve ser **Grupo**.
- Evitar "assessoria" nas telas centrais do Ventu Suli quando o contexto for a organizacao do usuario.
- Exemplos: "Gestor do grupo", "Grupo", "Codigo de membro", "Atleta do grupo".

### Implementado

- Modelo de agenda oficial da assessoria no Prisma:
  - `OrganizationRacePlan`
  - `AthleteRaceParticipation`
  - `OrganizationRacePlanStatus`
  - `RacePlanAthleteAction`
  - `AthleteRaceParticipationStatus`
- Modelo base de integracoes externas no Prisma:
  - `ExternalPlatform`
  - `PlatformCredential`
  - `ExternalEvent`
  - `ExternalRegistration`
  - `ExternalOrder`
  - `SyncLog`
- API administrativa para agenda oficial:
  - `GET /api/admin/race-plans`
  - `POST /api/admin/race-plans`
  - `GET /api/admin/race-plans/by-event/:eventId`
- API do atleta para agenda oficial:
  - `GET /api/race-plans`
  - `POST /api/race-plans/:id/participations`
- Tela admin de provas com acao para abrir uma prova existente na lista oficial da assessoria.
- Tela admin de detalhe da prova com bloco "Lista da assessoria", mostrando atletas que registraram participacao pela agenda oficial.
- Tela do atleta em `/provas` com bloco "Provas da assessoria" e acao "Quero participar".
- Padronizacao visual do logo no fluxo de MFA para usar a mesma escala hero do login.
- Policies de API adicionadas para `/api/admin/race-plans` e `/api/race-plans`.
- Primeiro corte do cockpit da prova:
  - `GET /api/admin/cockpit/events/:id`
  - Tela `/admin/eventos/:id/cockpit`
  - Atalhos a partir da listagem e do detalhe administrativo da prova.
  - Agregacao de inscricoes, pagamentos, presenca, lista da assessoria, inscricao coletiva, patrocinadores, fotos e checklist calculada.
  - Validado com `npm run type-check` e `npm run build`.
  - Publicado na `main` no commit `6e2bfbf`.

### Parcialmente Implementado

- A estrutura de dados para integracoes externas existe, mas o fluxo completo de sincronizacao, normalizacao, deduplicacao e curadoria por UI ainda deve ser finalizado antes de ser considerado pronto para operacao.
- A agenda oficial ja registra interesse/participacao do atleta, mas ainda nao cobre toda a operacao esperada de fechamento, conclusao, comunicados especificos, exportacao, presenca por race plan e automacoes pos-prova.
- O campo `audience` existe no modelo de agenda oficial, mas a API atual do atleta ainda lista provas abertas por organizacao sem aplicar segmentacao avancada por grupos, nivel, cidade, premium ou selecao manual.
- A participacao pode guardar distancia, link/codigo externo e observacao, mas a UI atual usa o caminho simples de "Quero participar" sem formulario avancado para esses campos.
- O cockpit da prova existe como primeira versao de leitura/agregacao, mas ainda nao tem checklist persistente, acoes em lote, comunicados por prova, exportacao, edicao de fase operacional ou financeiro proprio por prova.

### Pendente para Fechar o Fluxo Forte

- Tela administrativa da central de provas importadas.
- Jobs de sync com TicketSports e outras APIs externas.
- Normalizador/deduplicador de provas externas.
- Conversao assistida de `ExternalEvent` para `Event` e `OrganizationRacePlan`.
- Envio real aos atletas por notificacao/aviso ao abrir uma prova.
- Segmentacao de audiencia na API e na UI.
- Acoes administrativas para fechar, cancelar, confirmar equipe, concluir prova, exportar lista e persistir checklist operacional.
- Vinculo automatico com pagamento interno, inscricao coletiva, pontos, fotos e comunicados pos-prova.

## 1. Visao

O VentuSuli e uma plataforma SaaS multi-tenant para assessorias esportivas, organizadores e comunidades de atletas. O sistema centraliza operacao de eventos, atletas, inscricoes, pagamentos, financeiro, treinos, pontuacao, recompensas, fotos, patrocinadores, comunicados, comunidade, auditoria e integracoes externas.

O produto deve funcionar como um modular monolith: uma aplicacao Next.js full-stack com dominios bem separados, PostgreSQL como fonte transacional principal, Prisma como camada de persistencia, Redis para rate limit/cache/filas quando habilitado e storage externo/local para imagens e fotos.

## 2. Objetivos

- Permitir que uma assessoria esportiva opere sua base de atletas com controle de acesso, eventos, pagamentos, financeiro e comunicacao.
- Entregar uma jornada clara para atletas: descobrir provas, inscrever-se, acompanhar pagamentos, treinos, evolucao, pontos, recompensas, fotos e avisos.
- Separar plataforma, tenant e jornadas pessoais com RBAC explicito e sem heranca implicita perigosa.
- Manter todos os dados criticos isolados por organizacao.
- Garantir auditabilidade para acoes administrativas, movimentacoes financeiras, pontos, pagamentos e automacoes.
- Preparar a plataforma para escalar por modulos sem quebrar os fluxos existentes.

## 3. Nao Objetivos

- Nao transformar o sistema em microservicos antes de haver necessidade operacional real.
- Nao permitir acesso de `SUPER_ADMIN` ao tenant sem impersonation futura, explicita e auditavel.
- Nao armazenar binarios de fotos no banco.
- Nao permitir que atletas se atribuam pontos diretamente.
- Nao criar fluxos publicos sensiveis sem autenticacao, salvo login, registro, recuperacao de senha, ativacao de convite e health checks.

## 4. Personas e Papeis

### SUPER_ADMIN

Opera a camada plataforma. Gerencia organizacoes, convites de administradores, billing da plataforma, auditoria e suporte global. Nao acessa `/admin/*`, `/coach/*` ou jornada do atleta por padrao.

### ADMIN

Opera a assessoria. Gerencia eventos, atletas, financeiro, pontos, recompensas, resgates, fotos, patrocinadores, avisos e configuracoes da organizacao.

### FINANCE

Opera financeiro do tenant. Acessa receitas, despesas, pagamentos, recorrencias, relatorios e conciliacao quando autorizado.

### COACH

Opera a trilha tecnica. Acompanha atletas, treinos, calendario, comunidade e avisos relacionados ao acompanhamento esportivo.

### ATHLETE / PREMIUM_ATHLETE

Usa a jornada pessoal. Acessa provas, inscricoes, financeiro pessoal, calendario, evolucao, comunidade, avisos, fotos, recompensas, resgates, perfil e treinos.

### MANAGER, ORGANIZER, SUPPORT, MODERATOR, PARTNER

Perfis estendidos para operacao granular: gestao, organizacao de eventos, suporte, moderacao/fotos/comunidade e parceiros/patrocinadores.

## 5. Principios de Acesso

- Toda pagina e API protegida deve resolver uma policy oficial antes de executar regra de negocio.
- Toda consulta de tenant deve filtrar por `organization_id` ou equivalente (`organizationId`).
- `SUPER_ADMIN` pertence a camada plataforma e nao deve herdar acesso ao tenant.
- Usuarios com multiplos perfis devem escolher ou resolver o perfil ativo de forma explicita.
- Rotas de conta pessoal (`/perfil`, `/configuracoes/conta`) sao compartilhadas por usuarios autenticados do tenant.
- Mudancas de permissao devem ser registradas quando afetarem acesso operacional.

Policies principais:

- `SUPER_ADMIN_ONLY`
- `ADMIN_ONLY`
- `FINANCE_AREA`
- `TENANT_AUTHENTICATED`
- `TENANT_STAFF`
- `COACH_AREA`
- `ATHLETE_AREA`
- `PREMIUM_ATHLETE_AREA`
- `MANAGER_AREA`
- `ORGANIZER_AREA`
- `SUPPORT_AREA`
- `MODERATOR_AREA`
- `PARTNER_AREA`
- `NOTICES_READ`
- `NOTICES_MANAGE`

## 6. Modulos Funcionais

### 6.1 Identity, Auth e Multi-Tenant

Responsabilidades:

- Login, registro, refresh token, logout e sessoes.
- Registro de atleta por slug, convite ou criacao administrativa.
- Registro/ativacao de administradores por convite.
- Recuperacao de senha.
- MFA por TOTP, OTP por e-mail e codigos de recuperacao.
- Perfil ativo e multiplos perfis de acesso.
- Status de conta: ativo, convite pendente, aprovacao pendente e suspenso.

Criterios de aceite:

- Usuario sem sessao nao acessa paginas/APIs protegidas.
- Usuario suspenso nao consegue operar fluxos autenticados.
- Registro de atleta respeita organizacao e status de aprovacao.
- MFA bloqueia login ate verificacao valida quando habilitado.
- Refresh tokens sao hashados, revogaveis e com expiracao.

### 6.2 Organizacoes e Plataforma

Responsabilidades:

- Cadastro e administracao de organizacoes.
- Slug unico por organizacao.
- Planos: `FREE`, `STARTER`, `PRO`, `ENTERPRISE`.
- Status: setup pendente, ativo, suspenso, trial e cancelado.
- Billing da plataforma e convites de administradores.
- Auditoria global para acoes sensiveis.

Criterios de aceite:

- `SUPER_ADMIN` lista, cria, atualiza e suspende organizacoes.
- Organizacao inativa ou suspensa nao deve permitir operacao normal do tenant.
- Convites de administradores possuem token seguro, expiracao e estado de aceite.

### 6.3 Atletas / CRM

Responsabilidades:

- Cadastro, aprovacao, rejeicao, bloqueio e historico do atleta.
- Perfil esportivo: modalidade, nivel, metas, restricoes, equipamentos, disponibilidade, medidas e contato de emergencia.
- Numeracao de associado por organizacao.
- Observacoes, cobrancas e relacionamentos com inscricoes, treinos, pontos e pagamentos.

Criterios de aceite:

- Admin/manager/coach so ve atletas da propria organizacao.
- Aprovacao altera status e libera jornada quando aplicavel.
- Bloqueio impede acoes novas sem apagar historico.
- CPF e numero de associado respeitam unicidade definida pelo dominio.

### 6.4 Eventos, Provas e Inscricoes

Responsabilidades:

- Criacao, edicao, duplicacao, publicacao, cancelamento e finalizacao de eventos.
- Importacao de provas vindas de APIs externas para uma central de curadoria.
- Conversao de prova importada em evento oficial da organizacao somente apos decisao do admin.
- Distancias, categorias, preco, capacidade, imagem, local, datas e geofence/check-in quando configurado.
- Catalogo de provas para atletas.
- Lista oficial de provas da assessoria, representando as provas em que a equipe pretende participar.
- Envio/divulgacao de provas selecionadas para atletas apos adicao/publicacao pelo admin.
- Disponibilizacao da prova adicionada na ferramenta do atleta com acao clara para participar/manifestar interesse/inscrever-se.
- Inscricao individual e coletiva.
- Status de inscricao: interessado, pagamento pendente, confirmado e cancelado.
- Check-in/presenca.

Criterios de aceite:

- Evento em rascunho nao aparece no catalogo publico do atleta.
- Prova importada nao aparece para atletas ate ser aprovada/adicionada por admin autorizado.
- Prova importada deve preservar origem, ID externo, payload original e status de curadoria.
- Prova adicionada pelo admin deve ficar visivel para atletas elegiveis no catalogo e/ou dashboard com botao de participacao.
- Prova adicionada deve entrar na lista oficial da assessoria quando marcada como participacao da equipe.
- Publicacao valida campos obrigatorios e capacidade.
- Atleta nao confirma inscricao paga sem pagamento confirmado ou isencao administrativa registrada.
- Cancelamento preserva historico financeiro e de presenca.
- Check-in respeita janela do evento e geofence quando habilitado.

### 6.4.1 Central de Provas Importadas

Responsabilidades:

- Conectar plataformas externas de provas por API, por exemplo TicketSports e outras fontes futuras.
- Buscar provas automaticamente por agenda, modalidade, regiao, organizador, cidade, data ou palavra-chave.
- Normalizar dados externos em um formato unico: nome, data, local, cidade, estado, distancias, categorias, preco, link externo, imagem, organizador, status e origem.
- Deduplicar provas repetidas entre fontes usando ID externo, nome, data, cidade, local e distancia.
- Exibir uma tela de curadoria para o admin revisar provas encontradas.
- Permitir que o admin ignore, arquive, marque como relevante, edite dados normalizados ou adicione a prova ao calendario da assessoria.
- Permitir selecao de audiencia antes do envio: todos os atletas, grupos, niveis, modalidades, cidade/estado, atletas premium ou atletas escolhidos manualmente.
- Enviar a prova escolhida aos atletas via catalogo interno, aviso/notificacao e destaque no dashboard quando configurado.
- Tornar a prova escolhida participavel na ferramenta do atleta, respeitando o tipo de acao configurado: interesse, inscricao interna, link externo ou inscricao coletiva pela assessoria.
- Manter vinculo entre prova importada e evento criado internamente.

Estados da prova importada:

- `DISCOVERED`: prova encontrada pela API externa e ainda nao revisada.
- `REVIEWING`: prova em curadoria pelo admin.
- `APPROVED`: prova aprovada para entrar no calendario interno.
- `ADDED_TO_CALENDAR`: prova convertida em evento da organizacao.
- `SENT_TO_ATHLETES`: prova enviada/divulgada para audiencia definida.
- `IGNORED`: prova descartada pelo admin.
- `ARCHIVED`: prova antiga ou sem relevancia operacional.
- `SYNC_ERROR`: prova com erro de atualizacao ou payload invalido.

Criterios de aceite:

- Sync externo nao cria evento oficial automaticamente sem configuracao explicita.
- Admin consegue comparar provas importadas, filtrar por data/local/modalidade e selecionar quais entram no sistema.
- Ao adicionar uma prova, o sistema cria ou atualiza um `Event` interno com origem rastreavel.
- Ao enviar para atletas, o sistema cria notificacoes/avisos e registra a audiencia escolhida.
- Atleta recebe apenas provas publicadas para sua audiencia e organizacao.
- Atleta elegivel consegue abrir a prova e executar a acao de participacao configurada pelo admin.
- Reprocessar a mesma fonte externa nao duplica prova nem evento.
- Se a plataforma externa remover ou alterar a prova, o sistema registra diferenca para revisao em vez de sobrescrever cegamente campos editados pelo admin.

### 6.4.2 Lista Oficial de Provas da Assessoria

Responsabilidades:

- Manter uma lista central das provas em que a assessoria vai participar.
- Permitir que o admin monte a agenda da equipe a partir de provas importadas por API ou eventos criados manualmente.
- Separar prova descoberta/importada de prova assumida pela assessoria como participacao oficial.
- Exibir para atletas uma lista clara de "provas da assessoria" com data, local, distancias, status, prazo, orientacoes e acao de participacao.
- Permitir ao admin acompanhar quais atletas demonstraram interesse, confirmaram participacao, estao pendentes de pagamento, entraram em inscricao coletiva ou foram confirmados externamente.
- Permitir comunicados especificos por prova para os atletas participantes ou interessados.
- Permitir estados operacionais da participacao da assessoria: planejada, aberta para atletas, encerrada, cancelada e concluida.

Implementacao atual:

- O admin consegue abrir uma prova ja cadastrada na lista oficial da assessoria pela tela `/admin/eventos`.
- A abertura cria ou atualiza um `OrganizationRacePlan` com status `OPEN_TO_ATHLETES` e acao padrao `INTEREST`.
- A tela `/admin/eventos/:id` mostra a lista de atletas que entraram pela agenda oficial.
- A tela `/provas` mostra ao atleta as provas abertas na agenda oficial da assessoria.
- O atleta consegue clicar em "Quero participar", gerando um `AthleteRaceParticipation`.
- A API bloqueia participacao em prova fechada, fora da janela `opensAt/closesAt` ou de outra organizacao.

Limitacoes atuais:

- Ainda nao ha tela completa para editar status, audiencia, logistica, prazo e acao principal da agenda.
- Ainda nao ha filtro avancado de audiencia aplicado na listagem do atleta.
- Ainda nao ha exportacao da lista, envio de comunicado especifico, fechamento/conclusao por UI ou integracao automatica com pontos e pagamentos.

Estados da participacao da assessoria:

- `PLANNED`: prova escolhida pelo admin, mas ainda nao aberta aos atletas.
- `OPEN_TO_ATHLETES`: prova visivel e aberta para atletas participarem.
- `REGISTRATION_CLOSED`: prova visivel, mas sem novas participacoes.
- `TEAM_CONFIRMED`: grupo/assessoria confirmou participacao.
- `CANCELLED`: assessoria desistiu ou prova foi cancelada.
- `COMPLETED`: prova realizada e historico fechado.

Criterios de aceite:

- Atleta deve enxergar prioritariamente as provas que a assessoria selecionou para participar.
- A lista da assessoria deve diferenciar provas abertas para participacao de provas apenas planejadas.
- Admin consegue abrir ou fechar participacao dos atletas sem apagar a prova.
- Cada participacao de atleta gera registro interno para acompanhamento da equipe.
- Prova externa com inscricao em outro site ainda deve gerar registro interno de interesse/participacao no VentuSuli.
- A lista oficial deve alimentar dashboard do atleta, calendario, notificacoes e modulo de inscricoes quando aplicavel.

### 6.4.3 Jornada Operacional da Prova da Assessoria

Esta jornada e o fluxo central do produto para provas:

`prova externa -> curadoria admin -> lista oficial da assessoria -> atleta participa -> admin acompanha -> prova concluida`

Responsabilidades:

- Transformar provas externas ou cadastradas manualmente em oportunidades oficiais da equipe.
- Dar ao admin uma visao operacional por prova, nao apenas um formulario de cadastro.
- Dar ao atleta uma acao simples e clara para entrar na participacao da assessoria.
- Registrar todo interesse/participacao do atleta, mesmo quando a inscricao final acontece fora do VentuSuli.
- Permitir que a assessoria acompanhe a equipe antes, durante e depois da prova.

Tela do admin por prova da assessoria:

- Resumo da prova: nome, data, local, origem, link externo, distancias, status e observacoes.
- Status operacional da assessoria: planejada, aberta, encerrada, confirmada, cancelada ou concluida.
- Participantes por status: interessados, confirmados, pendentes de pagamento, inscritos externamente, inscricao coletiva e cancelados.
- Participantes por distancia/categoria.
- Pagamentos vinculados quando houver inscricao interna ou cobranca da assessoria.
- Comunicados enviados e rascunhos por prova.
- Logistica: ponto de encontro, retirada de kit, tenda, transporte, horarios e orientacoes do coach.
- Acoes: abrir para atletas, fechar participacao, enviar aviso, exportar lista, marcar presenca e concluir prova.

Tela do atleta por prova da assessoria:

- Detalhes essenciais: data, local, distancias, prazo, valor, link externo e orientacoes.
- Sinal claro de que a prova faz parte da agenda da assessoria.
- Botao principal conforme configuracao: "Quero participar", "Tenho interesse", "Entrar na inscricao coletiva", "Pagar inscricao" ou "Inscrever-se no site externo".
- Status da minha participacao.
- Orientacoes atualizadas da assessoria.
- Historico de avisos relacionados a prova.
- Confirmacao de inscricao externa quando aplicavel.

Status da participacao do atleta:

- `INTERESTED`: atleta demonstrou interesse, mas ainda nao confirmou.
- `CONFIRMED`: atleta confirmou participacao pela ferramenta.
- `PENDING_PAYMENT`: participacao depende de pagamento.
- `PAID`: pagamento interno confirmado.
- `REGISTERED_EXTERNALLY`: atleta informou que se inscreveu em plataforma externa.
- `IN_TEAM_REGISTRATION`: atleta entrou em inscricao coletiva gerenciada pela assessoria.
- `WAITLISTED`: atleta esta em lista de espera.
- `CANCELLED`: atleta cancelou ou foi removido da participacao.
- `ATTENDED`: presenca confirmada no dia da prova.
- `NO_SHOW`: atleta confirmado nao compareceu.

Regras de negocio:

- Uma prova pode existir como importada sem estar na agenda da assessoria.
- Uma prova so aparece como "prova da assessoria" quando o admin cria uma participacao oficial da equipe.
- Uma prova planejada pode ficar invisivel aos atletas ate o admin abrir participacao.
- O admin define a acao principal do atleta por prova.
- Quando a acao for link externo, o sistema ainda registra interesse/confirmacao para acompanhamento interno.
- Quando a acao for inscricao coletiva, o sistema deve listar atletas que entraram no grupo antes de qualquer envio externo.
- Quando houver pagamento interno, a participacao deve refletir o status financeiro.
- Fechar participacao impede novas entradas, mas nao remove historico.
- Concluir prova deve permitir registrar presenca, gerar pontos e disparar comunicados pos-prova quando configurado.

Criterios de aceite:

- Admin consegue transformar uma prova importada em prova oficial da assessoria em poucos passos.
- Atleta elegivel entende que aquela prova faz parte da agenda da equipe.
- Atleta consegue manifestar participacao sem precisar falar fora do sistema.
- Admin consegue ver rapidamente quem vai, quem esta pendente e quem ja se inscreveu fora.
- Alteracoes de status relevantes disparam notificacoes quando configurado.
- Historico da participacao da prova fica disponivel apos conclusao.

Estado atual do cockpit:

- Implementado como tela de leitura em `/admin/eventos/:id/cockpit`.
- Implementado como API agregadora em `GET /api/admin/cockpit/events/:id`.
- Usa dados existentes de `Event`, `Registration`, `Payment`, `OrganizationRacePlan`, `CollectiveSignup`, patrocinadores e fotos.
- Nao cria novas tabelas nesta primeira versao.
- Nao persiste checklist operacional ainda; a checklist atual e calculada a partir dos dados existentes.
- Proximos passos: persistir checklist, criar fase operacional da prova, permitir exportacao, comunicados por prova e acoes em lote.

### 6.4.4 Modelo de Provas

Para evitar confusao entre prova encontrada, prova cadastrada e prova assumida pela assessoria, o dominio separa estes conceitos:

`ExternalEvent`

- Representa uma prova encontrada em API externa.
- Guarda origem, ID externo, payload bruto, dados normalizados e status de sync/curadoria.
- Nao e exibida ao atleta por padrao.
- Estado atual: modelo de dados criado; fluxo completo de sync e curadoria ainda pendente.

`Event`

- Representa a prova/evento normalizado dentro do VentuSuli.
- Pode nascer de cadastro manual ou de uma prova externa aprovada.
- Guarda informacoes estruturadas: nome, data, local, distancias, status, imagem, preco e regras.

`OrganizationRacePlan`

- Representa a decisao da assessoria de participar de uma prova.
- Define se a prova entra na lista oficial da equipe.
- Controla status operacional, audiencia, orientacoes, logistica e acao principal do atleta.
- Pode apontar para um `Event` interno e preservar origem externa quando houver.
- Estado atual: modelo, APIs e primeira UI operacional implementados.

`AthleteRaceParticipation`

- Representa a relacao do atleta com uma prova da assessoria.
- Guarda status, distancia escolhida, pagamento, inscricao externa, presenca, observacoes e timestamps.
- Permite acompanhar interesse e confirmacao mesmo quando a inscricao final acontece fora da plataforma.
- Estado atual: modelo e acao simples "Quero participar" implementados.

Relacionamento esperado:

- Uma `ExternalEvent` pode gerar ou atualizar um `Event`.
- Um `Event` pode ter zero ou mais planos de participacao por organizacao.
- Um `OrganizationRacePlan` pertence a uma organizacao e define a agenda oficial daquela assessoria.
- Um `AthleteRaceParticipation` pertence a um atleta e a um `OrganizationRacePlan`.
- Notificacoes, pagamentos, pontos, fotos e comunicados devem se vincular ao plano da assessoria ou a participacao do atleta quando o contexto for a equipe.

Criterios de aceite:

- O sistema nao mistura prova descoberta com prova oficialmente escolhida pela assessoria.
- O mesmo evento pode ser reaproveitado por mais de uma organizacao sem misturar atletas.
- Cada assessoria controla sua propria agenda, audiencia e participacoes.
- Cada atleta tem um status individual por prova da assessoria.

### 6.5 Pagamentos e Financeiro

Responsabilidades:

- Gerar pagamentos de inscricoes, recompensas, fotos e cobrancas manuais.
- Acompanhar status: pendente, pago, expirado, reembolsado e cancelado.
- Registrar receitas, despesas, recorrencias, mensalidades, relatórios e conciliacao.
- Webhook de pagamento com autenticacao.
- Criar entradas financeiras a partir de eventos internos quando aplicavel.

Criterios de aceite:

- Webhook rejeita requisicoes sem assinatura/credencial valida.
- Pagamento pago e idempotente: repetir webhook nao duplica baixa nem pontos.
- Lancamento financeiro possui organizacao, categoria, valor, status, data e origem auditavel.
- Relatorios financeiros filtram por organizacao e periodo.

### 6.6 Pontos, Loyalty e Recompensas

Responsabilidades:

- Carteira de pontos por atleta.
- Lancamentos auditaveis: credito, debito, expiracao, ajuste e estorno.
- Fontes: participacao em evento, inscricao antecipada, pagamento antecipado, bonus, atividade aprovada, recorrencia, aniversario, resgate e ajuste manual.
- Regras de pontos por evento.
- Atividades com aprovacao.
- Missoes, niveis, badges e eventos de loyalty.
- Marketplace de recompensas, estoque e resgates.

Criterios de aceite:

- Atleta nao cria pontos diretamente.
- Toda mudanca de saldo gera ledger.
- Saldo nunca fica inconsistente com ledger.
- Resgate valida estoque, custo e saldo antes de confirmar.
- Expiracao e bonus recorrente sao idempotentes.
- Ajuste manual exige papel autorizado e motivo.

### 6.7 Treinos e Coach

Responsabilidades:

- Perfil de treinamento do atleta.
- Biblioteca de exercicios.
- Planos de treino, semanas, dias e itens.
- Sessoes de treino com status pendente, completado, parcial e perdido.
- Feedback do atleta.
- Recomendacoes de IA para treino e revisao/aplicacao por coach.
- Dashboard tecnico para coach e atleta.

Criterios de aceite:

- Coach acessa apenas atletas autorizados da organizacao.
- Plano ativo possui atleta, coach, periodo e estrutura valida.
- Feedback nao altera treino finalizado sem regra explicita.
- Recomendacao de IA fica pendente ate aplicacao ou descarte.

### 6.8 Comunidade

Responsabilidades:

- Feed de posts por organizacao.
- Comentarios e reacoes.
- Moderacao conforme papel.
- Integracao com desafios, rankings ou avisos quando habilitado.

Criterios de aceite:

- Posts, comentarios e reacoes ficam isolados por organizacao.
- Usuario autenticado pode interagir conforme policy.
- Conteudo removido/moderado preserva rastro quando necessario.

### 6.9 Avisos e Notificacoes

Responsabilidades:

- Avisos segmentados por audiencia: todos, atletas, coaches e admins.
- Status: rascunho, publicado e arquivado.
- Canais: in-app e Telegram; e-mail/WhatsApp/push como evolucao.
- Templates, preferencias, jobs, logs e deduplicacao.
- Reenvio e rastreio de entrega.

Criterios de aceite:

- Leitura de avisos segue `NOTICES_READ`.
- Criacao/publicacao segue `NOTICES_MANAGE`.
- Publicacao cria entregas para destinatarios corretos.
- Falhas de canal externo nao quebram a publicacao in-app.
- Preferencias do usuario sao respeitadas quando aplicavel.

### 6.10 Fotos e Photo Commerce

Responsabilidades:

- Galerias por evento ou avulsas.
- Upload de fotos, status de processamento, preview, thumbnail, watermark e original.
- Match manual, por numero de peito, reconhecimento facial futuro ou importacao.
- Compra de fotos, desbloqueio por pontos, pacote ou liberacao administrativa.
- Download seguro.

Criterios de aceite:

- Binarios ficam em storage; banco guarda keys, URLs, metadata, preco e status.
- Foto em processamento/oculta nao aparece para compra.
- Unlock valida pagamento, pontos ou concessao.
- Download exige unlock valido ou permissao administrativa.

### 6.11 Patrocinadores

Responsabilidades:

- Cadastro de patrocinadores, contatos, campanhas, placements e metricas.
- Vinculo de campanhas a eventos.
- Orçamento financeiro e orçamento em pontos.
- Areas de exibicao patrocinada.

Criterios de aceite:

- Parceiros e admins autorizados gerenciam patrocinadores conforme policy.
- Campanha ativa respeita periodo, status e prioridade de placement.
- Metricas registram periodo, area e patrocinador.

### 6.12 Integracoes Externas

Responsabilidades:

- Strava: OAuth, conexao, webhook, sync manual/agendado, logs e ranking.
- TicketSports: sincronizacao de eventos, inscricoes, pedidos e pagamentos.
- Agregador de provas: busca, normalizacao, deduplicacao e curadoria de provas vindas de multiplas APIs externas.
- Telegram: entrega de avisos.
- Plataforma externa generica: credenciais, tipos de auth, eventos, pedidos, inscricoes, pagamentos e logs de sync.

Criterios de aceite:

- Credenciais ficam segregadas por organizacao e plataforma.
- Sync possui status, erro, payload relevante e idempotencia.
- Falha externa nao corrompe estado transacional interno.
- Webhooks e callbacks validam autenticidade e organizacao.
- Payload externo bruto fica disponivel para auditoria/debug, mas a UI usa dados normalizados.
- Atualizacoes externas nao sobrescrevem campos editados manualmente sem regra clara de prioridade.

### 6.13 Auditoria e Eventos Internos

Responsabilidades:

- Registrar acoes sensiveis com ator, entidade, antes/depois, requestId, IP e user agent quando disponivel.
- Criar eventos internos idempotentes para automacoes.
- Processar eventos como: pagamento confirmado, participacao confirmada, treino completado, compra de foto, resgate e desafio concluido.

Criterios de aceite:

- Acoes administrativas criticas geram audit log.
- Evento interno possui chave idempotente unica por organizacao.
- Processamento com falha preserva erro, tentativas e status.

## 7. Experiencia por Trilha

### Plataforma

Entrada: `/super-admin`.

Fluxos principais:

- Ver organizacoes e status.
- Criar/reenviar convites de administradores.
- Acompanhar billing da plataforma.
- Auditar acoes.
- Prestar suporte sem acessar tenant diretamente.

### Admin da Assessoria

Entrada: `/admin`.

Fluxos principais:

- Gerenciar eventos.
- Gerenciar atletas.
- Controlar financeiro e pagamentos.
- Configurar pontos e recompensas.
- Administrar fotos, patrocinadores e avisos.
- Ajustar configuracoes da organizacao.

### Coach

Entrada: `/coach`.

Fluxos principais:

- Ver atletas acompanhados.
- Montar e acompanhar treinos.
- Revisar feedbacks.
- Usar recomendacoes de IA como apoio.
- Publicar/ler avisos conforme permissao.

### Atleta

Entrada: `/`.

Fluxos principais:

- Ver provas disponiveis.
- Ver a lista oficial de provas em que a assessoria vai participar.
- Inscrever-se e pagar.
- Acompanhar minhas inscricoes.
- Ver treinos, evolucao e calendario.
- Participar da comunidade.
- Ler avisos.
- Consultar pontos, recompensas, resgates e fotos.

## 8. Dados e Entidades Principais

Entidades de identidade e tenant:

- `Organization`, `User`, `UserAccessProfile`, `RefreshToken`, `PasswordResetToken`, `UserMfaSettings`, `AuthChallenge`.

Entidades operacionais:

- `AthleteProfile`, `Event`, `EventDistance`, `Registration`, `Payment`, `FinancialEntry`, `CollectiveSignup`, `CollectiveMember`.
- Para a central de provas: `ExternalPlatform`, `ExternalEvent`, `SyncLog` e vinculo entre prova externa e `Event` interno.
- Modelo conceitual recomendado para evolucao da agenda da assessoria: `OrganizationRacePlan` e `AthleteRaceParticipation`.

Entidades tecnicas/esportivas:

- `Exercise`, `TrainingPlan`, `TrainingWeek`, `TrainingDay`, `TrainingDayItem`, `WorkoutSession`, `AthleteFeedback`, `AIRecommendation`, `Activity`, `RankingSnapshot`.

Entidades de engajamento:

- `CommunityPost`, `CommunityComment`, `CommunityReaction`, `Notice`, `NoticeDelivery`, `NotificationTemplate`, `NotificationPreference`, `NotificationJob`, `NotificationLog`.

Entidades de pontos e comercio:

- `EventPointRule`, `AthletePointLedger`, `RewardItem`, `RewardRedemption`, `PointActivity`, `PointActivityEntry`, `UserLoyalty`, `LoyaltyMission`, `UserLoyaltyMission`, `LoyaltyBadge`, `UserLoyaltyBadge`, `LoyaltyProgramEvent`.

Entidades de fotos e patrocinadores:

- `PhotoGallery`, `Photo`, `PhotoAthleteMatch`, `PhotoPurchase`, `PhotoPurchaseItem`, `PhotoUnlock`, `Sponsor`, `SponsorContact`, `SponsorCampaign`, `SponsorPlacement`, `SponsorCampaignEvent`, `SponsorMetric`.

Entidades de integracao e operacao:

- `StravaConnection`, `StravaSyncLog`, `ExternalPlatform`, `PlatformCredential`, `ExternalEvent`, `ExternalRegistration`, `ExternalOrder`, `SyncLog`, `AuditLog`, `InternalEvent`, `PlatformBillingInvoice`.

## 9. Requisitos Nao Funcionais

### Seguranca

- Segredos obrigatorios em runtime: `JWT_SECRET`, `NEXTAUTH_SECRET` e demais envs validados.
- Senhas sempre hashadas.
- Tokens persistidos como hash quando usados para refresh/reset/convite.
- Rate limit configurado em producao.
- Upload autenticado e validado por MIME/tamanho.
- Webhooks autenticados.

### Observabilidade

- `/api/health` deve responder liveness sem depender do banco.
- `/api/health?scope=readiness` deve validar env, banco, rate limiter e dependencias criticas.
- Logs devem conter contexto de request quando aplicavel.
- Falhas de integracao devem ser rastreaveis em logs de sync/job.

### Performance

- Listagens administrativas devem paginar ou limitar resultados.
- Consultas de tenant devem usar indices por organizacao, status e datas relevantes.
- Operacoes pesadas de fotos, sync externo e notificacoes devem migrar para filas quando o volume justificar.

### Deploy

- Producao deve usar `next start`, nunca `next dev`.
- Startup de producao deve executar `prisma migrate deploy`.
- Healthcheck de readiness deve ser usado por load balancer/deploy.
- Rollback deve preservar compatibilidade com migracoes aplicadas.

## 10. Contratos de API por Dominio

APIs devem seguir estes principios:

- Retornar `401` para nao autenticado.
- Retornar `403` para autenticado sem policy.
- Retornar `404` quando recurso nao existe ou nao pertence a organizacao do usuario.
- Validar entrada com schemas ou validadores equivalentes.
- Nunca confiar em `organizationId` enviado pelo cliente quando ele puder ser resolvido da sessao.
- Manter operacoes mutaveis idempotentes quando chamadas por webhook, sync ou job.

Grupos principais:

- Auth: `/api/auth/*`
- Sessao/perfil: `/api/me/*`
- Plataforma: `/api/super-admin/*`
- Admin: `/api/admin/*`
- Eventos: `/api/events/*`
- Cockpit administrativo da prova:
  - Implementado: `GET /api/admin/cockpit/events/:id`
  - Planejado: acoes de checklist, fase operacional, exportacao e comunicados por prova
- Agenda oficial da assessoria:
  - Implementado: `GET /api/admin/race-plans`
  - Implementado: `POST /api/admin/race-plans`
  - Implementado: `GET /api/admin/race-plans/by-event/:eventId`
  - Implementado: `GET /api/race-plans`
- Participacao do atleta em provas da assessoria:
  - Implementado: `POST /api/race-plans/:id/participations`
  - Planejado: `/api/me/race-participations/*`
- Inscricoes: `/api/registrations/*`
- Pagamentos: `/api/payments/*`
- Financeiro: `/api/finance/*`, `/api/reports/*`
- Atletas: `/api/athletes/*`
- Coach/treinos: `/api/coach/*`, `/api/me/training/*`
- Comunidade: `/api/community/*`
- Avisos/notificacoes: `/api/notices/*`, `/api/notifications/*`
- Pontos/recompensas: `/api/points/*`, `/api/rewards/*`
- Fotos: `/api/photos/*`, `/api/admin/photos/*`
- Patrocinadores: `/api/sponsors/*`, `/api/admin/sponsors/*`
- Integracoes: `/api/integrations/*`
- Central de provas importadas:
  - Modelo de dados implementado no Prisma.
  - Planejado: `/api/integrations/platforms/*`, `/api/integrations/*/sync/events`, `/api/admin/eventos/importados/*`

## 11. Fluxos Criticos de Aceite

### Fluxo 1: Login e roteamento por papel

1. Usuario autentica com e-mail e senha.
2. Se MFA estiver habilitado, sistema exige desafio.
3. Sistema resolve perfis ativos.
4. `/dashboard` redireciona para home correta.
5. Tentativas de acessar areas fora da policy sao bloqueadas.

Aceite:

- `SUPER_ADMIN -> /super-admin`
- `ADMIN -> /admin`
- `COACH -> /coach`
- `ATHLETE -> /` ou `/onboarding/atleta` se onboarding pendente.

### Fluxo 2: Evento ate inscricao paga

1. Admin cria evento em rascunho.
2. Admin publica evento.
3. Atleta visualiza prova publicada.
4. Atleta faz inscricao.
5. Sistema gera pagamento.
6. Webhook confirma pagamento.
7. Inscricao passa a confirmada.
8. Evento interno gera financeiro, pontos/notificacao quando configurado.

Aceite:

- Rascunho invisivel para atleta.
- Confirmacao de pagamento idempotente.
- Dados sempre isolados por organizacao.

### Fluxo 2.1: API externa ate prova enviada ao atleta

1. Sistema executa sync de provas em plataformas externas configuradas.
2. Provas externas sao normalizadas e salvas como itens importados.
3. Sistema deduplica itens repetidos e marca diferencas relevantes para revisao.
4. Admin acessa a central de provas importadas.
5. Admin filtra por data, local, modalidade, plataforma ou status.
6. Admin seleciona uma prova e revisa dados normalizados.
7. Admin adiciona a prova a lista oficial de provas da assessoria.
8. Sistema cria ou atualiza um evento interno em rascunho, planejado ou aberto aos atletas conforme decisao do admin.
9. Admin escolhe audiencia e canal de divulgacao.
10. Sistema deixa a prova visivel na ferramenta dos atletas elegiveis.
11. Sistema envia a prova aos atletas elegiveis via catalogo, dashboard e notificacao/aviso.
12. Atleta abre a prova e escolhe participar, manifestar interesse, entrar em inscricao coletiva ou seguir para link externo, conforme configurado.

Aceite:

- Nenhuma prova externa chega ao atleta sem aprovacao/publicacao do admin.
- A mesma prova externa nao gera duplicidade apos sync repetido.
- Admin consegue editar dados antes de transformar a prova em evento interno.
- Admin consegue definir se a prova sera apenas planejada ou aberta para participacao dos atletas.
- Envio aos atletas registra audiencia, canais e timestamp.
- Atleta fora da audiencia nao visualiza destaque nem recebe notificacao.
- Atleta elegivel visualiza a prova na ferramenta e tem uma acao clara para participar.
- A acao de participacao gera registro interno, mesmo quando a inscricao final acontecer em plataforma externa.

### Fluxo 2.2: Gestao da equipe em uma prova da assessoria

1. Admin abre uma prova da lista oficial para participacao dos atletas.
2. Atletas elegiveis entram como interessados, confirmados ou participantes de inscricao coletiva.
3. Admin acompanha lista por status, distancia, pagamento e inscricao externa.
4. Admin envia comunicados logisticos para interessados/confirmados.
5. Admin fecha novas participacoes quando prazo encerrar.
6. No dia da prova, admin/coach marca presenca ou ausencia.
7. Apos a prova, sistema conclui a participacao, gera pontos e libera fluxos pos-prova quando configurado.

Aceite:

- Admin tem uma visao unica de quem vai participar da prova.
- Atleta consegue acompanhar o proprio status sem depender de conversa externa.
- Fechamento de participacao nao remove atletas ja registrados.
- Comunicados podem ser enviados apenas para participantes daquela prova.
- Conclusao da prova preserva historico e alimenta pontos, fotos e relatorios quando aplicavel.

### Fluxo 3: Pontos e resgate

1. Evento interno elegivel gera credito no ledger.
2. Atleta consulta saldo.
3. Atleta escolhe recompensa.
4. Sistema valida saldo e estoque.
5. Resgate debita pontos e cria status operacional.
6. Admin acompanha separacao, entrega ou cancelamento.

Aceite:

- Ledger e saldo permanecem consistentes.
- Cancelamento aplicavel estorna pontos.
- Estoque nao fica negativo.

### Fluxo 4: Treino com feedback

1. Coach cria plano para atleta.
2. Sistema gera sessoes.
3. Atleta conclui/parcializa/perde sessao.
4. Atleta envia feedback.
5. Coach revisa dashboard e recomendacoes.

Aceite:

- Coach sem acesso ao atleta nao ve plano.
- Feedback preserva historico.
- IA nunca aplica alteracao sem decisao registrada.

### Fluxo 5: Aviso publicado

1. Usuario autorizado cria aviso.
2. Define audiencia e canais.
3. Publica.
4. Sistema cria entregas in-app e envia canais externos habilitados.
5. Usuarios elegiveis visualizam aviso.

Aceite:

- Audiencia correta.
- Falhas de Telegram ficam registradas.
- Usuario fora da audiencia nao recebe aviso.

### Fluxo 6: Foto desbloqueada

1. Admin/moderador cria galeria.
2. Fotos sao publicadas apos processamento.
3. Atleta encontra fotos vinculadas.
4. Atleta paga ou usa pontos.
5. Sistema cria unlock.
6. Atleta baixa arquivo permitido.

Aceite:

- Download bloqueado sem unlock.
- Pontos/pagamento sao idempotentes.
- Foto oculta/processando nao aparece no fluxo comercial.

## 12. Matriz Minima de Testes

Testes automatizados devem cobrir:

- Auth, MFA, refresh, logout e reset de senha.
- Roteamento e bloqueio por papel.
- Tenant isolation em APIs criticas.
- Eventos, inscricoes e pagamentos.
- Central de provas importadas: sync externo, normalizacao, deduplicacao, curadoria e envio para atletas.
- Lista oficial da assessoria: abrir prova para atletas, registrar participacao, fechar participacao e concluir prova.
- Status de participacao do atleta: interesse, confirmacao, pagamento pendente, inscricao externa, inscricao coletiva, cancelamento e presenca.
- Webhook autenticado e idempotente.
- Pontos, ledger, expiracao, recorrencia e resgate.
- Financeiro e relatorios.
- Avisos e notificacoes.
- Uploads e validacao de imagens.
- Integracoes Strava/TicketSports com logs e falhas controladas.
- Health liveness/readiness.

Smoke pos-deploy:

- `/api/health`
- `/api/health?scope=readiness`
- Login admin.
- Listagem de eventos.
- Listagem de provas da assessoria para admin e atleta.
- Listagem de atletas.
- Fluxo basico de inscricao do atleta em ambiente controlado.

## 13. Roadmap Recomendado

### MVP Recomendado da Agenda de Provas

O primeiro corte de produto deve provar o fluxo principal sem depender de todos os modulos comerciais:

1. Criar base de dados para integracoes externas. Status: implementado.
2. Criar base de dados para lista oficial de provas da assessoria. Status: implementado.
3. Permitir que o admin abra uma prova existente para os atletas. Status: implementado.
4. Mostrar para o atleta provas abertas na agenda oficial da assessoria. Status: implementado.
5. Permitir ao atleta clicar em "Quero participar". Status: implementado.
6. Permitir ao admin acompanhar participantes por prova. Status: implementado em primeira versao.
7. Importar/listar provas externas em uma central administrativa. Status: pendente.
8. Permitir curadoria: revisar, ignorar ou adicionar prova importada a lista oficial. Status: pendente.
9. Mostrar para o atleta apenas provas abertas para sua audiencia segmentada. Status: pendente.
10. Permitir comunicados simples para participantes da prova. Status: pendente.
11. Registrar historico basico de conclusao da prova. Status: pendente.

Fora do MVP inicial:

- Pagamento interno completo.
- Inscricao coletiva automatizada em plataforma externa.
- Fotos comerciais.
- Pontos automaticos pos-prova.
- Reconhecimento facial.
- IA de recomendacao.

### Fase 1: Fundacao operacional

- Fechar RBAC por policies em todas as rotas.
- Garantir tenant isolation em queries criticas.
- Consolidar audit logs para acoes sensiveis.
- Fortalecer readiness e scripts de deploy.
- Definir modelo de agenda oficial da assessoria e status de participacao do atleta.

### Fase 2: Receita e recorrencia

- Consolidar pagamentos, financeiro, mensalidades e conciliacao.
- Melhorar relatorios por periodo, origem e categoria.
- Completar idempotencia de webhooks e jobs.
- Consolidar central de provas importadas com curadoria administrativa e envio segmentado aos atletas.
- Implementar MVP da lista oficial: admin adiciona prova, abre para atletas, atleta participa e admin acompanha lista.

### Fase 3: Engajamento

- Pontos automaticos por eventos internos.
- Recompensas, missoes, niveis, badges e expiracao.
- Notificacoes templateadas por evento de dominio.
- Comunicados por prova e automacoes pos-prova.

### Fase 4: Conteudo comercial

- Fotos com storage externo, watermark, unlock e download seguro.
- Patrocinadores com campanhas, placements e metricas.

### Fase 5: Escala

- Filas para notificacoes, fotos, syncs e jobs de pontos.
- CDN para assets.
- Observabilidade ampliada.
- Analytics separado.
- Impersonation de suporte com auditoria forte.

## 14. Ideias Adicionais Recomendadas

Esta secao registra melhorias que fazem sentido considerando o estado atual do VentuSuli, o foco em assessorias esportivas e a nova agenda oficial de provas.

### 14.1 Painel de Decisao da Assessoria

Objetivo:

- Dar ao admin uma visao executiva da operacao: proximas provas, atletas interessados, pendencias de pagamento, provas sem comunicados, eventos com baixa adesao e acoes urgentes.

Funcionalidades:

- Cards de "Precisa de acao": provas abertas sem participantes, provas proximas sem orientacoes, pagamentos pendentes, atletas sem resposta e check-in pendente.
- Ranking de provas por interesse dos atletas.
- Linha do tempo das proximas provas da assessoria.
- Alertas operacionais por prazo: fechamento de inscricao, retirada de kit, comunicados e dia da prova.

Prioridade:

- Alta. Ajuda o admin a operar melhor sem depender de planilha ou conversa fora do sistema.

### 14.2 Jornada Completa da Prova

Objetivo:

- Transformar cada prova em um cockpit operacional unico, desde a decisao de participar ate o pos-prova.

Funcionalidades:

- Checklist por prova: abrir para atletas, confirmar tenda/logistica, enviar comunicado, fechar lista, marcar presenca, concluir prova.
- Bloco de orientacoes visivel ao atleta: local de encontro, horario, retirada de kit, transporte, coach responsavel e link externo.
- Historico de alteracoes da prova da assessoria.
- Exportacao de participantes em CSV.
- Acoes em lote para mudar status de atletas.

Prioridade:

- Alta. E o passo natural apos a primeira versao da lista oficial.

### 14.3 Segmentacao Inteligente de Atletas

Objetivo:

- Enviar cada prova para os atletas certos, reduzindo ruido e aumentando adesao.

Funcionalidades:

- Audiencias salvas: todos, iniciantes, intermediarios, avancados, corrida de rua, trail, cidade/estado, premium e grupos manuais.
- Sugestao automatica de audiencia com base em distancia, cidade, historico e nivel do atleta.
- Indicador de alcance antes de publicar: quantos atletas receberao a prova.
- Simulacao de audiencia antes do envio.

Prioridade:

- Alta para notificacoes e curadoria; media para sugestao automatica.

### 14.4 Notificacoes por Momento da Prova

Objetivo:

- Automatizar a comunicacao sem o admin precisar lembrar de cada etapa.

Funcionalidades:

- Ao abrir prova: notificar atletas elegiveis.
- Antes do prazo: lembrar interessados que ainda nao confirmaram.
- Apos fechamento: avisar confirmados com orientacoes finais.
- No dia anterior: enviar checklist de prova.
- Apos a prova: agradecer, pedir feedback, liberar fotos/pontos quando configurado.

Prioridade:

- Alta. A comunicacao e uma das maiores dores operacionais de assessoria.

### 14.5 CRM Esportivo do Atleta

Objetivo:

- Fazer o sistema entender melhor cada atleta para recomendações, comunicacao e retencao.

Funcionalidades:

- Preferencias de prova: distancia favorita, cidade, tipo de terreno, faixa de preco e disponibilidade.
- Historico de participacoes na assessoria.
- Indicador de engajamento: treinos, provas, pontos, comunidade, pagamentos e avisos lidos.
- Tags internas: competitivo, iniciante, retorno de lesao, mensalidade critica, potencial premium.

Prioridade:

- Media. Gera valor forte, mas depende de dados organizados.

### 14.6 Inscricao Coletiva Gerenciada

Objetivo:

- Ajudar a assessoria quando ela concentra inscricoes de um grupo em uma plataforma externa.

Funcionalidades:

- Lista de atletas para inscricao coletiva.
- Status: entrou na lista, aguardando pagamento, pago, enviado para organizador, inscrito externamente.
- Campo para codigo/comprovante externo.
- Exportacao no formato necessario para a plataforma externa.
- Auditoria de quem colocou ou removeu atleta da lista.

Prioridade:

- Alta quando a assessoria costuma operar grupos em provas externas.

### 14.7 Financeiro Ligado a Provas da Assessoria

Objetivo:

- Amarrar participacao, pagamento, receita e custos da prova em um so lugar.

Funcionalidades:

- Cobrança interna por prova ou por servico adicional: tenda, transporte, kit, inscricao, foto, pacote.
- Despesas por prova: tenda, staff, transporte, brindes, taxas e patrocinio.
- Resultado financeiro por prova.
- Relatorio de inadimplencia por prova.

Prioridade:

- Media-alta. Importante para gestao, mas pode vir depois da agenda operacional.

### 14.8 Patrocinador por Prova

Objetivo:

- Transformar provas com alta adesao em oportunidade comercial.

Funcionalidades:

- Vincular patrocinadores a provas especificas.
- Registrar entregas: banner, tenda, cupom, post, camiseta, brinde.
- Relatorio para patrocinador: alcance, participantes, fotos, cliques e resgates.
- Cupom ou beneficio por prova para atletas.

Prioridade:

- Media. Boa para receita e profissionalizacao da assessoria.

### 14.9 Fotos e Memoria da Prova

Objetivo:

- Usar a prova como ponto de engajamento depois do evento.

Funcionalidades:

- Galeria vinculada ao `OrganizationRacePlan`.
- Marcar atletas participantes nas fotos.
- Liberar pacote de fotos para confirmados/premium.
- Criar mural historico da assessoria por prova.

Prioridade:

- Media. Forte para retencao, mas depende do modulo de fotos estar maduro.

### 14.10 Indicadores e BI

Objetivo:

- Ajudar dono/admin a tomar decisao sobre calendario, receita e engajamento.

Funcionalidades:

- Taxa de adesao por prova: atletas impactados, interessados, confirmados e presentes.
- Conversao por canal de notificacao.
- Provas com melhor retorno financeiro.
- Provas com maior engajamento por distancia/cidade.
- Atletas mais ativos e atletas em risco de churn.

Prioridade:

- Media. Deve crescer depois que eventos e participacoes tiverem volume.

### 14.11 IA Assistiva para Operacao

Objetivo:

- Reduzir trabalho repetitivo do admin e do coach.

Funcionalidades:

- Sugestao de provas relevantes para a assessoria a partir de historico, cidade, modalidade e perfil dos atletas.
- Geracao de comunicado de prova com tom da assessoria.
- Sugestao de audiencia para prova importada.
- Resumo operacional: "o que falta resolver nesta prova".
- Analise pos-prova: adesao, ausencias, pagamentos, fotos, pontos e proximas acoes.

Prioridade:

- Media. Deve entrar como assistente, nunca como decisor automatico.

### 14.12 Portal Publico da Assessoria

Objetivo:

- Permitir que a assessoria divulgue sua agenda oficial para captacao, mantendo acoes sensiveis autenticadas.

Funcionalidades:

- Pagina publica com proximas provas da assessoria.
- Destaque para provas abertas para novos atletas.
- Formulario de interesse para lead.
- Conversao de lead para atleta com aprovacao admin.

Prioridade:

- Baixa-media. Bom para crescimento, mas nao deve atrasar a operacao interna.

### 14.13 Ordem Recomendada de Execucao

1. Evoluir o cockpit da prova da assessoria de leitura/agregacao para operacao completa.
2. Segmentacao basica de audiencia.
3. Notificacao ao abrir prova e lembretes por prazo.
4. Formulario avancado do atleta para participacao.
5. Inscricao coletiva gerenciada.
6. Central de provas importadas com curadoria.
7. Sync real com TicketSports.
8. Financeiro por prova.
9. Fotos e pontos pos-prova.
10. BI e IA assistiva.

## 15. Revisao Tecnica da Spec de Expansao

Esta revisao consolida a spec de expansao enviada para evitar retrabalho, duplicacao de modelos e mudancas estruturais desnecessarias em um sistema que ja esta em producao.

### 15.1 Decisao Arquitetural

Decisao:

- Nao criar um novo sistema nem mover a aplicacao para uma arvore paralela `app/admin`, `app/coach` e `app/atleta`.
- Manter o padrao atual do projeto: `src/app/(dashboard)/admin`, `src/app/(dashboard)/coach`, rotas de atleta dentro do dashboard e APIs em `src/app/api`.
- Evoluir os modulos existentes por dentro dos dominios atuais.
- Usar `prisma/schema.prisma` existente como fonte da verdade, adicionando somente modelos que ainda nao existam.
- Evitar recriar modelos ja existentes com nomes diferentes.

Motivo:

- O projeto ja possui rotas, layouts, policies, servicos e modelos maduros.
- Criar modelos paralelos como `TrainingCycle` quando ja existem `TrainingPlan`, `TrainingWeek`, `TrainingDay`, `TrainingDayItem`, `WorkoutSession` e `AthleteFeedback` aumenta risco de inconsistencia.
- Criar novos `Sponsor`, `Photo`, `NotificationTemplate` ou `ExternalPlatform` duplicados quebraria relacoes ja usadas.
- Em producao, a melhor evolucao e incremental, com migracoes pequenas e compatibilidade reversivel.

### 15.2 Mapa da Spec Enviada para o Sistema Atual

| Modulo proposto | Estado no VentuSuli | Decisao senior |
| --- | --- | --- |
| Treinos | Ja existe com `TrainingPlan`, semanas, dias, sessoes, feedback, dashboard coach/atleta e IA de treino | Nao criar `TrainingCycle`/`TrainingSession`; evoluir o modulo atual |
| CRM esportivo do atleta | Parcial via atleta, treino, pagamentos, inscricoes, pontos e perfil | Criar camada agregadora e adicionar notas/alertas/timeline se ainda nao existirem |
| Cockpit da prova | Primeiro corte implementado com API agregadora e tela admin | Evoluir para checklist persistente, fase operacional, exportacao, comunicados e acoes em lote |
| Inscricao coletiva | Ja existe base com `CollectiveSignup` e `CollectiveMember` | Evoluir estes modelos em vez de criar `GroupRegistrationCampaign` duplicado |
| TicketSports | Modelo de integracao esta na spec e ha arquivos locais nao versionados | Fechar implementacao, versionar e validar antes de marcar como pronto |
| Financeiro por prova | Financeiro geral existe; por prova ainda precisa agregacao dedicada | Adicionar itens financeiros por evento ou vinculo claro com `FinancialEntry` |
| Segmentacao inteligente | Ainda nao ha dominio consolidado | Criar `AthleteSegment` e membros, ligado a notificacoes e provas |
| Notificacoes por momento | Templates/preferencias/logs ja existem | Adicionar regras por evento, nao recriar `NotificationTemplate` |
| Patrocinadores por prova | Ja existem `Sponsor`, campanhas, placements e vinculo campanha-evento | Evoluir relatorios/entregas por prova, nao recriar patrocinador |
| Fotos e memoria | Ja existem galerias, fotos, matches, compras e unlocks | Usar galerias por evento e criar memoria como experiencia agregada |
| BI | Ainda e camada de leitura/analytics | Criar APIs agregadoras sem duplicar dados transacionais |
| IA assistiva | Ja existe IA em treino; falta governanca e novos casos | Criar logs/limites e expandir para evento, CRM e financeiro |
| Portal publico | Ainda nao consolidado | Criar `PublicProfile` e leads como modulo novo, mantendo dados sensiveis autenticados |

### 15.3 Ajustes Necessarios na Spec Enviada

Treinos:

- Nao adotar os modelos `TrainingCycle`, `TrainingSession` e `TrainingFeedback` como novos modelos.
- Mapear `TrainingCycle` para `TrainingPlan`.
- Mapear `TrainingSession` para `WorkoutSession`.
- Mapear `TrainingFeedback` para `AthleteFeedback`.
- Se faltar algum campo, adicionar no modelo atual em migracao pequena.

Inscricao coletiva:

- Nao criar `GroupRegistrationCampaign` sem avaliar `CollectiveSignup`.
- Usar `CollectiveSignup` como campanha/lote.
- Usar `CollectiveMember` como atleta participante.
- Adicionar campos faltantes somente se necessarios: `price_rules`, `required_fields`, `external_platform`, `external_event_id`, `status` por membro e dados de formulario.

TicketSports:

- Nao criar `ExternalCredential` e `ExternalSyncLog` se o schema atual ja usa `PlatformCredential` e `SyncLog`.
- Manter `ExternalPlatform`, `PlatformCredential`, `ExternalEvent`, `ExternalRegistration`, `ExternalOrder` e `SyncLog`.
- Variaveis globais como `TICKETSPORTS_API_TOKEN` so devem ser fallback operacional; a regra principal deve ser credencial por organizacao.

Patrocinadores:

- Nao recriar `Sponsor`.
- Usar `SponsorCampaignEvent` para vinculo com prova.
- Se precisar de cotas e entregas por prova, adicionar modelo complementar como `EventSponsorDeliverable` ou evoluir `SponsorCampaignEvent` com campos de entrega, status e valor.

Fotos:

- Nao criar `EventMedia` se `PhotoGallery`, `Photo`, `PhotoAthleteMatch`, `PhotoPurchase` e `PhotoUnlock` ja resolvem o dominio.
- Criar "memoria" como tela/servico agregador por atleta, usando fotos, provas e participacoes.

Notificacoes:

- Nao recriar `NotificationTemplate`.
- Criar `EventNotificationRule` como novo modelo de orquestracao por momento da prova.
- Integrar regras com preferencias do usuario e logs existentes.

Financeiro por prova:

- Antes de criar `EventFinancialItem`, avaliar se `FinancialEntry` ja cobre categoria, valor, status, organizacao e origem.
- Se `FinancialEntry` cobrir o necessario, adicionar apenas vinculo forte com `eventId` e relatorios por prova.
- Se nao cobrir, criar `EventFinancialItem` como complemento com relacao clara para `Event`.

### 15.4 Ordem de Implementacao Revisada

Fase 1 tecnica:

1. Evoluir cockpit da prova usando dados existentes.
2. Evolucao da inscricao coletiva em cima de `CollectiveSignup`.
3. Financeiro por prova com menor mudanca possivel no modelo financeiro atual.
4. CRM esportivo como agregador de dados ja existentes.
5. Segmentacao basica para alimentar agenda oficial e notificacoes.

Fase 2 tecnica:

1. Notificacoes por momento da prova usando templates existentes.
2. TicketSports com credenciais por organizacao, sync idempotente e logs.
3. Patrocinadores por prova usando campanhas existentes.
4. Fotos e memoria usando galerias/eventos/participacoes existentes.

Fase 3 tecnica:

1. BI com consultas agregadas e endpoints somente leitura.
2. IA assistiva com logs, revisao humana e limites por permissao.
3. Portal publico com perfil publicado, leads e interesse em provas.
4. Automacoes avancadas com filas/jobs quando houver volume.

### 15.5 O Que Vale a Pena Mudar Agora

Vale mudar agora:

- Evoluir cockpit da prova como centro operacional completo.
- Melhorar a lista oficial da assessoria para virar centro operacional.
- Adicionar status e dados faltantes na inscricao coletiva existente.
- Criar segmentacao basica e conectar com abertura de provas.
- Criar notificacao automatica ao abrir prova.

Nao vale mudar agora:

- Reescrever modulo de treinos.
- Renomear estrutura de rotas para `app/admin`, `app/coach` e `app/atleta`.
- Duplicar modelos de fotos, patrocinadores, notificacoes e integracoes.
- Criar BI complexo antes de ter eventos de dominio e metricas estaveis.
- Colocar IA tomando decisoes automaticas.

### 15.6 Critério de Aceite para Novos Modulos

Todo novo modulo desta expansao deve cumprir:

- Reaproveitar modelo existente quando houver equivalencia.
- Ter `organizationId` ou relacao equivalente em dados de tenant.
- Ter policy explicita em API e tela.
- Ter isolamento por organizacao em todas as queries.
- Ter migracao pequena, reversivel em rollout e compativel com producao.
- Ter UI com estados de carregando, vazio, erro e sucesso.
- Ter contrato de API documentado na spec.
- Ter teste ou checklist manual de regressao para fluxo principal.

## 16. Definition of Done Global

Uma entrega do sistema so deve ser considerada pronta quando:

- UI cobre estados carregando, vazio, erro e sucesso.
- API valida entrada e autorizacao.
- Query filtra organizacao quando aplicavel.
- Mutacao critica gera auditoria ou evento interno.
- Fluxo principal tem teste automatizado ou regressao manual documentada.
- Erros sao compreensiveis para usuario e rastreaveis em log.
- Build, type-check e testes relevantes passam.
- Nao ha vazamento de papel, tenant ou dados sensiveis.
