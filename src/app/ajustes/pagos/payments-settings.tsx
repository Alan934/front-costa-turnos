"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Link2, Unlink, AlertTriangle, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/theme-toggle";
import { ErrorState } from "@/components/state-views";
import { useMpStatus, useMpConnect, useMpDisconnect } from "@/lib/api/billing";
import { formatDateLong } from "@/lib/format";

export function PaymentsSettings() {
  const params = useSearchParams();
  const status = useMpStatus();
  const connect = useMpConnect();
  const disconnect = useMpDisconnect();

  // Resultado del callback de MercadoPago (?mp=connected|error).
  const [callback, setCallback] = useState<"connected" | "error" | null>(null);
  useEffect(() => {
    const mp = params.get("mp");
    if (mp === "connected" || mp === "error") {
      setCallback(mp);
      status.refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  function startConnect() {
    connect.mutate(undefined, {
      onSuccess: (res) => {
        if (res?.url) window.location.href = res.url;
      },
    });
  }

  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-5 py-6 sm:px-8">
      <header className="flex items-center justify-between">
        <Link href="/app" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          Volver al panel
        </Link>
        <ThemeToggle />
      </header>

      <div className="mt-6 flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-accent/10 text-accent">
          <Wallet className="size-5" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Cobros con MercadoPago</h1>
          <p className="text-sm text-muted-foreground">
            Conectá tu cuenta para recibir las señas y pagos directo en tu MercadoPago.
          </p>
        </div>
      </div>

      {callback === "connected" && (
        <Banner tone="ok" icon={<CheckCircle2 className="size-4" />}>
          ¡Listo! Conectaste tu cuenta de MercadoPago.
        </Banner>
      )}
      {callback === "error" && (
        <Banner tone="error" icon={<AlertTriangle className="size-4" />}>
          No pudimos conectar tu cuenta. Probá de nuevo.
        </Banner>
      )}

      <div className="mt-6 rounded-2xl border border-border bg-card p-5">
        {status.isLoading && <Skeleton className="h-24 w-full rounded-xl" />}
        {status.isError && <ErrorState message="No pudimos leer el estado de conexión." onRetry={() => status.refetch()} />}
        {status.data && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-display font-semibold">Estado de la conexión</p>
                <p className="text-sm text-muted-foreground">
                  {status.data.connected
                    ? `Cuenta conectada${status.data.connectedAt ? ` el ${formatDateLong(status.data.connectedAt)}` : ""}.`
                    : "Todavía no conectaste tu cuenta."}
                </p>
              </div>
              <Badge variant={status.data.connected ? "success" : "muted"}>
                {status.data.connected ? "Conectada" : "Sin conectar"}
              </Badge>
            </div>

            <div className="mt-5">
              {status.data.connected ? (
                <Button
                  variant="outline"
                  onClick={() => disconnect.mutate()}
                  disabled={disconnect.isPending}
                >
                  {disconnect.isPending ? <Spinner /> : <Unlink className="size-4" />}
                  Desconectar cuenta
                </Button>
              ) : (
                <Button onClick={startConnect} disabled={connect.isPending}>
                  {connect.isPending ? <Spinner /> : <Link2 className="size-4" />}
                  Conectar con MercadoPago
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Si no conectás MercadoPago, vas a poder cobrar las señas en efectivo pero no generar
        links de pago online para tus clientes.
      </p>
    </div>
  );
}

function Banner({
  tone,
  icon,
  children,
}: {
  tone: "ok" | "error";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        "mt-5 flex items-center gap-2.5 rounded-xl border p-3.5 text-sm " +
        (tone === "ok"
          ? "border-success/40 bg-success/10 text-success"
          : "border-destructive/40 bg-destructive/10 text-destructive")
      }
    >
      {icon}
      {children}
    </div>
  );
}
