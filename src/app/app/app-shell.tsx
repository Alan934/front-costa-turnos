"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock, Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { SubscriptionBanner } from "@/components/subscription-banner";
import { VerifyEmailBanner } from "@/components/verify-email-banner";
import { SetupChecklist } from "@/components/setup-checklist";
import { useAuth } from "@/components/auth-provider";
import { Avatar } from "@/components/avatar";
import { useProfessional } from "@/lib/api/professional";
import { APP_NAV } from "./nav";
import { cn } from "@/lib/utils";
import type { PublicPageBranding } from "@/mocks/contract-extensions";

/** Layout del panel del profesional: sidebar en desktop, drawer en mobile. */
export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[256px_1fr]">
      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-card lg:flex">
        <Brand />
        <NavList onNavigate={() => {}} />
        <SidebarFooter />
      </aside>

      {/* Topbar mobile */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card/80 px-4 py-3 backdrop-blur lg:hidden">
        <Link href="/app" className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-accent text-accent-foreground">
            <CalendarClock className="size-4" />
          </span>
          <span className="font-display text-base font-semibold tracking-tight">
            Costa Turnos
          </span>
        </Link>
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <button
            type="button"
            aria-label="Abrir menú"
            onClick={() => setOpen(true)}
            className="grid size-9 place-items-center rounded-full border border-border text-muted-foreground hover:bg-muted"
          >
            <Menu className="size-4" />
          </button>
        </div>
      </header>

      {/* Drawer mobile */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Cerrar menú"
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-0 flex h-full w-72 flex-col bg-card shadow-lg">
            <div className="flex items-center justify-between">
              <Brand />
              <button
                type="button"
                aria-label="Cerrar menú"
                onClick={() => setOpen(false)}
                className="mr-3 grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted"
              >
                <X className="size-4" />
              </button>
            </div>
            <NavList onNavigate={() => setOpen(false)} />
            <SidebarFooter />
          </div>
        </div>
      )}

      <main className="min-w-0">
        <VerifyEmailBanner />
        <SubscriptionBanner />
        <SetupChecklist />
        {children}
      </main>
    </div>
  );
}

function Brand() {
  return (
    <Link href="/app" className="flex items-center gap-2.5 px-5 py-5">
      <span className="grid size-9 place-items-center rounded-xl bg-accent text-accent-foreground">
        <CalendarClock className="size-5" />
      </span>
      <span className="font-display text-lg font-semibold tracking-tight">
        Costa Turnos
      </span>
    </Link>
  );
}

function NavList({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 space-y-0.5 px-3 py-2">
      {APP_NAV.map((item) => {
        const active =
          item.href === "/app"
            ? pathname === "/app"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-accent/10 text-accent"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            aria-current={active ? "page" : undefined}
          >
            <item.icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarFooter() {
  const { user } = useAuth();
  const pro = useProfessional();
  const name = user?.fullName?.trim() || user?.email || "Mi cuenta";
  const business = pro.data?.businessName ?? "";
  const logoFileId = (pro.data?.publicPageSettings as PublicPageBranding | undefined)?.logoFileId;

  return (
    <div className="hidden items-center justify-between gap-2 border-t border-border px-5 py-4 lg:flex">
      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar name={business || name} fileId={logoFileId} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{name}</p>
          {business && <p className="truncate text-xs text-muted-foreground">{business}</p>}
        </div>
      </div>
      <ThemeToggle />
    </div>
  );
}
