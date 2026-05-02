import { Handshake, Megaphone, Settings } from "lucide-react";
import { RoleHome } from "@/components/profile/role-home";
import { UserRole } from "@/types";

export default function PartnerHomePage() {
  return (
    <RoleHome
      role={UserRole.PARTNER}
      title="Parceiro"
      subtitle="Area para patrocinadores, beneficios e relacionamento com a comunidade."
      metrics={[
        {
          label: "Patrocinio",
          value: "Ativo",
          description: "Perfil separado para parceiros acompanharem sua presenca.",
        },
        {
          label: "Beneficios",
          value: "Ligados",
          description: "Recompensas e vantagens podem se conectar ao saldo de pontos.",
        },
        {
          label: "Marca",
          value: "Visivel",
          description: "Caminho dedicado para organizar exposicao e campanhas.",
        },
      ]}
      actions={[
        {
          href: "/admin/patrocinadores",
          label: "Patrocinadores",
          description: "Gerencie marcas, links e visibilidade.",
          icon: Handshake,
        },
        {
          href: "/configuracoes/conta",
          label: "Conta",
          description: "Ajuste dados e preferencias de acesso.",
          icon: Settings,
        },
        {
          href: "/parceiro",
          label: "Painel do parceiro",
          description: "Volte para a area dedicada de relacionamento.",
          icon: Megaphone,
        },
      ]}
      focusItems={[
        {
          title: "Parceiro sem acesso indevido",
          description: "O perfil existe separado de admin, financeiro e atleta.",
          status: "RBAC",
        },
        {
          title: "Beneficios conectados a pontos",
          description: "A maturidade de recompensas depende de saldo confiavel e estornos corretos.",
          status: "Pontos",
        },
        {
          title: "Preparado para portal externo",
          description: "A base ja tem rota, policy e navegacao para evoluir o modulo de parceiros.",
          status: "Portal",
        },
      ]}
    />
  );
}
