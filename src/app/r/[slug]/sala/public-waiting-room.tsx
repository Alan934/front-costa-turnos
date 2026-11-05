"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Users,
  Coffee,
  Pause,
  Power,
  Hand,
  Tv,
  ChevronRight,
  BellRing,
  Hourglass,
  Footprints,
  CalendarClock,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/state-views";
import { useComercioPublicPage } from "@/lib/api/public-booking";
import { usePublicWaitingRoom } from "@/lib/realtime/use-waiting-room";
import { WaitingRoomStatus } from "@/lib/api/generated/model/waitingRoomStatus";
import { titleCaseName } from "@/lib/format";
import { describeWindow, formatWalkInWindows } from "@/lib/attendance";
import { cn } from "@/lib/utils";
import { SelfCheckInDialog } from "./self-check-in-dialog";
import type { WaitingRoomDto } from "@/lib/api/generated/model/waitingRoomDto";

/**
 * Pantalla pública de la sala de espera: la que abre quien escanea el QR del
 * local. Sin sesión y sin roles a propósito — sirve tanto para el cliente que
 * mira desde su celular como para una tablet colgada en la pared (`?tv=1`).
 *
 * Solo lectura: acá nadie llama ni atiende. Lo único que se puede hacer es
 * anotarse, y solo si el profesional lo habilitó.
 */
export function PublicWaitingRoomPage({ slug }: { slug: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const tv = params.get("tv") === "1";
  const proParam = params.get("pro");

  const page = useComercioPublicPage(slug);
  const professionals = page.data?.professionals ?? [];
  // Comercio-de-uno: no tiene sentido preguntar con quién; se entra directo.
  const membershipId = proParam ?? (professionals.length === 1 ? professionals[0].membershipId : null);

  if (page.isLoading) {
    return (
      <Shell tv={tv}>
        <Skeleton className="h-64 w-full rounded-3xl" />
      </Shell>
    );
  }
  if (page.isError) {
    return (
      <Shell tv={tv}>
        <ErrorState
          title="No pudimos cargar la sala"
          message="Revisá el enlace o tu conexión."
          onRetry={() => page.refetch()}
        />
      </Shell>
    );
  }

  // Varios profesionales en el local: primero hay que elegir a quién se espera.
  if (!membershipId) {
    return (
      <Shell tv={tv} businessName={page.data?.name}>
        <p className="mb-3 text-sm text-muted-foreground">¿A quién venís a ver?</p>
        <ul className="space-y-2">
          {professionals.map((p) => (
            <li key={p.membershipId}>
              <button
                type="button"
                onClick={() => router.push(`/r/${slug}/sala?pro=${p.membershipId}`)}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left hover:border-accent/60"
              >
                <span className="min-w-0 flex-1 truncate font-medium">{p.displayName}</span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      </Shell>
    );
  }

  return (
    <RoomView
      slug={slug}
      membershipId={membershipId}
      businessName={page.data?.name}
      tv={tv}
    />
  );
}

function RoomView({
  slug,
  membershipId,
  businessName,
  tv,
}: {
  slug: string;
  membershipId: string;
  businessName?: string;
  tv: boolean;
}) {
  const { room, isLoading, isError, refetch } = usePublicWaitingRoom(slug, membershipId);
  const [checkingIn, setCheckingIn] = useState(false);

  if (isLoading) {
    return (
      <Shell tv={tv} businessName={businessName}>
        <Skeleton className="h-64 w-full rounded-3xl" />
      </Shell>
    );
  }
  if (isError || !room) {
    return (
      <Shell tv={tv} businessName={businessName}>
        <ErrorState
          title="Esta sala no está disponible"
          message="El profesional puede no tener publicada su sala de espera."
          onRetry={() => refetch()}
        />
      </Shell>
    );
  }

  return (
    <Shell tv={tv} businessName={businessName} slug={slug} membershipId={membershipId}>
      {/* En un comercio de una sola persona el nombre del negocio y el del profesional suelen
          ser el mismo: mostrarlo dos veces es ruido. */}
      {!sameName(room.staffName, businessName) && (
        <p className="font-display text-lg font-semibold">{titleCaseName(room.staffName)}</p>
      )}
      <RoomStatusBanner room={room} />
      <AttendanceBanner room={room} tv={tv} />

      <NowServing room={room} tv={tv} />
      <Calling room={room} tv={tv} />

      <div className="mt-6">
        <p className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Users className="size-4" />
          {room.queue.length === 0
            ? "Nadie esperando"
            : room.queue.length === 1
              ? "1 persona esperando"
              : `${room.queue.length} personas esperando`}
        </p>
        <ol className="space-y-2">
          {room.queue.map((item) => (
            <li
              key={item.appointmentId}
              className={cn(
                "flex items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-2.5",
                tv && "px-5 py-4",
              )}
            >
              <span
                className={cn(
                  "grid shrink-0 place-items-center rounded-lg bg-muted font-display font-semibold tabular-nums",
                  tv ? "size-14 text-2xl" : "size-8 text-sm",
                )}
              >
                {item.ticketNumber}
              </span>
              <span className={cn("min-w-0 flex-1 truncate font-medium", tv && "text-2xl")}>
                {item.displayName}
              </span>
              <span
                className={cn(
                  item.calledAt && !item.awayUntil ? "font-medium text-accent" : "text-muted-foreground",
                  tv ? "text-xl" : "text-xs",
                )}
                title="Tiempo estimado de espera"
              >
                {item.awayUntil ? (
                  <span className="inline-flex items-center gap-1">
                    <Hourglass className="size-3" />
                    ausente
                  </span>
                ) : item.calledAt ? (
                  "llamado"
                ) : item.position === 0 ? (
                  "sigue"
                ) : (
                  `~${item.etaMinutes}′`
                )}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {/* `selfCheckInOpen` ya descuenta: self check-in apagado, sala cerrada y fuera de las franjas
          por orden de llegada. */}
      {room.selfCheckInOpen && !tv && (
        <Button size="lg" className="mt-6 w-full" onClick={() => setCheckingIn(true)}>
          <Hand className="size-5" />
          Anotarme en la fila
        </Button>
      )}

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Esta pantalla se actualiza sola.
      </p>

      {checkingIn && (
        <SelfCheckInDialog
          slug={slug}
          membershipId={membershipId}
          onClose={() => setCheckingIn(false)}
        />
      )}
    </Shell>
  );
}

/** "Atendiendo ahora", en grande. En modo TV es lo único que se lee de lejos. */
function NowServing({ room, tv }: { room: WaitingRoomDto; tv: boolean }) {
  if (!room.nowServing) {
    return (
      <div className="mt-5 rounded-3xl border border-dashed border-border p-8 text-center">
        <Coffee className="mx-auto size-8 text-muted-foreground" />
        <p className={cn("mt-2 font-display font-semibold", tv && "text-3xl")}>
          No hay nadie en atención
        </p>
      </div>
    );
  }
  return (
    <div className="mt-5 rounded-3xl border border-status-serving-foreground/30 bg-status-serving p-7 text-center">
      <p
        className={cn(
          "font-medium uppercase tracking-wide text-status-serving-foreground",
          tv ? "text-2xl" : "text-xs",
        )}
      >
        Atendiendo ahora
      </p>
      <p
        className={cn(
          "mt-1 font-display font-semibold tabular-nums text-status-serving-foreground",
          tv ? "text-[10rem] leading-none" : "text-6xl",
        )}
      >
        #{room.nowServing.ticketNumber}
      </p>
      <p className={cn("mt-2 font-medium", tv ? "text-4xl" : "text-lg")}>
        {room.nowServing.displayName}
      </p>
    </div>
  );
}

/** Compara nombres ignorando mayúsculas y espacios: "Qa Sala" == " qa sala ". */
function sameName(a?: string | null, b?: string | null): boolean {
  const n = (x?: string | null) => (x ?? "").trim().toLowerCase();
  return !!n(a) && n(a) === n(b);
}

/**
 * Quien fue llamado y todavía no se acercó: en la cartelera es lo que la gente de la sala
 * tiene que ver ("el 12, pase"), por eso va destacado y no mezclado en la lista.
 */
function Calling({ room, tv }: { room: WaitingRoomDto; tv: boolean }) {
  const called = room.queue.filter((i) => i.calledAt && !i.awayUntil);
  if (called.length === 0) return null;
  return (
    <div className="mt-3 space-y-2">
      {called.map((i) => (
        <div
          key={i.appointmentId}
          className="flex items-center justify-center gap-3 rounded-2xl border border-accent/60 bg-accent/10 px-4 py-3 text-accent"
        >
          <BellRing className={cn("shrink-0 animate-pulse", tv ? "size-10" : "size-5")} />
          <p className={cn("font-display font-semibold", tv ? "text-5xl" : "text-lg")}>
            Llamando al #{i.ticketNumber} · {i.displayName}
          </p>
        </div>
      ))}
    </div>
  );
}

/**
 * Cómo se atiende hoy: por orden de llegada (y hasta cuándo) o con turno (y cuándo vuelve la
 * próxima franja por llegada). Evita que alguien llegue a una hora en que hoy no se atiende así.
 */
function AttendanceBanner({ room, tv }: { room: WaitingRoomDto; tv: boolean }) {
  const a = room.attendance;
  if (!a.hasSchedule) return null;
  const today = new Date().getDay();
  const todayText = a.todayWindows.map((w) => `${w.startTime}–${w.endTime}`).join(" y ");

  let Icon = Footprints;
  let title: string;
  let detail: string | null = null;
  if (a.walkInOnly && a.windows.length === 0) {
    title = "Atención por orden de llegada";
    detail = "No hace falta turno: anotate y esperá tu número.";
  } else if (a.openNow) {
    title = "Ahora se atiende por orden de llegada";
    detail = todayText ? `Hoy: ${todayText}` : null;
  } else {
    Icon = CalendarClock;
    title = a.walkInOnly ? "Ahora no estamos atendiendo" : "Ahora se atiende solo con turno";
    detail = a.nextWindow
      ? `Orden de llegada: ${describeWindow(a.nextWindow, today)}`
      : formatWalkInWindows(a.windows).join(" · ");
  }

  return (
    <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3">
      <Icon className={cn("mt-0.5 shrink-0 text-accent", tv ? "size-6" : "size-4")} />
      <div>
        <p className={cn("font-medium", tv ? "text-2xl" : "text-sm")}>{title}</p>
        {detail && (
          <p className={cn("text-muted-foreground", tv ? "text-xl" : "text-sm")}>{detail}</p>
        )}
      </div>
    </div>
  );
}

/** Aviso de pausa/cierre: evita que la gente espere sin saber que no se atiende. */
function RoomStatusBanner({ room }: { room: WaitingRoomDto }) {
  if (room.status === WaitingRoomStatus.open) return null;
  const paused = room.status === WaitingRoomStatus.paused;
  const Icon = paused ? Pause : Power;
  return (
    <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-border bg-muted/50 px-4 py-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-sm font-medium">
          {paused ? "Atención pausada por un momento" : "No se está atendiendo"}
        </p>
        {room.note && <p className="text-sm text-muted-foreground">{room.note}</p>}
      </div>
    </div>
  );
}

function Shell({
  children,
  tv,
  businessName,
  slug,
  membershipId,
}: {
  children: React.ReactNode;
  tv: boolean;
  businessName?: string;
  slug?: string;
  membershipId?: string;
}) {
  const tvHref =
    slug && membershipId ? `/r/${slug}/sala?pro=${membershipId}&tv=1` : undefined;
  return (
    <div className={cn("mx-auto flex min-h-dvh flex-col px-5 pb-10", tv ? "max-w-3xl" : "max-w-md")}>
      <header className="flex items-center justify-between py-5">
        <span className="truncate font-display text-sm font-semibold tracking-tight text-muted-foreground">
          {businessName ?? "Sala de espera"}
        </span>
        <div className="flex items-center gap-2">
          {tvHref && !tv && (
            <Button variant="ghost" size="sm" asChild title="Modo cartelera (pantalla grande)">
              <a href={tvHref}>
                <Tv className="size-4" />
              </a>
            </Button>
          )}
          <ThemeToggle />
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
