"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, BarChart3, ShieldCheck, Menu, X, LogOut, Users, Store } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/components/auth-provider";
import { cn } from "@/lib/utils";

const ADMIN_NAV = [
  { href: "/admin/profesionales", label: "Profesionales", icon: Building2 },
  { href: "/admin/comercios", label: "Comercios", icon: Store },
  { href: "/admin/clientes", label: "Clientes", icon: Users },
  { href: "/admin/metricas", label: "Métricas", icon: BarChart3 },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[256px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-card lg:flex">
        <Brand />
        <NavList onNavigate={() => {}} />
        <Footer />
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card/80 px-4 py-3 backdrop-blur lg:hidden">
        <BrandInline />
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
            <Footer />
          </div>
        </div>
      )}

      <main className="min-w-0">{children}</main>
    </div>
  );
}

function Brand() {
  return (
    <div className="px-5 py-5">
      <BrandInline />
      <p className="mt-1 pl-[2.6rem] text-xs text-muted-foreground">Panel de plataforma</p>
    </div>
  );
}

function BrandInline() {
  return (
    <Link href="/admin/profesionales" className="flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-xl bg-foreground text-background">
        <ShieldCheck className="size-5" />
      </span>
      <span className="font-display text-lg font-semibold tracking-tight">Costa Turnos</span>
    </Link>
  );
}

function NavList({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 space-y-0.5 px-3 py-2">
      {ADMIN_NAV.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-accent/10 text-accent" : "text-muted-foreground hover:bg-muted hover:text-foreground",
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

function Footer() {
  const { user, logout } = useAuth();
  return (
    <div className="flex items-center justify-between border-t border-border px-5 py-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{user?.fullName ?? "Admin"}</p>
        <p className="truncate text-xs text-muted-foreground">Administrador</p>
      </div>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <button
          type="button"
          aria-label="Salir"
          onClick={() => logout()}
          className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </div>
  );
}
