"use client";

import { useMemo, useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { detectEnv, type PushEnv } from "@/lib/push";
import type { PushProblem } from "@/lib/use-push-activation";

interface Guide {
  title: string;
  intro: string;
  steps: string[];
  /** Aclaración al final, chica. */
  note?: string;
}

const APP = "Costa Turnos";

/**
 * Los navegadores no dejan abrir sus ajustes desde una página ni volver a pedir un permiso
 * bloqueado: lo único posible es decirle a la persona, paso a paso y según SU navegador, dónde
 * está el interruptor. El hook de activación detecta el cambio y termina solo al volver.
 */
function buildGuide(env: PushEnv, problem: PushProblem | null): Guide {
  if (env.inApp) {
    return {
      title: "Abrilo en tu navegador",
      intro:
        "Estás viendo esto dentro de otra app (WhatsApp, Instagram, Facebook…) y ahí no se pueden activar los avisos. Abrí esta misma página en tu navegador:",
      steps:
        env.platform === "ios"
          ? [
              "Tocá el ícono de brújula o los tres puntos (⋯) de abajo o arriba a la derecha.",
              "Elegí «Abrir en Safari».",
              "Tocá «Avisarme cuando me toque» de nuevo.",
            ]
          : [
              "Tocá los tres puntos (⋮) de arriba a la derecha.",
              "Elegí «Abrir en Chrome» o «Abrir en el navegador».",
              "Tocá «Avisarme cuando me toque» de nuevo.",
            ],
    };
  }

  if (problem === "unsupported" && env.platform === "ios") {
    return {
      title: "Instalá la web en tu iPhone",
      intro:
        "En iPhone los avisos con la pantalla cerrada solo funcionan si agregás esta página a tu pantalla de inicio:",
      steps: [
        "Abrí esta página en Safari.",
        "Tocá el botón Compartir (el cuadrado con la flecha hacia arriba).",
        "Elegí «Agregar a inicio».",
        `Abrí ${APP} desde el ícono nuevo y tocá «Avisarme cuando me toque».`,
      ],
      note: "Necesitás iOS 16.4 o más nuevo. Mientras tanto podés activar el sonido y dejar esta pantalla abierta.",
    };
  }

  if (problem === "unsupported") {
    return {
      title: "Este navegador no permite avisos",
      intro:
        "Probá abrir la página en Chrome, Edge o Firefox actualizados. Mientras tanto, activá el sonido y dejá esta pantalla abierta: te avisamos con sonido y vibración.",
      steps: [],
    };
  }

  if (env.platform === "ios") {
    return {
      title: "Habilitá las notificaciones",
      intro: "Están bloqueadas para esta web. Desbloquealas desde los ajustes del iPhone:",
      steps: [
        "Abrí «Ajustes» del iPhone.",
        "Tocá «Notificaciones».",
        `Buscá «${APP}» y activá «Permitir notificaciones».`,
        "Volvé acá: se activa solo.",
      ],
    };
  }

  if (env.platform === "android") {
    return {
      title: "Habilitá las notificaciones",
      intro: "Están bloqueadas para esta web. Desbloquealas desde tu navegador:",
      steps:
        env.browser === "firefox"
          ? [
              "Tocá el candado a la izquierda de la dirección.",
              "Tocá «Permisos» y después «Notificaciones».",
              "Quitá el bloqueo (elegí «Permitir»).",
              "Volvé acá: se activa solo.",
            ]
          : [
              "Tocá el candado (o el ícono de ajustes) a la izquierda de la dirección.",
              "Tocá «Permisos» o «Configuración del sitio».",
              "Poné «Notificaciones» en «Permitir».",
              "Volvé acá: se activa solo.",
            ],
      note: "Si no encontrás el candado: menú ⋮ → Configuración → Configuración de sitios → Notificaciones, y permití este sitio. También revisá que las notificaciones del navegador no estén apagadas en los Ajustes del celular.",
    };
  }

  if (env.browser === "safari") {
    return {
      title: "Habilitá las notificaciones",
      intro: "Están bloqueadas para esta web. Desbloquealas desde Safari:",
      steps: [
        "En el menú de Safari abrí «Ajustes» y entrá en «Sitios web».",
        "Elegí «Notificaciones» en la lista de la izquierda.",
        "Poné esta web en «Permitir».",
        "Volvé a esta pestaña: se activa solo.",
      ],
    };
  }

  return {
    title: "Habilitá las notificaciones",
    intro: "Están bloqueadas para esta web. Desbloquealas desde tu navegador:",
    steps: [
      "Hacé clic en el candado (o el ícono de ajustes) a la izquierda de la dirección.",
      "Buscá «Notificaciones» y cambialo a «Permitir».",
      "Volvé a esta pestaña: se activa solo.",
    ],
    note: "Si no aparece, revisá que las notificaciones del sistema no estén desactivadas para tu navegador.",
  };
}

/** Guía de "no se pudieron activar las notificaciones": qué tocar, según el navegador y el celu. */
export function NotificationHelp({
  open,
  problem,
  onClose,
  onRetry,
}: {
  open: boolean;
  problem: PushProblem | null;
  onClose: () => void;
  /** "Ya lo habilité": vuelve a intentar sin esperar al cambio automático. */
  onRetry?: () => void;
}) {
  const env = useMemo(() => (open ? detectEnv() : null), [open]);
  const [copied, setCopied] = useState(false);
  if (!env) return null;

  const guide = buildGuide(env, problem);
  const retryable = problem === "denied" && !env.inApp;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* sin portapapeles: queda la guía */
    }
  }

  // En Android, Chrome sí se puede abrir directo desde un navegador interno con un intent.
  const chromeIntent =
    env.inApp && env.platform === "android"
      ? `intent://${window.location.host}${window.location.pathname}${window.location.search}#Intent;scheme=https;package=com.android.chrome;end`
      : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{guide.title}</DialogTitle>
          <DialogDescription>{guide.intro}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {guide.steps.length > 0 && (
            <ol className="space-y-2.5">
              {guide.steps.map((step, i) => (
                <li key={step} className="flex gap-3 text-sm">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          )}

          {guide.note && <p className="text-xs text-muted-foreground">{guide.note}</p>}

          <div className="flex flex-col gap-2">
            {chromeIntent && (
              <Button asChild>
                <a href={chromeIntent}>
                  <ExternalLink className="size-4" />
                  Abrir en Chrome
                </a>
              </Button>
            )}
            {(env.inApp || problem === "unsupported") && (
              <Button variant="outline" onClick={copyLink}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? "Enlace copiado" : "Copiar enlace"}
              </Button>
            )}
            {retryable && onRetry && (
              <Button onClick={onRetry}>
                <Check className="size-4" />
                Ya lo habilité
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>
              Seguir sin avisos
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
