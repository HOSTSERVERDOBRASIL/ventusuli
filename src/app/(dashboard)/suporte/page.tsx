import { Settings } from "lucide-react";
import { RoleHome } from "@/components/profile/role-home";
import { UserRole } from "@/types";

export default function SupportHomePage() {
  return (
    <RoleHome
      role={UserRole.SUPPORT}
      title="Suporte"
      subtitle="Contexto de atendimento para orientar usuarios sem misturar com perfis operacionais."
      metrics={[
        {
          label: "Atendimento",
          value: "Separado",
          description: "Perfil proprio para suporte e acompanhamento assistido.",
        },
        {
          label: "Acesso",
          value: "Limitado",
          description: "Permissoes podem evoluir sem liberar area administrativa inteira.",
        },
        {
          label: "Sessao",
          value: "Unica",
          description: "O usuario alterna perfil sem precisar sair e entrar novamente.",
        },
      ]}
      actions={[
        {
          href: "/configuracoes/conta",
          label: "Conta",
          description: "Ajustes basicos do usuario autenticado.",
          icon: Settings,
        },
      ]}
      focusItems={[
        {
          title: "Atendimento com contexto",
          description: "O suporte pode ser identificado como suporte no frontend e nas politicas.",
          status: "Perfil",
        },
        {
          title: "Evolucao segura",
          description: "Novos modulos de fila e tickets podem usar SUPPORT_AREA sem refazer o RBAC.",
          status: "Base",
        },
        {
          title: "Menos confusao no menu",
          description: "Ao escolher suporte, o usuario nao fica vendo atalhos de atleta ou coach.",
          status: "UX",
        },
      ]}
    />
  );
}
