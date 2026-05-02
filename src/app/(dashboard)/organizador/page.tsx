import { ClipboardCheck, Plus, Trophy } from "lucide-react";
import { RoleHome } from "@/components/profile/role-home";
import { UserRole } from "@/types";

export default function OrganizerHomePage() {
  return (
    <RoleHome
      role={UserRole.ORGANIZER}
      title="Operacao de eventos"
      subtitle="Controle de provas, inscritos, check-in, participacao e pontos por atividade."
      metrics={[
        {
          label: "Evento",
          value: "Check-in",
          description: "Presenca do atleta ligada ao evento proposto.",
        },
        {
          label: "Pontuacao",
          value: "Integrada",
          description: "Mudanca de status remove pontos quando a presenca e revertida.",
        },
        {
          label: "Operacao",
          value: "Pronta",
          description: "Tela de evento ja exibe participantes e resumo de presenca.",
        },
      ]}
      actions={[
        {
          href: "/admin/eventos",
          label: "Provas e check-in",
          description: "Gerencie calendario, inscricoes e status de participacao.",
          icon: Trophy,
        },
        {
          href: "/admin/eventos/novo",
          label: "Nova prova",
          description: "Crie uma atividade para inscricao e controle operacional.",
          icon: Plus,
        },
        {
          href: "/admin/eventos?window=next14d",
          label: "Proximas provas",
          description: "Priorize atividades com data mais proxima.",
          icon: ClipboardCheck,
        },
      ]}
      focusItems={[
        {
          title: "Saber quem participou",
          description: "Presente, ausente e pendente ficam visiveis por inscricao.",
          status: "Presenca",
        },
        {
          title: "Pontuar somente atividade validada",
          description: "O atleta ganha pontos quando a participacao e confirmada.",
          status: "Creditos",
        },
        {
          title: "Estornar ao mudar status",
          description: "Se o status sai de presente, o sistema tenta remover os pontos daquele evento.",
          status: "Estorno",
        },
      ]}
    />
  );
}
