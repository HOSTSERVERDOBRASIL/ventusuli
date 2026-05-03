import { BellRing, Camera, MessageSquareText } from "lucide-react";
import { RoleHome } from "@/components/profile/role-home";
import { UserRole } from "@/types";

export default function ModeratorHomePage() {
  return (
    <RoleHome
      role={UserRole.MODERATOR}
      title="Coordenador"
      subtitle="Coordenacao de comunicacao, avisos e conteudos da comunidade."
      metrics={[
        {
          label: "Comunicacao",
          value: "Central",
          description: "Avisos podem ser moderados sem liberar toda a administracao.",
        },
        {
          label: "Conteudo",
          value: "Revisao",
          description: "Fotos e comunidade ganham um papel dedicado de curadoria.",
        },
        {
          label: "Permissao",
          value: "Escopada",
          description: "MODERATOR_AREA separa moderacao de financeiro e cadastro.",
        },
      ]}
      actions={[
        {
          href: "/admin/avisos",
          label: "Avisos",
          description: "Crie, publique e acompanhe comunicados.",
          icon: BellRing,
        },
        {
          href: "/admin/fotos",
          label: "Fotos",
          description: "Acompanhe conteudos visuais do evento e da comunidade.",
          icon: Camera,
        },
        {
          href: "/moderador",
          label: "Painel de moderacao",
          description: "Volte para este cockpit de conteudo.",
          icon: MessageSquareText,
        },
      ]}
      focusItems={[
        {
          title: "Avisos com governanca",
          description: "Usuarios antigos de moderacao aparecem como coordenadores no produto.",
          status: "Avisos",
        },
        {
          title: "Conteudo separado da gestao",
          description: "Comunidade e fotos nao precisam depender do perfil financeiro ou admin.",
          status: "Conteudo",
        },
        {
          title: "Base pronta para auditoria",
          description: "O perfil ativo ajuda a entender em qual contexto a acao foi feita.",
          status: "Auditoria",
        },
      ]}
    />
  );
}
