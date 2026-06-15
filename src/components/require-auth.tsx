"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LogoMark } from "@/components/logo";
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
          <LogoMark size="xl" className="animate-pulse" />
          <p className="text-sm">Cargando tu sesión…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
