import { Settings } from "lucide-react";
import { RoleHome } from "@/components/profile/role-home";
import { UserRole } from "@/types";

export default function SupportHomePage() {
  return (
    <RoleHome
      role={UserRole.SUPPORT}
      title="Coordenador"
      subtitle="Contexto legado de atendimento tratado como coordenacao operacional."
      metrics={[
        {
          label: "Atendimento",
          value: "Coordenado",
          description: "Atendimento e acompanhamento assistido ficam dentro da coordenacao.",
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
          description: "Usuarios antigos com suporte aparecem como coordenadores no produto.",
          status: "Perfil",
        },
        {
          title: "Evolucao segura",
          description: "A compatibilidade tecnica continua sem criar um sexto perfil visivel.",
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
