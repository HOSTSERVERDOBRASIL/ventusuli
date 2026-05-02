import type { NotificationChannel } from "./types";

export interface NotificationTemplateSeed {
  code: string;
  name: string;
  channel: NotificationChannel;
  audience: string;
  subject?: string;
  body: string;
}

export const notificationTemplates: NotificationTemplateSeed[] = [
  {
    code: "NOTICE_PUBLISHED_IN_APP",
    name: "Aviso publicado",
    channel: "IN_APP",
    audience: "ALL",
    subject: "{{notice_title}}",
    body: "{{notice_body}}",
  },
  {
    code: "ATHLETE_REGISTERED_IN_APP",
    name: "Cadastro recebido no app",
    channel: "IN_APP",
    audience: "ATHLETE",
    subject: "Cadastro recebido",
    body: "Ola, {{nome}}. Recebemos seu cadastro no Ventu Suli e vamos avisar quando a assessoria concluir a analise.",
  },
  {
    code: "ATHLETE_REGISTERED_EMAIL",
    name: "Cadastro recebido por e-mail",
    channel: "EMAIL",
    audience: "ATHLETE",
    subject: "Cadastro recebido no Ventu Suli",
    body: `Ola, {{nome}},

Recebemos seu cadastro no Ventu Suli.

Nossa equipe vai analisar suas informacoes e avisaremos quando seu acesso for aprovado.

Vem correr com a gente!

Equipe Ventu Suli`,
  },
  {
    code: "ATHLETE_APPROVED_IN_APP",
    name: "Cadastro aprovado no app",
    channel: "IN_APP",
    audience: "ATHLETE",
    subject: "Acesso aprovado",
    body: "Ola, {{nome}}. Seu cadastro foi aprovado e seu acesso ao Ventu Suli esta liberado.",
  },
  {
    code: "ATHLETE_APPROVED_EMAIL",
    name: "Cadastro aprovado por e-mail",
    channel: "EMAIL",
    audience: "ATHLETE",
    subject: "Seu acesso ao Ventu Suli foi aprovado",
    body: `Ola, {{nome}},

Seu cadastro foi aprovado.

Acesse o sistema:
{{login_url}}

Vem correr com a gente!

Equipe Ventu Suli`,
  },
  {
    code: "ATHLETE_REJECTED_IN_APP",
    name: "Cadastro rejeitado no app",
    channel: "IN_APP",
    audience: "ATHLETE",
    subject: "Cadastro nao aprovado",
    body: "Ola, {{nome}}. Seu cadastro nao foi aprovado neste momento. Fale com a assessoria para revisar os dados.",
  },
  {
    code: "ATHLETE_REJECTED_EMAIL",
    name: "Cadastro rejeitado por e-mail",
    channel: "EMAIL",
    audience: "ATHLETE",
    subject: "Atualizacao sobre seu cadastro Ventu Suli",
    body: `Ola, {{nome}},

Seu cadastro nao foi aprovado neste momento.

Caso precise revisar alguma informacao, fale com a assessoria.

Equipe Ventu Suli`,
  },
  {
    code: "EVENT_PUBLISHED_IN_APP",
    name: "Nova prova no app",
    channel: "IN_APP",
    audience: "ATHLETE",
    subject: "Nova prova publicada",
    body: "{{event_name}} ja esta disponivel para inscricao. Data: {{event_date}} as {{event_time}}. Local: {{event_location}}.",
  },
  {
    code: "EVENT_PUBLISHED_EMAIL",
    name: "Nova prova por e-mail",
    channel: "EMAIL",
    audience: "ATHLETE",
    subject: "Nova prova publicada: {{event_name}}",
    body: `Ola, {{nome}},

Uma nova prova foi publicada no Ventu Suli.

Prova: {{event_name}}
Data: {{event_date}} as {{event_time}}
Local: {{event_location}}

Veja os detalhes: {{event_url}}

Equipe Ventu Suli`,
  },
  {
    code: "EVENT_PUBLISHED_WHATSAPP",
    name: "Nova prova por WhatsApp",
    channel: "WHATSAPP",
    audience: "ATHLETE",
    body: `Novo evento no Ventu Suli!

{{event_name}}
Data: {{event_date}} as {{event_time}}
Local: {{event_location}}

Detalhes: {{event_url}}`,
  },
  {
    code: "EVENT_UPDATED_IN_APP",
    name: "Prova atualizada no app",
    channel: "IN_APP",
    audience: "ATHLETE",
    subject: "Prova atualizada",
    body: "{{event_name}} teve informacoes atualizadas. Data: {{event_date}} as {{event_time}}. Local: {{event_location}}.",
  },
  {
    code: "EVENT_UPDATED_EMAIL",
    name: "Prova atualizada por e-mail",
    channel: "EMAIL",
    audience: "ATHLETE",
    subject: "Atualizacao da prova: {{event_name}}",
    body: `Ola, {{nome}},

A prova {{event_name}} teve informacoes atualizadas.

Data: {{event_date}} as {{event_time}}
Local: {{event_location}}

Veja os detalhes: {{event_url}}

Equipe Ventu Suli`,
  },
  {
    code: "EVENT_UPDATED_WHATSAPP",
    name: "Prova atualizada por WhatsApp",
    channel: "WHATSAPP",
    audience: "ATHLETE",
    body: `Atualizacao de prova

{{event_name}}
Data: {{event_date}} as {{event_time}}
Local: {{event_location}}

Detalhes: {{event_url}}`,
  },
  {
    code: "EVENT_REMINDER_1_DAY_IN_APP",
    name: "Lembrete de prova no app",
    channel: "IN_APP",
    audience: "ATHLETE",
    subject: "Prova amanha",
    body: "{{event_name}} acontece amanha as {{event_time}} em {{event_location}}.",
  },
  {
    code: "EVENT_REMINDER_SMS",
    name: "Lembrete de prova por SMS",
    channel: "SMS",
    audience: "ATHLETE",
    body: "Ventu Suli: {{event_name}} em {{event_date}} as {{event_time}}. {{event_location}}",
  },
  {
    code: "EVENT_CANCELLED_IN_APP",
    name: "Prova cancelada no app",
    channel: "IN_APP",
    audience: "ATHLETE",
    subject: "Prova cancelada",
    body: "{{event_name}} foi cancelada. Motivo: {{cancel_reason}}",
  },
  {
    code: "EVENT_CANCELLED_EMAIL",
    name: "Prova cancelada por e-mail",
    channel: "EMAIL",
    audience: "ATHLETE",
    subject: "Prova cancelada: {{event_name}}",
    body: `Ola, {{nome}},

A prova {{event_name}} foi cancelada.

Motivo: {{cancel_reason}}

Equipe Ventu Suli`,
  },
  {
    code: "EVENT_CANCELLED_WHATSAPP",
    name: "Prova cancelada por WhatsApp",
    channel: "WHATSAPP",
    audience: "ATHLETE",
    body: `Prova cancelada

{{event_name}} ({{event_date}} as {{event_time}})
Motivo: {{cancel_reason}}`,
  },
  {
    code: "TRAINING_REMINDER_2_HOURS_IN_APP",
    name: "Treino daqui a pouco no app",
    channel: "IN_APP",
    audience: "ATHLETE",
    subject: "Treino daqui a pouco",
    body: "{{training_name}} esta marcado para {{training_time}}. Local: {{training_location}}.",
  },
  {
    code: "TRAINING_REMINDER_2_HOURS_WHATSAPP",
    name: "Treino daqui a pouco por WhatsApp",
    channel: "WHATSAPP",
    audience: "ATHLETE",
    body: `Treino daqui a pouco!

{{training_name}} as {{training_time}}
Local: {{training_location}}`,
  },
  {
    code: "BIRTHDAY_INDIVIDUAL_IN_APP",
    name: "Aniversario no app",
    channel: "IN_APP",
    audience: "ATHLETE",
    subject: "Feliz aniversario",
    body: "Feliz aniversario, {{nome}}! O Ventu Suli deseja saude, alegria e muitos quilometros de boas historias.",
  },
  {
    code: "BIRTHDAY_INDIVIDUAL_EMAIL",
    name: "Aniversario por e-mail",
    channel: "EMAIL",
    audience: "ATHLETE",
    subject: "Feliz aniversario, {{nome}}",
    body: `Ola, {{nome}},

Feliz aniversario! O Ventu Suli deseja saude, alegria e muitos quilometros de boas historias.

Para celebrar, creditamos {{points}} ponto(s) na sua conta.

Equipe Ventu Suli`,
  },
  {
    code: "BIRTHDAY_INDIVIDUAL_WHATSAPP",
    name: "Aniversario por WhatsApp",
    channel: "WHATSAPP",
    audience: "ATHLETE",
    body: "Feliz aniversario, {{nome}}! O Ventu Suli deseja saude, alegria e muitos quilometros de boas historias.",
  },
  {
    code: "PAYMENT_PENDING_IN_APP",
    name: "Pagamento pendente no app",
    channel: "IN_APP",
    audience: "ATHLETE",
    subject: "Pagamento pendente",
    body: "O pagamento de {{amount}} para {{event_name}} esta pendente ate {{due_date}}.",
  },
  {
    code: "PAYMENT_PENDING_EMAIL",
    name: "Pagamento pendente por e-mail",
    channel: "EMAIL",
    audience: "ATHLETE",
    subject: "Pagamento pendente no Ventu Suli",
    body: `Ola, {{nome}},

Seu pagamento de {{amount}} para {{event_name}} esta pendente ate {{due_date}}.

Acesse para concluir: {{payment_url}}

Equipe Ventu Suli`,
  },
  {
    code: "PAYMENT_PENDING_SMS",
    name: "Pagamento pendente por SMS",
    channel: "SMS",
    audience: "ATHLETE",
    body: "Ventu Suli: pagamento pendente {{amount}} ate {{due_date}}. {{payment_url}}",
  },
  {
    code: "REGISTRATION_CONFIRMED_IN_APP",
    name: "Inscricao confirmada",
    channel: "IN_APP",
    audience: "ATHLETE",
    subject: "Inscricao confirmada",
    body: "Sua inscricao em {{event_name}} esta confirmada.",
  },
  {
    code: "REGISTRATION_CONFIRMED_EMAIL",
    name: "Inscricao confirmada por e-mail",
    channel: "EMAIL",
    audience: "ATHLETE",
    subject: "Inscricao confirmada: {{event_name}}",
    body: `Ola, {{nome}},

Sua inscricao em {{event_name}} esta confirmada.

Detalhes: {{registration_url}}

Equipe Ventu Suli`,
  },
  {
    code: "POINTS_CREDITED_IN_APP",
    name: "Pontos creditados",
    channel: "IN_APP",
    audience: "ATHLETE",
    subject: "Pontos creditados",
    body: "{{points}} ponto(s) foram creditados na sua conta. Motivo: {{reason}}.",
  },
  {
    code: "POINTS_CREDITED_EMAIL",
    name: "Pontos creditados por e-mail",
    channel: "EMAIL",
    audience: "ATHLETE",
    subject: "{{points}} ponto(s) creditados no Ventu Suli",
    body: `Ola, {{nome}},

Creditamos {{points}} ponto(s) na sua conta.

Motivo: {{reason}}
Saldo e historico: {{points_url}}

Equipe Ventu Suli`,
  },
  {
    code: "POINTS_EXPIRING_SOON_IN_APP",
    name: "Pontos expirando",
    channel: "IN_APP",
    audience: "ATHLETE",
    subject: "Pontos perto de expirar",
    body: "{{points}} ponto(s) expiram em {{expiration_date}}.",
  },
  {
    code: "POINTS_EXPIRING_SOON_EMAIL",
    name: "Pontos expirando por e-mail",
    channel: "EMAIL",
    audience: "ATHLETE",
    subject: "Seus pontos estao perto de expirar",
    body: `Ola, {{nome}},

Voce tem {{points}} ponto(s) que expiram em {{expiration_date}}.

Acesse suas recompensas: {{rewards_url}}

Equipe Ventu Suli`,
  },
  {
    code: "REWARD_REDEEMED_IN_APP",
    name: "Recompensa resgatada",
    channel: "IN_APP",
    audience: "ATHLETE",
    subject: "Resgate recebido",
    body: "Recebemos seu resgate de {{reward_name}}. Acompanhe o status em Meus resgates.",
  },
  {
    code: "REWARD_REDEEMED_EMAIL",
    name: "Recompensa resgatada por e-mail",
    channel: "EMAIL",
    audience: "ATHLETE",
    subject: "Resgate recebido: {{reward_name}}",
    body: `Ola, {{nome}},

Recebemos seu resgate de {{reward_name}}.

Pontos usados: {{points_used}}
Status: {{redemption_status}}

Acompanhe em: {{redemptions_url}}

Equipe Ventu Suli`,
  },
];
