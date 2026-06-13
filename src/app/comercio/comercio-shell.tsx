"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { CalendarClock, LogOut } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/components/auth-provider";
import { Avatar } from "@/components/avatar";

/**
 * Shell del panel comercial (dueño del comercio). Más simple que el del profesional:
 * una sola pantalla de gestión, sin agenda ni suscripción propia.
 */
export function ComercioShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const name = user?.fullName?.trim() || user?.email || "Mi cuenta";

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3 sm:px-8">
          <Link href="/comercio" className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-accent text-accent-foreground">
              <CalendarClock className="size-4" />
            </span>
            <span className="font-display text-base font-semibold tracking-tight">
              Costa Turnos
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 sm:flex">
              <Avatar name={name} />
              <span className="max-w-[12rem] truncate text-sm text-muted-foreground">{name}</span>
            </div>
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
      </header>

      <main className="min-w-0">{children}</main>
    </div>
  );
}
