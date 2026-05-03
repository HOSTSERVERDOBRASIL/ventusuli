import { BellRing, Coins, Trophy, Users } from "lucide-react";
import { RoleHome } from "@/components/profile/role-home";
import { UserRole } from "@/types";

export default function ManagerHomePage() {
  return (
    <RoleHome
      role={UserRole.MANAGER}
      title="Coordenador"
      subtitle="Operacao da assessoria com foco em atletas, provas, comunicacao e pontuacao."
      metrics={[
        {
          label: "Escopo",
          value: "Operacao",
          description: "Acesso para coordenar rotinas sem liberar configuracoes sensiveis.",
        },
        {
          label: "RBAC",
          value: "Ativo",
          description: "Perfil separado de administrador, financeiro, treinador e atleta.",
        },
        {
          label: "Auditoria",
          value: "Pronta",
          description: "Base preparada para rastrear acoes por contexto de perfil.",
        },
      ]}
      actions={[
        {
          href: "/admin/atletas",
          label: "Atletas",
          description: "Acompanhe cadastro, status e necessidades operacionais.",
          icon: Users,
        },
        {
          href: "/admin/eventos",
          label: "Provas",
          description: "Coordene calendario, inscricoes e check-in.",
          icon: Trophy,
        },
        {
          href: "/admin/pontos",
          label: "Pontos e auditoria",
          description: "Conferencia de creditos, estornos e recompensas.",
          icon: Coins,
        },
        {
          href: "/admin/avisos",
          label: "Avisos",
          description: "Comunique atletas e equipe com governanca.",
          icon: BellRing,
        },
      ]}
      focusItems={[
        {
          title: "Operacao sem configuracao sensivel",
          description: "O coordenador acompanha a rotina sem alterar acesso, organizacao ou financeiro.",
          status: "RBAC",
        },
        {
          title: "Acompanhar presenca e pontos",
          description: "A participacao nas atividades agora conversa com a pontuacao e com estorno.",
          status: "Pontos",
        },
        {
          title: "Governanca por perfil",
          description: "Administrador, financeiro, coordenador, treinador e atleta ficam separados.",
          status: "Base",
        },
      ]}
    />
  );
}
