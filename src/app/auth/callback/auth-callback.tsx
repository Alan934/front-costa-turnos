"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { setAccessToken } from "@/lib/api/axios-instance";

/**
 * Aterrizaje del login con Google. El backend redirige a
 * `/auth/callback?access_token=...&refresh_token=...`. Guardamos el token, refrescamos la
 * sesión y derivamos según el rol.
 */
export function AuthCallback() {
  const router = useRouter();
  const params = useSearchParams();
  const { refresh, user } = useAuth();
  const [failed, setFailed] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    const accessToken = params.get("access_token");
    if (!accessToken) {
      setFailed(true);
      return;
    }
    setAccessToken(accessToken);
    refresh()
      .then(() => {
        // El routeo definitivo lo hace el efecto de abajo cuando `user` esté disponible.
      })
      .catch(() => setFailed(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!user) return;
    if (user.roles.includes("professional")) router.replace("/app");
    else if (user.roles.includes("admin")) router.replace("/admin/profesionales");
    else router.replace("/mis-turnos");
  }, [user, router]);

  return (
    <div className="grid min-h-dvh place-items-center bg-background px-6">
      <div className="flex flex-col items-center gap-3 text-center text-muted-foreground">
        <span className="grid size-12 place-items-center rounded-2xl bg-accent text-accent-foreground">
          <CalendarClock className="size-6 animate-pulse" />
        </span>
        {failed ? (
          <>
            <p className="text-sm">No pudimos iniciar tu sesión con Google.</p>
            <button
              type="button"
              onClick={() => router.replace("/ingresar")}
              className="text-sm font-medium text-accent hover:underline"
            >
              Volver a ingresar
            </button>
          </>
        ) : (
          <p className="text-sm">Iniciando tu sesión…</p>
        )}
      </div>
    </div>
  );
}
