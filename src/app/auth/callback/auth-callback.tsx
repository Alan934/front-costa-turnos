"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogoMark } from "@/components/logo";
import { useAuth } from "@/components/auth-provider";
import { homeForUser } from "@/lib/auth-routing";
import { axiosInstance, setAuthTokens } from "@/lib/api/axios-instance";

/**
 * Aterrizaje del login con Google. El backend redirige a `/auth/callback?code=...` con un
 * código opaco de un solo uso (los tokens NO viajan en la URL: quedarían en el historial, en
 * logs y en el Referer). Lo canjeamos por los tokens con POST /auth/google/exchange, refrescamos
 * la sesión y derivamos según el rol.
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

    const code = params.get("code");
    // Saca el código de la URL ya mismo (historial / barra de direcciones).
    window.history.replaceState(null, "", window.location.pathname);
    if (!code) {
      setFailed(true);
      return;
    }
    axiosInstance
      .post<{ accessToken: string; refreshToken?: string; expiresIn?: string }>(
        "/auth/google/exchange",
        { code },
      )
      .then((res) => {
        setAuthTokens(res.data);
        return refresh();
      })
      .catch(() => setFailed(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!user) return;
    router.replace(homeForUser(user));
  }, [user, router]);

  return (
    <div className="grid min-h-dvh place-items-center bg-background px-6">
      <div className="flex flex-col items-center gap-3 text-center text-muted-foreground">
        <LogoMark size="xl" className="animate-pulse" />
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
