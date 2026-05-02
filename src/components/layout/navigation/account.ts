import { IdCard, Settings } from "lucide-react";
import { ROLE_GROUPS } from "@/lib/authorization";
import type { NavItem } from "@/components/layout/navigation/types";

export const accountNavItems: NavItem[] = [
  {
    href: "/perfil",
    label: "Perfil",
    icon: IdCard,
    roles: [...ROLE_GROUPS.tenant],
    policy: "TENANT_AUTHENTICATED",
    section: "account",
    quickSearch: true,
  },
  {
    href: "/configuracoes/conta",
    label: "Configurações",
    icon: Settings,
    roles: [...ROLE_GROUPS.tenant],
    policy: "TENANT_AUTHENTICATED",
    section: "account",
    quickSearch: true,
  },
];
