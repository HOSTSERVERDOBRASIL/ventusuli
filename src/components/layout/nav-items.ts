"use client";

import { canAccessPolicyAny } from "@/lib/authorization";
import { UserRole } from "@/types";
import { accountNavItems } from "@/components/layout/navigation/account";
import { adminNavItems } from "@/components/layout/navigation/admin";
import { athleteNavItems } from "@/components/layout/navigation/athlete";
import { coachNavItems } from "@/components/layout/navigation/coach";
import { platformNavItems } from "@/components/layout/navigation/platform";
import {
  NAV_SECTIONS,
  type NavItem,
  type NavSectionGroups,
} from "@/components/layout/navigation/types";

export type { NavItem, NavSection, NavSectionGroups } from "@/components/layout/navigation/types";

export const navItems: NavItem[] = [
  ...athleteNavItems,
  ...adminNavItems,
  ...coachNavItems,
  ...platformNavItems,
  ...accountNavItems,
];

export function getVisibleNavItems(roles: UserRole | UserRole[] | null): NavItem[] {
  const normalizedRoles = Array.isArray(roles) ? roles : roles ? [roles] : [];

  if (!normalizedRoles.length) {
    return navItems.filter((item) => item.roles.includes(UserRole.ATHLETE));
  }

  return navItems.filter(
    (item) =>
      item.roles.some((role) => normalizedRoles.includes(role)) &&
      canAccessPolicyAny(normalizedRoles, item.policy),
  );
}

export function getQuickSearchLinks(
  roles: UserRole | UserRole[] | null,
): Array<{ href: string; label: string }> {
  return getVisibleNavItems(roles)
    .filter((item) => item.quickSearch !== false)
    .map((item) => ({ href: item.href, label: item.label }));
}

export function splitNavBySection(roles: UserRole | UserRole[] | null): NavSectionGroups {
  const visible = getVisibleNavItems(roles);

  return NAV_SECTIONS.reduce<NavSectionGroups>(
    (groups, section) => ({
      ...groups,
      [section]: visible.filter((item) => item.section === section),
    }),
    {
      home: [],
      events: [],
      finance: [],
      points: [],
      communication: [],
      coaching: [],
      admin: [],
      platform: [],
      account: [],
    },
  );
}

export function isNavItemActive(pathname: string, href: string): boolean {
  const hrefPath = href.split("?")[0] ?? href;
  if (hrefPath === "/") return pathname === "/";
  if (hrefPath === "/admin") return pathname === "/admin";
  if (hrefPath === "/coach") return pathname === "/coach";
  if (hrefPath === "/super-admin") return pathname === "/super-admin";
  return pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
}
