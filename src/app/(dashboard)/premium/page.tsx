import { Dumbbell, Gift, Trophy } from "lucide-react";
import { RoleHome } from "@/components/profile/role-home";
import { UserRole } from "@/types";

export default function PremiumAthleteHomePage() {
  return (
    <RoleHome
      role={UserRole.PREMIUM_ATHLETE}
      title="Atleta premium"
      subtitle="Experiencia de atleta com foco em treino, provas, evolucao e beneficios."
      metrics={[
        {
          label: "Perfil",
          value: "Premium",
          description: "Atalho para uma experiencia mais acompanhada e completa.",
        },
        {
          label: "Atividades",
          value: "Validaveis",
          description: "Check-in e participacao ajudam a qualificar seus pontos.",
        },
        {
          label: "Beneficios",
          value: "Ativos",
          description: "Recompensas e resgates seguem integrados ao saldo de pontos.",
        },
      ]}
      actions={[
        {
          href: "/treinos",
          label: "Treinos",
          description: "Acompanhe sessoes, feedbacks e evolucao.",
          icon: Dumbbell,
        },
        {
          href: "/provas",
          label: "Provas",
          description: "Veja atividades abertas e proximas participacoes.",
          icon: Trophy,
        },
        {
          href: "/recompensas",
          label: "Recompensas",
          description: "Use pontos em beneficios disponiveis.",
          icon: Gift,
        },
      ]}
      focusItems={[
        {
          title: "Participacao reconhecida",
          description: "Atividades confirmadas passam a compor a historia do atleta.",
          status: "Provas",
        },
        {
          title: "Pontos com mais confianca",
          description: "O saldo respeita creditos e estornos quando a participacao muda.",
          status: "Saldo",
        },
        {
          title: "Navegacao sem ruido",
          description: "O menu fica filtrado para a experiencia de atleta premium.",
          status: "UX",
        },
      ]}
    />
  );
}
