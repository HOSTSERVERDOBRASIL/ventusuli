import { BellRing, CalendarDays, Dumbbell, LayoutDashboard, Users } from "lucide-react";
import { ROLE_GROUPS } from "@/lib/authorization";
import type { NavItem } from "@/components/layout/navigation/types";

export const coachNavItems: NavItem[] = [
  {
    href: "/coach",
    label: "Painel Técnico",
    icon: LayoutDashboard,
    roles: [...ROLE_GROUPS.coach],
    policy: "COACH_AREA",
    section: "coaching",
    quickSearch: true,
  },
  {
    href: "/coach/treinos",
    label: "Treinos",
    icon: Dumbbell,
    roles: [...ROLE_GROUPS.coach],
    policy: "COACH_AREA",
    section: "coaching",
    quickSearch: true,
  },
  {
    href: "/coach/calendario",
    label: "Calendário Técnico",
    icon: CalendarDays,
    roles: [...ROLE_GROUPS.coach],
    policy: "COACH_AREA",
    section: "coaching",
    quickSearch: true,
  },
  {
    href: "/coach/atletas",
    label: "Atletas",
    icon: Users,
    roles: [...ROLE_GROUPS.coach],
    policy: "COACH_AREA",
    section: "coaching",
    quickSearch: true,
  },
  {
    href: "/coach/avisos",
    label: "Avisos",
    icon: BellRing,
    roles: [...ROLE_GROUPS.coach],
    policy: "COACH_AREA",
    section: "coaching",
    quickSearch: true,
  },
];
