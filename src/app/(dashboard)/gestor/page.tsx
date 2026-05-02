import { BarChart3, Coins, ShieldCheck } from "lucide-react";
import { RoleHome } from "@/components/profile/role-home";
import { UserRole } from "@/types";

export default function ManagerHomePage() {
  return (
    <RoleHome
      role={UserRole.MANAGER}
      title="Gestao geral"
      subtitle="Visao executiva da assessoria, conectando operacao, financeiro e pontuacao."
      metrics={[
        {
          label: "Escopo",
          value: "360",
          description: "Acesso amplo para coordenar a operacao sem sair do mesmo login.",
        },
        {
          label: "RBAC",
          value: "Ativo",
          description: "Perfil separado de admin, coach, financeiro e atleta.",
        },
        {
          label: "Auditoria",
          value: "Pronta",
          description: "Base preparada para rastrear acoes por contexto de perfil.",
        },
      ]}
      actions={[
        {
          href: "/admin",
          label: "Painel administrativo",
          description: "Indicadores, alertas e atalhos da operacao.",
          icon: ShieldCheck,
        },
        {
          href: "/admin/financeiro",
          label: "Financeiro",
          description: "Recebimentos, pendencias e conciliacao.",
          icon: BarChart3,
        },
        {
          href: "/admin/pontos",
          label: "Pontos e auditoria",
          description: "Conferencia de creditos, estornos e recompensas.",
          icon: Coins,
        },
      ]}
      focusItems={[
        {
          title: "Separar decisao de execucao",
          description: "O gestor acompanha tudo, mas o menu se adapta ao perfil ativo escolhido.",
          status: "RBAC",
        },
        {
          title: "Acompanhar presenca e pontos",
          description: "A participacao nas atividades agora conversa com a pontuacao e com estorno.",
          status: "Pontos",
        },
        {
          title: "Governanca por papel",
          description: "Novos perfis podem amadurecer sem virar permissoes soltas no frontend.",
          status: "Base",
        },
      ]}
    />
  );
}
