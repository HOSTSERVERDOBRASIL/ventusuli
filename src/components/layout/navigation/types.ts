import type { ComponentType } from "react";
import type { AccessPolicy } from "@/lib/authorization";
import type { UserRole } from "@/types";

export type NavSection =
  | "home"
  | "events"
  | "finance"
  | "points"
  | "communication"
  | "coaching"
  | "admin"
  | "platform"
  | "account";

export interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  roles: UserRole[];
  policy: AccessPolicy;
  section: NavSection;
  quickSearch?: boolean;
}

export type NavSectionGroups = Record<NavSection, NavItem[]>;

export const NAV_SECTIONS: NavSection[] = [
  "home",
  "events",
  "finance",
  "points",
  "communication",
  "coaching",
  "admin",
  "platform",
  "account",
];
