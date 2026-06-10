import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

/** Layout centrado para pantallas de autenticación (login, registro, reclamar). */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-md items-center justify-between px-5 py-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-accent text-accent-foreground">
            <CalendarClock className="size-4" />
          </span>
          <span className="font-display text-base font-semibold tracking-tight">
            Costa Turnos
          </span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-5 pb-16">
        <div className="w-full max-w-md">
          <div className="text-center">
            <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="mt-7 rounded-2xl border border-border bg-card p-6 shadow-sm">
            {children}
          </div>
          {footer && (
            <div className="mt-5 text-center text-sm text-muted-foreground">{footer}</div>
          )}
        </div>
      </main>
    </div>
  );
}
