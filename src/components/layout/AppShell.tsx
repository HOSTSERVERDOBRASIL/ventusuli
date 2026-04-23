"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Topbar } from "@/components/layout/Topbar";

interface AppShellProps {
  children: React.ReactNode;
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export function AppShell({ children, user }: AppShellProps) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-background">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Topbar user={user} onMobileMenuOpen={() => setIsMobileNavOpen(true)} />
        <MobileNav isOpen={isMobileNavOpen} onClose={() => setIsMobileNavOpen(false)} />
        <main className="min-w-0 flex-1 px-3 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6">{children}</main>
      </div>
    </div>
  );
}
