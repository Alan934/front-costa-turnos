"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, LogOut, Building2, ChevronDown } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { SubscriptionBanner } from "@/components/subscription-banner";
import { VerifyEmailBanner } from "@/components/verify-email-banner";
import { SetupChecklist } from "@/components/setup-checklist";
import { useAuth } from "@/components/auth-provider";
import { LogoutConfirm } from "@/components/logout-confirm";
import { useActiveComercio } from "@/components/comercio-context";
import { Avatar } from "@/components/avatar";
import { useProfessional } from "@/lib/api/professional";
import { APP_NAV_GROUPS, MOBILE_TABS, isNavActive } from "./nav";
import { cn } from "@/lib/utils";
import type { PublicPageBranding } from "@/mocks/contract-extensions";

/**
 * Layout del panel del profesional: sidebar en desktop; en el celular, barra inferior con lo del
 * día a día (Inicio, Agenda, Sala, Clientes) y "Más", que abre el resto agrupado.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[256px_1fr] print:block">
      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-card lg:flex print:hidden">
        <Brand />
        <ComercioSwitcher />
        <NavList onNavigate={() => {}} />
        <SidebarFooter />
      </aside>

      {/* Topbar mobile */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card/80 px-4 py-3 backdrop-blur lg:hidden print:hidden">
        <Logo href="/app" size="md" />
        <ThemeToggle />
      </header>

      {/* "Más" (mobile): todas las secciones agrupadas, la cuenta y el selector de comercio */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Cerrar menú"
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-0 flex h-full w-72 flex-col overflow-y-auto bg-card shadow-lg">
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

      {/* Barra inferior (mobile) */}
      <MobileTabBar onMore={() => setOpen(true)} moreOpen={open} />

      {/* En el celular deja lugar para la barra inferior fija. */}
      <main className="min-w-0 pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0 print:pb-0">
        <div className="print:hidden">
          <VerifyEmailBanner />
          <SetupChecklist />
        </div>
        {children}
        {/* Va al final: rinde una tarjeta FIJA al pie + un espaciador para no tapar contenido. */}
        <div className="print:hidden">
          <SubscriptionBanner />
        </div>
      </main>
    </div>
  );
}

function Brand() {
  return (
    <span className="flex px-5 py-5">
      <Logo href="/app" size="lg" />
    </span>
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
    <nav className="flex-1 overflow-y-auto px-3 py-2">
      {APP_NAV_GROUPS.map((group) => (
        <div key={group.label ?? "main"} className={group.label ? "mt-4" : undefined}>
          {group.label && (
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {group.label}
            </p>
          )}
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const active = isNavActive(item.href, pathname);
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
          </div>
        </div>
      ))}
    </nav>
  );
}

/** Barra inferior del celular: las 4 secciones del día a día + "Más" (abre el resto). */
function MobileTabBar({ onMore, moreOpen }: { onMore: () => void; moreOpen: boolean }) {
  const pathname = usePathname();
  const inTabs = MOBILE_TABS.some((t) => isNavActive(t.href, pathname));
  const tabClass = (active: boolean) =>
    cn(
      "flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
      active ? "text-accent" : "text-muted-foreground hover:text-foreground",
    );

  return (
    <nav
      aria-label="Secciones principales"
      className="fixed inset-x-0 bottom-0 z-40 flex h-[calc(4rem+env(safe-area-inset-bottom))] border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden print:hidden"
    >
      {MOBILE_TABS.map((t) => {
        const active = !moreOpen && isNavActive(t.href, pathname);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={tabClass(active)}
            aria-current={active ? "page" : undefined}
          >
            <t.icon className="size-5" />
            {t.label}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={onMore}
        className={tabClass(moreOpen || !inTabs)}
        aria-label="Más secciones"
        aria-expanded={moreOpen}
      >
        <Menu className="size-5" />
        Más
      </button>
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
        <LogoutConfirm>
          <button
            type="button"
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
            className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <LogOut className="size-4" />
          </button>
        </LogoutConfirm>
      </div>
    </div>
  );
}
