"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock, Menu, X, LogOut, Building2, ChevronDown } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { SubscriptionBanner } from "@/components/subscription-banner";
import { VerifyEmailBanner } from "@/components/verify-email-banner";
import { SetupChecklist } from "@/components/setup-checklist";
import { useAuth } from "@/components/auth-provider";
import { useActiveComercio } from "@/components/comercio-context";
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
        <ComercioSwitcher />
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
            <ComercioSwitcher />
            <NavList onNavigate={() => setOpen(false)} />
            <SidebarFooter />
          </div>
        </div>
      )}

      <main className="min-w-0">
        <VerifyEmailBanner />
        <SetupChecklist />
        {children}
        {/* Va al final: rinde una tarjeta FIJA al pie + un espaciador para no tapar contenido. */}
        <SubscriptionBanner />
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

/**
 * Selector del comercio activo. Servicios y Horarios operan sobre el comercio elegido acá.
 * Se oculta si el profesional solo tiene un comercio (su comercio-de-uno).
 */
function ComercioSwitcher() {
  const { options, activeId, setActiveId } = useActiveComercio();
  if (options.length <= 1) return null;

  return (
    <div className="px-3 pb-1 pt-1">
      <label htmlFor="comercio-switch" className="sr-only">
        Comercio activo
      </label>
      <div className="relative">
        <Building2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <select
          id="comercio-switch"
          value={activeId ?? ""}
          onChange={(e) => setActiveId(e.target.value)}
          className="h-10 w-full appearance-none rounded-lg border border-border bg-background pl-9 pr-9 text-sm font-medium outline-none focus:ring-2 focus:ring-ring"
        >
          {options.map((o) => (
            <option key={o.comercioId} value={o.comercioId}>
              {o.isPersonal ? `${o.name} (tu negocio)` : o.name}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      </div>
    </div>
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
  const { user, logout } = useAuth();
  const pro = useProfessional();
  const name = user?.fullName?.trim() || user?.email || "Mi cuenta";
  const business = pro.data?.businessName ?? "";
  const logoFileId = (pro.data?.publicPageSettings as PublicPageBranding | undefined)?.logoFileId;

  return (
    <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar name={business || name} fileId={logoFileId} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{name}</p>
          {business && <p className="truncate text-xs text-muted-foreground">{business}</p>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <ThemeToggle />
        <button
          type="button"
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
          onClick={() => logout()}
          className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </div>
  );
}
