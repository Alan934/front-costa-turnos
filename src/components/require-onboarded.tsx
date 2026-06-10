"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { useAuth } from "@/components/auth-provider";

/**
 * Para el panel del profesional: si la cuenta todavía no completó el onboarding (no tiene
 * `professionalId` / tenant), la manda a /onboarding. Va dentro de <RequireAuth>.
 */
export function RequireOnboarded({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const needsOnboarding = !loading && !!user && !user.professionalId;

  useEffect(() => {
    if (needsOnboarding) router.replace("/onboarding");
  }, [needsOnboarding, router]);

  if (needsOnboarding) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <span className="grid size-12 place-items-center rounded-2xl bg-accent text-accent-foreground">
            <CalendarClock className="size-6 animate-pulse" />
          </span>
          <p className="text-sm">Llevándote a configurar tu negocio…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
