"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Store, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { AuthShell } from "@/components/auth-shell";
import { useAuth } from "@/components/auth-provider";
import { useAcceptInvitation, useInvitationPreview } from "@/lib/api/comercios";
import { titleCaseName } from "@/lib/format";
import type { AxiosError } from "axios";

/**
 * Aterrizaje del email de invitación: `/comercios/invitacion?token=...`.
 *
 * El backend expone una vista previa pública del token (nombre del comercio, email invitado
 * y si ese email ya tiene cuenta). Con eso guiamos al profesional al paso correcto:
 * - sin cuenta → registro de profesional con el email pre-cargado;
 * - con cuenta → login con el email pre-cargado;
 * y siempre volvemos acá (vía `next`) para aceptar. Si el preview no está disponible
 * (red/endpoint), degradamos a ofrecer ambas opciones.
 */
export function AcceptInvitation() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const { user, loading, hasRole, logout } = useAuth();
  const preview = useInvitationPreview(token);
  const accept = useAcceptInvitation();
  const [error, setError] = useState<string | null>(null);

  const info = preview.data;
  const comercioLabel = info?.comercioName ? titleCaseName(info.comercioName) : null;

  // Ruta de retorno para volver a esta misma invitación tras autenticarse.
  const backHere = `/comercios/invitacion?token=${encodeURIComponent(token ?? "")}`;
  // Pre-cargamos el email invitado en /ingresar; `registro=profesional` abre directo el alta.
  const emailQ = info?.email ? `&email=${encodeURIComponent(info.email)}` : "";
  const loginHref = `/ingresar?next=${encodeURIComponent(backHere)}${emailQ}`;
  const registerHref = `${loginHref}&registro=profesional`;

  // 1) Token ausente: enlace inválido. (El preview es enriquecimiento, no el filtro de validez:
  //    un token válido con el endpoint aún no desplegado no debe romper la pantalla.)
  if (!token) {
    return (
      <AuthShell title="Invitación no válida" subtitle="El enlace está incompleto o expiró.">
        <Result
          icon={<AlertCircle className="size-6" />}
          tone="error"
          message="No encontramos el código de la invitación. Pedile al comercio que te reenvíe el email."
          action={
            <Button asChild variant="outline" className="w-full">
              <Link href="/ingresar">Ir a ingresar</Link>
            </Button>
          }
        />
      </AuthShell>
    );
  }

  // 2) Sesión o preview cargando.
  if (loading || preview.isLoading) {
    return (
      <AuthShell title="Sumarte a un equipo">
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Spinner />
        </div>
      </AuthShell>
    );
  }

  const teamSubtitle = comercioLabel
    ? `Te invitaron a trabajar en ${comercioLabel}.`
    : "Te invitaron a trabajar en un comercio.";

  // 3) Sin sesión: guiamos a registrarse o ingresar según si el email ya tiene cuenta.
  if (!user) {
    // 3a) Sabemos que NO tiene cuenta → registro de profesional.
    if (info && !info.accountExists) {
      return (
        <AuthShell title="Te invitaron a un equipo" subtitle={teamSubtitle}>
          <Result
            icon={<Store className="size-6" />}
            tone="info"
            message={`Creá tu cuenta de profesional con ${info.email} y te traemos de vuelta para aceptar.`}
            action={
              <Button asChild className="w-full">
                <Link href={registerHref}>Crear cuenta de profesional</Link>
              </Button>
            }
          />
        </AuthShell>
      );
    }
    // 3b) Sabemos que SÍ tiene cuenta → login con el email pre-cargado.
    if (info && info.accountExists) {
      return (
        <AuthShell title="Te invitaron a un equipo" subtitle={teamSubtitle}>
          <Result
            icon={<Store className="size-6" />}
            tone="info"
            message={`Ya tenés una cuenta con ${info.email}. Ingresá y te traemos de vuelta para aceptar.`}
            action={
              <Button asChild className="w-full">
                <Link href={loginHref}>Ingresar con mi cuenta</Link>
              </Button>
            }
          />
        </AuthShell>
      );
    }
    // 3c) Sin preview (red/endpoint): ofrecemos ambas opciones.
    return (
      <AuthShell
        title="Te invitaron a un equipo"
        subtitle="Necesitás una cuenta de profesional para aceptar la invitación."
      >
        <Result
          icon={<Store className="size-6" />}
          tone="info"
          message="Ingresá con tu cuenta de profesional o creá una nueva, y te traemos de vuelta para aceptar."
          action={
            <div className="w-full space-y-2">
              <Button asChild className="w-full">
                <Link href={registerHref}>Crear cuenta de profesional</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href={loginHref}>Ya tengo cuenta · Ingresar</Link>
              </Button>
            </div>
          }
        />
      </AuthShell>
    );
  }

  // 4) Logueado con un email distinto al invitado: la invitación es para otra cuenta.
  if (info?.email && user.email && user.email.toLowerCase() !== info.email.toLowerCase()) {
    return (
      <AuthShell
        title="Esta invitación es para otra cuenta"
        subtitle={comercioLabel ? `Invitación de ${comercioLabel}.` : undefined}
      >
        <Result
          icon={<AlertCircle className="size-6" />}
          tone="info"
          message={`La invitación se envió a ${info.email}, pero entraste con ${user.email}. Cerrá sesión e ingresá con la cuenta invitada.`}
          action={
            <Button
              className="w-full"
              onClick={async () => {
                await logout();
                router.replace(loginHref);
              }}
            >
              <LogOut className="size-4" />
              Cerrar sesión y cambiar de cuenta
            </Button>
          }
        />
      </AuthShell>
    );
  }

  // 5) Logueado pero sin perfil de profesional (p. ej. cliente): debe registrarse como profesional.
  if (!hasRole("professional")) {
    return (
      <AuthShell
        title="Falta tu perfil de profesional"
        subtitle="Las invitaciones a comercios son para trabajadores."
      >
        <Result
          icon={<Store className="size-6" />}
          tone="info"
          message="Tu cuenta no es de profesional. Registrate como profesional con este mismo email y volvé a abrir el enlace de la invitación."
          action={
            <Button asChild className="w-full">
              <Link href={registerHref}>Crear cuenta de profesional</Link>
            </Button>
          }
        />
      </AuthShell>
    );
  }

  // 6) Profesional logueado con el email correcto: confirmar y aceptar.
  function onAccept() {
    setError(null);
    accept.mutate(token!, {
      onSuccess: () => {
        const dest = comercioLabel
          ? `/app?bienvenido=${encodeURIComponent(comercioLabel)}`
          : "/app?bienvenido=1";
        router.replace(dest);
      },
      onError: (err) => {
        const status = (err as AxiosError).response?.status;
        setError(
          status === 404 || status === 410 || status === 400
            ? "La invitación ya no es válida (expiró o ya fue usada). Pedile al comercio que te reenvíe una nueva."
            : status === 403 || status === 409
              ? "Esta invitación es para otra cuenta. Ingresá con el email al que llegó el correo."
              : "No pudimos aceptar la invitación. Probá de nuevo en un momento.",
        );
      },
    });
  }

  return (
    <AuthShell title="Sumarte a un equipo" subtitle={teamSubtitle}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {comercioLabel ? (
            <>
              Vas a sumarte a <span className="font-medium text-foreground">{comercioLabel}</span> con
              la cuenta <span className="font-medium text-foreground">{user.email}</span>.
            </>
          ) : (
            <>
              Vas a aceptar la invitación con la cuenta{" "}
              <span className="font-medium text-foreground">{user.email}</span>.
            </>
          )}
        </p>
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <Button className="w-full" disabled={accept.isPending} onClick={onAccept}>
          {accept.isPending ? <Spinner /> : null}
          Aceptar invitación
        </Button>
        <Button asChild variant="ghost" className="w-full">
          <Link href="/app">Ahora no</Link>
        </Button>
      </div>
    </AuthShell>
  );
}

function Result({
  icon,
  tone,
  message,
  action,
}: {
  icon: React.ReactNode;
  tone: "success" | "error" | "info";
  message: string;
  action: React.ReactNode;
}) {
  const toneCls =
    tone === "success"
      ? "bg-success/12 text-success"
      : tone === "error"
        ? "bg-destructive/10 text-destructive"
        : "bg-accent/10 text-accent";
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <span className={`grid size-12 place-items-center rounded-2xl ${toneCls}`}>{icon}</span>
      <p className="text-sm text-muted-foreground">{message}</p>
      <div className="w-full">{action}</div>
    </div>
  );
}
