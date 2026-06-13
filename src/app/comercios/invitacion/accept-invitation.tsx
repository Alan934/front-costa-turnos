"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, AlertCircle, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { AuthShell } from "@/components/auth-shell";
import { useAuth } from "@/components/auth-provider";
import { useAcceptInvitation } from "@/lib/api/comercios";
import type { AxiosError } from "axios";

/**
 * Aterrizaje del email de invitación: `/comercios/invitacion?token=...`.
 * El profesional logueado acepta y queda como miembro del comercio. Si no tiene sesión de
 * profesional, lo guiamos a ingresar/registrarse y volver acá (con `next`).
 */
export function AcceptInvitation() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const { user, loading, hasRole } = useAuth();
  const accept = useAcceptInvitation();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Ruta de retorno para volver a esta misma invitación tras autenticarse.
  const backHere = `/comercios/invitacion?token=${encodeURIComponent(token ?? "")}`;
  const loginHref = `/ingresar?next=${encodeURIComponent(backHere)}`;

  // 1) Token ausente: enlace inválido.
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

  // 2) Sesión cargando.
  if (loading) {
    return (
      <AuthShell title="Sumarte a un equipo">
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Spinner />
        </div>
      </AuthShell>
    );
  }

  // 3) Sin sesión: hay que ingresar/registrarse primero.
  if (!user) {
    return (
      <AuthShell
        title="Te invitaron a un equipo"
        subtitle="Necesitás una cuenta de profesional para aceptar la invitación."
      >
        <Result
          icon={<Store className="size-6" />}
          tone="info"
          message="Ingresá con tu cuenta de profesional —o creá una— y te traemos de vuelta para aceptar."
          action={
            <Button asChild className="w-full">
              <Link href={loginHref}>Ingresar o crear cuenta</Link>
            </Button>
          }
        />
      </AuthShell>
    );
  }

  // 4) Logueado pero sin perfil de profesional (p. ej. cliente): debe registrarse como profesional.
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
              <Link href={loginHref}>Crear cuenta de profesional</Link>
            </Button>
          }
        />
      </AuthShell>
    );
  }

  // 5) Aceptada con éxito.
  if (done) {
    return (
      <AuthShell title="¡Listo!" subtitle="Ya formás parte del equipo.">
        <Result
          icon={<CheckCircle2 className="size-6" />}
          tone="success"
          message="Aceptaste la invitación. Vas a ver el comercio en “Mis comercios”."
          action={
            <Button className="w-full" onClick={() => router.replace("/app/comercios")}>
              Ver mis comercios
            </Button>
          }
        />
      </AuthShell>
    );
  }

  // 6) Profesional logueado: confirmar y aceptar.
  function onAccept() {
    setError(null);
    accept.mutate(token!, {
      onSuccess: () => setDone(true),
      onError: (err) => {
        const status = (err as AxiosError).response?.status;
        setError(
          status === 404 || status === 410 || status === 400
            ? "La invitación ya no es válida (expiró o ya fue usada). Pedile al comercio que te reenvíe una nueva."
            : "No pudimos aceptar la invitación. Probá de nuevo en un momento.",
        );
      },
    });
  }

  return (
    <AuthShell
      title="Sumarte a un equipo"
      subtitle="Te invitaron a trabajar en un comercio."
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Vas a aceptar la invitación con la cuenta{" "}
          <span className="font-medium text-foreground">{user.email}</span>.
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
