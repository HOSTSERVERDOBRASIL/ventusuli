import type { LucideIcon } from "lucide-react";
import { ProfileCockpit } from "@/components/profile/profile-cockpit";
import { PROFILE_CONFIG } from "@/lib/profile-config";
import { UserRole } from "@/types";

interface RoleMetric {
  label: string;
  value: string | number;
  description?: string;
}

interface RoleAction {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

interface RoleFocusItem {
  title: string;
  description: string;
  status?: string;
}

interface RoleHomeProps {
  role: UserRole;
  title: string;
  subtitle: string;
  metrics: RoleMetric[];
  actions?: RoleAction[];
  focusItems: RoleFocusItem[];
}

export function RoleHome({
  role,
  title,
  subtitle,
  metrics,
  actions = [],
  focusItems,
}: RoleHomeProps) {
  const config = PROFILE_CONFIG[role];
  const Icon = config.icon;

  return (
    <ProfileCockpit
      role={role}
      title={title}
      subtitle={subtitle}
      eyebrow="Perfil operacional"
      metrics={metrics.map((metric, index) => ({
        ...metric,
        icon: index === 0 ? Icon : undefined,
      }))}
      actions={actions}
      focusItems={focusItems}
      insightItems={[
        {
          title: config.label,
          description: config.description,
          status: "Perfil",
        },
        {
          title: "Acesso contextual",
          description:
            "O menu, as permissoes e os atalhos mudam conforme o perfil ativo escolhido.",
          status: "RBAC",
        },
        {
          title: "Mesma experiencia",
          description:
            "Todos os perfis seguem a mesma estrutura visual, mas com informacoes proprias.",
          status: "UX",
        },
      ]}
    />
  );
}
