"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import type { AccountRole } from "@/mocks/contract-extensions";

/**
 * Protege un subárbol: exige sesión y, opcionalmente, un rol.
 * Mientras carga la sesión muestra un splash; sin permiso redirige a /ingresar.
 */
export function RequireAuth({
  role,
  children,
}: {
  role?: AccountRole;
  children: ReactNode;
}) {
  const { user, loading, hasRole } = useAuth();
  const router = useRouter();

  const allowed = !!user && (!role || hasRole(role));

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/ingresar");
    } else if (role && !hasRole(role)) {
      router.replace("/");
    }
  }, [loading, user, role, hasRole, router]);

  if (loading || !allowed) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <span className="grid size-12 place-items-center rounded-2xl bg-accent text-accent-foreground">
            <CalendarClock className="size-6 animate-pulse" />
          </span>
          <p className="text-sm">Cargando tu sesión…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
