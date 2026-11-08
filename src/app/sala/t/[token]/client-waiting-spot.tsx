"use client";

import { useEffect, useState } from "react";
import {
  Users,
  Clock3,
  CheckCircle2,
  Hourglass,
  Wifi,
  WifiOff,
  Bell,
  BellRing,
  BellOff,
  Hand,
  DoorOpen,
  LogOut,
  UserX,
  CalendarCheck,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { DelayNotice } from "@/components/delay-notice";
import { ErrorState } from "@/components/state-views";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyWaitingSpot, type ConnectionState } from "@/lib/realtime/use-waiting-room";
import {
  useAwayFromQueue,
  useBackToQueue,
  useLeaveQueue,
  useSubscribeSpotPush,
  useUnsubscribeSpotPush,
} from "@/lib/api/sala";
import { pushSupport, subscribeBrowser, unsubscribeBrowser } from "@/lib/push";
import { usePushPublicKey } from "@/lib/api/sala";
import { AppointmentStatus } from "@/lib/api/generated/model/appointmentStatus";
import { formatTime, formatRelativeMinutes, titleCaseName } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MyWaitingSpotDto } from "@/lib/api/generated/model/myWaitingSpotDto";
import type { WaitingItemDto } from "@/lib/api/generated/model/waitingItemDto";

/**
 * "Mi lugar en la fila": la pantalla que abre el cliente con su link personal.
 * Pública (el token es la credencial), pensada para dejarla abierta en el celu
 * mientras espera — o cerrarla: con los avisos push le llega la notificación igual.
 */
export function ClientWaitingSpot({ token }: { token: string }) {
  const { spot, isLoading, isError, refetch, connection } = useMyWaitingSpot(token);

  // El cliente deja el celu apoyado: el título de la pestaña le avisa sin mirar.
  useEffect(() => {
    const me = spot?.me;
    const original = document.title;
    if (me) {
      document.title =
        me.status === AppointmentStatus.in_progress || me.calledAt
          ? "¡Te llaman!"
          : me.status === AppointmentStatus.requested
            ? // Pendiente de aprobación: todavía no está en la fila, no tiene "posición".
              "Esperando confirmación del local"
            : me.awayUntil
              ? "Ausente · tu lugar está guardado"
              : me.position === 0
                ? "(1) Sos el siguiente"
                : `(${me.position}) Sala de espera`;
    }
    return () => {
      document.title = original;
    };
  }, [spot?.me]);

  // Vibración al ser llamado (Android; iOS no la soporta, ahí avisa el push).
  const calledAt = spot?.me?.calledAt ?? null;
  useEffect(() => {
    if (calledAt && "vibrate" in navigator) navigator.vibrate([300, 150, 300, 150, 300]);
  }, [calledAt]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-10">
      <header className="flex items-center justify-between py-5">
        <span className="truncate font-display text-sm font-semibold tracking-tight text-muted-foreground">
          {spot ? titleCaseName(spot.room.staffName) : "Sala de espera"}
        </span>
        <div className="flex items-center gap-2">
          <ConnectionPill state={connection} />
          <ThemeToggle />
        </div>
      </header>

      {isError && (
        <div className="py-10">
          <ErrorState
            title="No encontramos tu lugar"
            message="Revisá el enlace o volvé a anotarte en el local."
            onRetry={() => refetch()}
          />
        </div>
      )}

      {isLoading && <SpotSkeleton />}

      {!isLoading && !isError && spot && <SpotContent spot={spot} token={token} />}
    </div>
  );
}

function SpotContent({ spot, token }: { spot: MyWaitingSpotDto; token: string }) {
  const { me, room } = spot;

  if (!me) {
    return <OutcomeState outcome={spot.outcome} />;
  }

  // Ya lo están atendiendo.
  if (me.status === AppointmentStatus.in_progress) {
    return (
      <BigState
        tone="serving"
        icon={<Bell className="size-9" />}
        title="¡Es tu turno!"
        subtitle={`Pasá con ${titleCaseName(room.staffName)}. Te están esperando.`}
        ticket={me.ticketNumber}
      />
    );
  }

  // Se anotó por QR y el profesional todavía no lo aceptó.
  if (me.status === AppointmentStatus.requested) {
    return (
      <div className="flex flex-1 flex-col">
        <BigState
          tone="pending"
          icon={<Hand className="size-9" />}
          title="Te anotaste"
          subtitle="Esperá a que el local confirme que llegaste. Esta pantalla se actualiza sola."
          ticket={me.ticketNumber}
        />
        <LeaveButton token={token} />
      </div>
    );
  }

  // El profesional lo llamó: es el momento de acercarse.
  if (me.calledAt) {
    return (
      <div className="flex flex-1 flex-col">
        <BigState
          tone="serving"
          icon={<BellRing className="size-9" />}
          title="¡Te están llamando!"
          subtitle={`Pasá con ${titleCaseName(room.staffName)}.`}
          ticket={me.ticketNumber}
        />
        <LeaveButton token={token} />
      </div>
    );
  }

  const away = !!me.awayUntil;
  // Solo cuenta quien está en la fila esperando (la persona en atención se muestra aparte).
  const waiting = room.queue.length;

  return (
    <div className="flex flex-1 flex-col">
      {away && me.awayUntil ? (
        <AwayCard token={token} until={me.awayUntil} ticket={me.ticketNumber} />
      ) : (
        <div className="rounded-3xl border border-border bg-card p-7 text-center">
          <p className="text-sm text-muted-foreground">Tu turno</p>
          <p className="mt-1 font-display text-6xl font-semibold tabular-nums text-accent">
            #{me.ticketNumber}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <Stat
              icon={<Users className="size-4" />}
              value={String(me.position)}
              label={me.position === 1 ? "persona adelante" : "personas adelante"}
            />
            <Stat
              icon={<Clock3 className="size-4" />}
              value={me.etaMinutes <= 0 ? "Ya casi" : `~${me.etaMinutes}′`}
              label={me.etaMinutes <= 0 ? "es tu turno" : formatRelativeMinutes(me.etaMinutes)}
            />
          </div>
        </div>
      )}

      <DelayNotice minutes={room.delayMinutes} audience="client" className="mt-4" />

      <PushCard spot={spot} token={token} />

      <div className="mt-6">
        <p className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Hourglass className="size-4" />
          {waiting === 1 ? "1 persona en la fila" : `${waiting} personas en la fila`}
        </p>
        <ol className="space-y-2">
          {room.nowServing && <QueueRow item={room.nowServing} serving highlightMe={false} />}
          {room.queue.map((item) => (
            <QueueRow
              key={item.appointmentId}
              item={item}
              serving={false}
              highlightMe={item.appointmentId === me.appointmentId}
            />
          ))}
        </ol>
      </div>

      {!away && spot.awaysLeft > 0 && <AwayButton token={token} awaysLeft={spot.awaysLeft} />}
      <LeaveButton token={token} />

      <p className="mt-auto pt-8 text-center text-xs text-muted-foreground">
        Esta pantalla se actualiza sola.
      </p>
    </div>
  );
}

/** Mensaje final según cómo terminó: no es lo mismo "te atendieron" que "saliste de la fila". */
function OutcomeState({ outcome }: { outcome: MyWaitingSpotDto["outcome"] }) {
  if (outcome === "done") {
    return (
      <BigState
        tone="done"
        icon={<CheckCircle2 className="size-9" />}
        title="¡Listo, fuiste atendido!"
        subtitle="Gracias por venir. ¡Te esperamos la próxima!"
      />
    );
  }
  if (outcome === "left") {
    return (
      <BigState
        tone="neutral"
        icon={<LogOut className="size-9" />}
        title="Saliste de la fila"
        subtitle="Cuando quieras volver, escaneá el QR del local de nuevo."
      />
    );
  }
  if (outcome === "no_show") {
    return (
      <BigState
        tone="neutral"
        icon={<UserX className="size-9" />}
        title="Te marcamos como ausente"
        subtitle="Si fue un error, hablá con el local."
      />
    );
  }
  return (
    <BigState
      tone="neutral"
      icon={<CalendarCheck className="size-9" />}
      title="No estás en la fila"
      subtitle="Si tenés un turno agendado, sigue vigente: avisá en el local cuando llegues."
    />
  );
}

/** "Avisame cuando me toque": notificaciones push, para no tener que mirar la pantalla. */
function PushCard({ spot, token }: { spot: MyWaitingSpotDto; token: string }) {
  const publicKey = usePushPublicKey();
  const subscribe = useSubscribeSpotPush(token);
  const unsubscribe = useUnsubscribeSpotPush(token);
  const [support, setSupport] = useState<ReturnType<typeof pushSupport>>("unsupported");
  const [failed, setFailed] = useState(false);

  useEffect(() => setSupport(pushSupport()), []);

  if (!spot.pushEnabled || !publicKey.data?.enabled) return null;

  if (spot.pushSubscribed) {
    return (
      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-status-serving-foreground/30 bg-status-serving px-4 py-3">
        <Bell className="size-5 shrink-0 text-status-serving-foreground" />
        <p className="flex-1 text-sm text-status-serving-foreground">
          Te vamos a avisar cuando te toque, aunque cierres esta pantalla.
        </p>
        <Button
          variant="ghost"
          size="sm"
          disabled={unsubscribe.isPending}
          onClick={() => {
            void unsubscribeBrowser();
            unsubscribe.mutate();
          }}
        >
          <BellOff className="size-4" />
        </Button>
      </div>
    );
  }

  if (support === "unsupported") {
    return (
      <p className="mt-4 rounded-2xl bg-muted/60 px-4 py-3 text-xs text-muted-foreground">
        Tu navegador no permite avisos. Dejá esta pantalla abierta: se actualiza sola. En iPhone,
        agregala a la pantalla de inicio para poder recibir avisos.
      </p>
    );
  }
  if (support === "denied") {
    return (
      <p className="mt-4 rounded-2xl bg-muted/60 px-4 py-3 text-xs text-muted-foreground">
        Bloqueaste las notificaciones de este sitio. Podés habilitarlas desde el candado de la barra
        de direcciones.
      </p>
    );
  }

  async function enable() {
    setFailed(false);
    try {
      const sub = await subscribeBrowser(publicKey.data!.publicKey);
      subscribe.mutate(sub, { onError: () => setFailed(true) });
    } catch {
      setSupport(pushSupport());
      setFailed(true);
    }
  }

  return (
    <div className="mt-4">
      <Button className="w-full" variant="outline" onClick={enable} disabled={subscribe.isPending}>
        {subscribe.isPending ? <Spinner /> : <BellRing className="size-4" />}
        Avisarme cuando me toque
      </Button>
      {failed && support === "ok" && (
        <p className="mt-1.5 text-center text-xs text-destructive">
          No pudimos activar los avisos. Probá de nuevo.
        </p>
      )}
    </div>
  );
}

/** Ausente: conserva el lugar. Cuenta regresiva y vuelta anticipada. */
function AwayCard({ token, until, ticket }: { token: string; until: string; ticket: number }) {
  const back = useBackToQueue(token);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, new Date(until).getTime() - now);
  const mm = Math.floor(left / 60_000);
  const ss = Math.floor((left % 60_000) / 1000);

  return (
    <div className="rounded-3xl border border-border bg-card p-7 text-center">
      <p className="text-sm text-muted-foreground">Tu turno · #{ticket}</p>
      <p className="mt-1 flex items-center justify-center gap-2 font-display text-xl font-semibold">
        <DoorOpen className="size-5 text-accent" />
        Estás ausente
      </p>
      <p className="mt-3 font-display text-5xl font-semibold tabular-nums text-accent">
        {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Te guardamos el lugar. Volvés a contar a las {formatTime(until)}; mientras tanto el
        profesional atiende a los que siguen.
      </p>
      <Button className="mt-5 w-full" onClick={() => back.mutate()} disabled={back.isPending}>
        {back.isPending ? <Spinner /> : <Hand className="size-4" />}
        Ya volví
      </Button>
    </div>
  );
}

function AwayButton({ token, awaysLeft }: { token: string; awaysLeft: number }) {
  const away = useAwayFromQueue(token);
  return (
    <div className="mt-6">
      <Button
        variant="outline"
        className="w-full"
        onClick={() => away.mutate(10)}
        disabled={away.isPending}
      >
        {away.isPending ? <Spinner /> : <DoorOpen className="size-4" />}
        Me voy y vuelvo (10 min)
      </Button>
      <p className="mt-1.5 text-center text-xs text-muted-foreground">
        Conservás tu número.{" "}
        {awaysLeft === 1 ? "Te queda 1 ausencia." : `Te quedan ${awaysLeft} ausencias.`}
      </p>
      {away.isError && (
        <p className="mt-1 text-center text-xs text-destructive">
          No pudimos registrar tu ausencia. Probá de nuevo.
        </p>
      )}
    </div>
  );
}

/** "Ya no voy", con confirmación: salir hace perder el lugar. */
function LeaveButton({ token }: { token: string }) {
  const leave = useLeaveQueue(token);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="mx-auto mt-6 flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-destructive hover:underline"
      >
        <LogOut className="size-4" />
        Ya no voy
      </button>
    );
  }
  return (
    <div className="mt-6 rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-center">
      <p className="text-sm font-medium">¿Salir de la fila?</p>
      <p className="mt-0.5 text-xs text-muted-foreground">Perdés tu lugar y tu número.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" onClick={() => setConfirming(false)}>
          Me quedo
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="border-destructive/50 text-destructive"
          onClick={() => leave.mutate()}
          disabled={leave.isPending}
        >
          {leave.isPending ? <Spinner /> : <LogOut className="size-4" />}
          Sí, salir
        </Button>
      </div>
      {leave.isError && (
        <p className="mt-2 text-xs text-destructive">No pudimos sacarte de la fila. Probá de nuevo.</p>
      )}
    </div>
  );
}

function QueueRow({
  item,
  serving,
  highlightMe,
}: {
  item: WaitingItemDto;
  serving: boolean;
  highlightMe: boolean;
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-xl border px-3.5 py-2.5",
        serving
          ? "border-status-serving-foreground/30 bg-status-serving"
          : highlightMe
            ? "border-accent bg-accent/10"
            : "border-border bg-card",
        item.awayUntil && !highlightMe && "opacity-60",
      )}
    >
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-lg font-display text-sm font-semibold tabular-nums",
          serving ? "bg-status-serving-foreground/15 text-status-serving-foreground" : "bg-muted",
        )}
      >
        {item.ticketNumber}
      </span>
      <span className="flex-1 text-sm font-medium">
        {item.displayName}
        {highlightMe && <span className="ml-1.5 text-xs text-accent">(vos)</span>}
      </span>
      <span
        className={cn(
          "text-xs",
          serving ? "font-medium text-status-serving-foreground" : "text-muted-foreground",
        )}
      >
        {serving ? "En atención" : item.calledAt ? "Llamado" : item.awayUntil ? "Ausente" : ""}
      </span>
    </li>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-2xl bg-muted/60 p-4">
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">{icon}</span>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function BigState({
  tone,
  icon,
  title,
  subtitle,
  ticket,
}: {
  tone: "serving" | "done" | "pending" | "neutral";
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  ticket?: number;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
      <span
        className={cn(
          "grid size-20 place-items-center rounded-full",
          tone === "serving"
            ? "bg-status-serving text-status-serving-foreground"
            : tone === "done"
              ? "bg-status-done text-status-done-foreground"
              : "bg-muted text-muted-foreground",
        )}
      >
        {icon}
      </span>
      {ticket != null && (
        <p className="mt-5 font-display text-5xl font-semibold tabular-nums text-accent">
          #{ticket}
        </p>
      )}
      <h1 className="mt-4 font-display text-2xl font-semibold">{title}</h1>
      <p className="mt-2 max-w-xs text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function ConnectionPill({ state }: { state: ConnectionState }) {
  const map: Record<ConnectionState, { label: string; live: boolean }> = {
    connecting: { label: "Conectando…", live: false },
    live: { label: "En vivo", live: true },
    polling: { label: "En vivo", live: true },
    offline: { label: "Sin conexión", live: false },
  };
  const { label, live } = map[state];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        live
          ? "border-status-serving-foreground/30 text-status-serving-foreground"
          : "border-border text-muted-foreground",
      )}
    >
      {live ? (
        <>
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60" />
            <span className="relative inline-flex size-1.5 rounded-full bg-current" />
          </span>
          {label}
        </>
      ) : state === "offline" ? (
        <>
          <WifiOff className="size-3.5" />
          {label}
        </>
      ) : (
        <>
          <Wifi className="size-3.5" />
          {label}
        </>
      )}
    </span>
  );
}

function SpotSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-52 w-full rounded-3xl" />
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
