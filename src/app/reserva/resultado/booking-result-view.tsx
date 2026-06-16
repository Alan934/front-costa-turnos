"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Clock, XCircle, CalendarCheck2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoMark } from "@/components/logo";
import { readPaymentResultFromParams, type PayResult } from "@/lib/payment-result";

const CFG: Record<
  PayResult,
  { cls: string; icon: React.ReactNode; title: string; text: string }
> = {
  approved: {
    cls: "border-success/40 bg-success/10 text-success",
    icon: <CheckCircle2 className="size-7 shrink-0" />,
    title: "¡Turno confirmado!",
    text: "Tu pago se acreditó y tu turno quedó reservado. Te enviamos los detalles por email.",
  },
  pending: {
    cls: "border-warning/45 bg-warning/10 text-warning-foreground",
    icon: <Clock className="size-7 shrink-0" />,
    title: "Pago pendiente",
    text: "MercadoPago está procesando el pago. Cuando se acredite, confirmamos tu turno y te avisamos.",
  },
  rejected: {
    cls: "border-destructive/45 bg-destructive/10 text-destructive",
    icon: <XCircle className="size-7 shrink-0" />,
    title: "No se pudo procesar el pago",
    text: "El pago fue rechazado o cancelado. Tu turno no quedó reservado. Probá de nuevo o con otro medio.",
  },
};

export function BookingResultView() {
  const params = useSearchParams();
  // El back redirige acá tras el pago de seña/turno (external_reference pay:<id>).
  // No parseamos el prefijo: solo leemos status/collection_status de los query params.
  const result = useMemo(() => readPaymentResultFromParams(params), [params]);
  const cfg = result ? CFG[result] : null;

  return (
    <div className="min-h-dvh bg-background">
      <header className="flex items-center justify-between px-5 py-4 sm:px-8">
        <LogoMark />
        <ThemeToggle />
      </header>

      <main className="mx-auto max-w-md px-5 py-10 sm:px-8">
        {cfg ? (
          <div className={`flex flex-col items-center gap-4 rounded-2xl border p-6 text-center ${cfg.cls}`}>
            {cfg.icon}
            <div>
              <h1 className="font-display text-xl font-semibold">{cfg.title}</h1>
              <p className="mt-1.5 text-sm opacity-90">{cfg.text}</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-6 text-center">
            <CalendarCheck2 className="size-7 shrink-0 text-muted-foreground" />
            <div>
              <h1 className="font-display text-xl font-semibold">Resultado de tu reserva</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                No pudimos leer el estado del pago. Revisá tus turnos para ver si quedó confirmado.
              </p>
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2.5">
          <Button asChild className="w-full">
            <Link href="/mis-turnos">
              Ver mis turnos
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          {result === "rejected" && (
            <Button asChild variant="outline" className="w-full">
              <Link href="/">Volver al inicio</Link>
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
