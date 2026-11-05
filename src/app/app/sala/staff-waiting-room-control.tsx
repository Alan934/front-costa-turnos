"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  UserX,
  PlayCircle,
  Coffee,
  Wifi,
  UserPlus,
  Clock3,
  X,
  QrCode,
  Pause,
  Play,
  Power,
  Footprints,
  BellRing,
  Bell,
  BellOff,
  ArrowUp,
  ArrowDown,
  Siren,
  SkipForward,
  Hourglass,
  Wallet,
  CalendarClock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/state-views";
import { QrCard } from "@/components/qr-card";
import { ChargeDialog } from "@/components/charge-dialog";
import { PUBLIC_HOST } from "@/components/public-page-link";
import { useActiveComercio } from "@/components/comercio-context";
import { useMyMemberships, useUpdateMyMembership } from "@/lib/api/comercios";
import { useServices } from "@/lib/api/catalog";
import { usePushPublicKey, useSubscribeProPush } from "@/lib/api/sala";
import { currentEndpoint, pushSupport, subscribeBrowser } from "@/lib/push";
import { useProfessionalsListStaff } from "@/lib/api/generated/endpoints/professionals/professionals";
import {
  useAppointmentsStart,
  useAppointmentsComplete,
  useAppointmentsNoShow,
  useAppointmentsConfirm,
  useAppointmentsCancel,
  useAppointmentsUndoCheckIn,
  useAppointmentsCall,
  useAppointmentsSendToBack,
  useAppointmentsMove,
  useAppointmentsPriority,
} from "@/lib/api/generated/endpoints/appointments/appointments";
import { useWaitingRoom, type ConnectionState } from "@/lib/realtime/use-waiting-room";
import { WaitingRoomStatus } from "@/lib/api/generated/model/waitingRoomStatus";
import { formatWalkInWindows } from "@/lib/attendance";
import { formatTime, titleCaseName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AddToQueueDialog } from "./add-to-queue-dialog";
import { StatsPanel } from "./stats-panel";
import type { Staff } from "@/lib/api/generated/model/staff";
import type { WaitingItemDto } from "@/lib/api/generated/model/waitingItemDto";
import type { WaitingRoomDto } from "@/lib/api/generated/model/waitingRoomDto";

/** Hora actual que se refresca sola: para "llamado hace 2 min" sin recargar. */
function useNow(everyMs = 15_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}

function minutesSince(iso: string | null | undefined, now: number): number {
  return iso ? Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000)) : 0;
}

export function StaffWaitingRoomControl() {
  const staffQuery = useProfessionalsListStaff();
  const staffList = (staffQuery.data ?? []).filter((s: Staff) => s.isActive);
  const [activeStaffId, setActiveStaffId] = useState<string | null>(null);
  const staffId = activeStaffId ?? staffList[0]?.id ?? "";

  // La sala se configura por comercio: cada local tiene su pantalla y su QR.
  const { active } = useActiveComercio();
  const memberships = useMyMemberships();
  const membership = (memberships.data ?? []).find((m) => m.comercioId === active?.comercioId);

  return (
    <div className="mx-auto max-w-4xl px-5 py-6 sm:px-8">
      <header className="py-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Sala de espera</h1>
        <p className="text-sm text-muted-foreground">Control de la cola en vivo</p>
      </header>

      {staffQuery.isLoading && <Skeleton className="h-10 w-48 rounded-full" />}
      {staffQuery.isError && (
        <ErrorState message="No pudimos cargar tu equipo." onRetry={() => staffQuery.refetch()} />
      )}

      {staffList.length > 0 && (
        <>
          {staffList.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {staffList.map((s: Staff) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveStaffId(s.id)}
                  className={cn(
                    "shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                    s.id === staffId
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border text-muted-foreground hover:border-accent/50",
                  )}
                >
                  {titleCaseName(s.displayName)}
                </button>
              ))}
            </div>
          )}

          {staffId && (
            <RoomBoard
              staffId={staffId}
              membershipId={membership?.id}
              comercioId={active?.comercioId}
              comercioSlug={membership?.comercio?.slug}
            />
          )}
        </>
      )}
    </div>
  );
}

function RoomBoard({
  staffId,
  membershipId,
  comercioId,
  comercioSlug,
}: {
  staffId: string;
  membershipId?: string;
  comercioId?: string;
  comercioSlug?: string;
}) {
  const { room, isLoading, isError, refetch, connection, invalidate } = useWaitingRoom(staffId, {
    membershipId,
  });
  const [adding, setAdding] = useState(false);
  const [showQr, setShowQr] = useState(false);
  // Turno que se está cobrando (se abre solo al terminar una atención).
  const [charging, setCharging] = useState<{ id: string; name: string } | null>(null);
  const now = useNow();

  const servicesQuery = useServices();
  // El walk-in se crea en el comercio activo: solo sus servicios activos.
  const services = useMemo(
    () =>
      (servicesQuery.data ?? []).filter(
        (s) => s.isActive && (!comercioId || s.comercioId === comercioId),
      ),
    [servicesQuery.data, comercioId],
  );

  const start = useAppointmentsStart();
  const complete = useAppointmentsComplete();
  const noShow = useAppointmentsNoShow();
  const confirm = useAppointmentsConfirm();
  const cancel = useAppointmentsCancel();
  const undoCheckIn = useAppointmentsUndoCheckIn();
  const call = useAppointmentsCall();
  const sendToBack = useAppointmentsSendToBack();
  const move = useAppointmentsMove();
  const priority = useAppointmentsPriority();
  const busy = [start, complete, noShow, confirm, cancel, undoCheckIn, call, sendToBack, move, priority].some(
    (m) => m.isPending,
  );

  const done = { onSuccess: () => invalidate() };

  // Al terminar se abre el cobro: es el momento natural de cobrar. El cierre sin cobro de la
  // versión anterior sigue disponible ("Cobrar después"); lo pendiente queda en el cierre de caja.
  function doComplete(id: string, name: string) {
    complete.mutate(
      { id, data: {} },
      {
        onSuccess: () => {
          invalidate();
          setCharging({ id, name });
        },
      },
    );
  }

  if (isLoading) {
    return (
      <div className="mt-6 space-y-4">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }
  if (isError || !room) {
    return (
      <div className="mt-6">
        <ErrorState message="No pudimos cargar la sala." onRetry={() => refetch()} />
      </div>
    );
  }

  const serving = room.nowServing;
  const isAway = (i: WaitingItemDto) => !!i.awayUntil;
  // "Al siguiente" salta a los ausentes ("me voy y vuelvo") y a los que ya fueron llamados.
  const next = room.queue.find((i) => !isAway(i) && !i.calledAt) ?? null;
  const called = room.queue.filter((i) => i.calledAt && !isAway(i));
  const publicUrl = comercioSlug ? `https://${PUBLIC_HOST}/r/${comercioSlug}/sala` : null;

  return (
    <div className="mt-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <ConnectionPill state={connection} />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">{room.queue.length} en espera</span>
          <ProPushButton />
          {publicUrl && (
            <Button variant="outline" size="sm" onClick={() => setShowQr((v) => !v)}>
              <QrCode className="size-4" />
              QR
            </Button>
          )}
          <Button size="sm" onClick={() => setAdding(true)}>
            <UserPlus className="size-4" />
            Agregar
          </Button>
        </div>
      </div>

      {membershipId && comercioId && (
        <RoomStatusBar room={room} comercioId={comercioId} onChanged={() => invalidate()} />
      )}

      <AttendanceInfo room={room} />

      {showQr && publicUrl && (
        <QrCard
          className="mb-4"
          url={publicUrl}
          title="Pantalla pública de la sala"
          hint="Imprimí este QR y colgalo en el local: quien lo escanee ve la fila en vivo y cuántos tiene delante."
        />
      )}

      {/* Self check-in esperando aprobación */}
      {room.pending.length > 0 && (
        <div className="mb-4 rounded-2xl border border-accent/40 bg-accent/5 p-4">
          <p className="font-display text-sm font-semibold">
            {room.pending.length === 1
              ? "1 persona se anotó desde su celular"
              : `${room.pending.length} personas se anotaron desde su celular`}
          </p>
          <p className="text-xs text-muted-foreground">
            Aceptalas para que entren a la fila, o descartalas.
          </p>
          <ul className="mt-3 space-y-2">
            {room.pending.map((item) => (
              <li
                key={item.appointmentId}
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {titleCaseName(item.serviceName)} · llegó {formatTime(item.checkedInAt)}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => confirm.mutate({ id: item.appointmentId }, done)}
                  disabled={busy}
                >
                  <Check className="size-4" />
                  Aceptar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => cancel.mutate({ id: item.appointmentId, data: {} }, done)}
                  disabled={busy}
                  aria-label="Descartar"
                >
                  <X className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Turno en atención */}
      {serving ? (
        <div className="rounded-2xl border border-status-serving-foreground/30 bg-status-serving p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-status-serving-foreground">
                Atendiendo ahora
              </p>
              <p className="mt-1 font-display text-2xl font-semibold">
                <span className="text-status-serving-foreground">#{serving.ticketNumber}</span>{" "}
                {serving.displayName}
              </p>
              <p className="text-sm text-status-serving-foreground/80">
                {titleCaseName(serving.serviceName)}
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button
              onClick={() => doComplete(serving.appointmentId, serving.displayName)}
              disabled={busy}
            >
              {complete.isPending ? <Spinner /> : <Check className="size-4" />}
              Terminé y cobrar
            </Button>
            <Button
              variant="outline"
              onClick={() => noShow.mutate({ id: serving.appointmentId }, done)}
              disabled={busy}
            >
              <UserX className="size-4" />
              No vino
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center">
          <Coffee className="mx-auto size-7 text-muted-foreground" />
          <p className="mt-2 font-display font-semibold">Nadie en atención</p>
          <p className="text-sm text-muted-foreground">
            {next || called.length > 0 ? "Llamá al siguiente para empezar." : "La cola está vacía."}
          </p>
        </div>
      )}

      {/* Llamados: esperando que se acerquen */}
      {called.map((item) => (
        <CalledPanel
          key={item.appointmentId}
          item={item}
          now={now}
          busy={busy}
          canStart={!serving}
          onStart={() => start.mutate({ id: item.appointmentId }, done)}
          onCallAgain={() => call.mutate({ id: item.appointmentId }, done)}
          onToBack={() => sendToBack.mutate({ id: item.appointmentId }, done)}
          onNoShow={() => noShow.mutate({ id: item.appointmentId }, done)}
        />
      ))}

      {/* Llamar al siguiente: avisa por push y por pantalla, y lo deja "llamado" */}
      {next && (
        <Button
          size="lg"
          className="mt-4 w-full"
          onClick={() => call.mutate({ id: next.appointmentId }, done)}
          disabled={busy}
        >
          {call.isPending ? <Spinner /> : <BellRing className="size-5" />}
          Llamar al siguiente · #{next.ticketNumber} {next.displayName}
        </Button>
      )}

      {/* Cola */}
      <div className="mt-8">
        <h2 className="mb-3 font-display text-sm font-semibold text-muted-foreground">Próximos</h2>
        {room.queue.length === 0 ? (
          <EmptyState
            title="La fila está vacía"
            message="Agregá a quien llegue sin turno, o marcá la llegada de un turno agendado desde la agenda."
          />
        ) : (
          <ol className="space-y-2">
            {room.queue.map((item, i) => (
              <QueueRow
                key={item.appointmentId}
                item={item}
                isFirst={i === 0}
                isLast={i === room.queue.length - 1}
                busy={busy}
                canServe={!serving}
                onCall={() => call.mutate({ id: item.appointmentId }, done)}
                onServe={() => start.mutate({ id: item.appointmentId }, done)}
                onMove={(direction) =>
                  move.mutate({ id: item.appointmentId, data: { direction } }, done)
                }
                onPriority={() =>
                  priority.mutate(
                    { id: item.appointmentId, data: { priority: !item.isPriority } },
                    done,
                  )
                }
                onRemove={() => undoCheckIn.mutate({ id: item.appointmentId }, done)}
              />
            ))}
          </ol>
        )}
      </div>

      <StatsPanel staffId={staffId} />

      {adding && (
        <AddToQueueDialog
          staffId={staffId}
          services={services}
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
            invalidate();
          }}
        />
      )}

      {charging && (
        <ChargeDialog
          appointmentId={charging.id}
          clientName={charging.name}
          onClose={() => setCharging(null)}
        />
      )}
    </div>
  );
}

/**
 * Resumen de cuándo se atiende por orden de llegada y acceso a configurarlo en Horarios. Si no hay
 * franjas por llegada, lo deja a mano igual: es donde se elige "todo el día", "solo estas horas"
 * o "siempre".
 */
function AttendanceInfo({ room }: { room: WaitingRoomDto }) {
  const a = room.attendance;
  const lines = formatWalkInWindows(a.windows);
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border px-4 py-2.5 text-xs text-muted-foreground">
      <CalendarClock className="size-4 shrink-0 text-accent" />
      <span className="min-w-0 flex-1">
        {a.walkInOnly ? (
          <>
            <span className="font-medium text-foreground">Siempre por orden de llegada.</span>{" "}
            {lines.length > 0 ? lines.join(" · ") : "Sin horario: abierto todo el tiempo."}
          </>
        ) : a.hasSchedule ? (
          <>
            <span className="font-medium text-foreground">
              {a.openNow ? "Ahora: por orden de llegada." : "Ahora: con turno."}
            </span>{" "}
            Por llegada: {lines.join(" · ")}
          </>
        ) : (
          "Atendés con turno. Podés definir días u horas por orden de llegada."
        )}
      </span>
      <Link href="/app/horarios" className="font-medium text-accent hover:underline">
        Horarios
      </Link>
    </div>
  );
}

/**
 * Alguien a quien ya se llamó y todavía no se acercó. En lugar de decidir "no vino" de golpe,
 * el profesional puede llamarlo de nuevo, mandarlo al final de la fila o recién ahí darlo por ausente.
 */
function CalledPanel({
  item,
  now,
  busy,
  canStart,
  onStart,
  onCallAgain,
  onToBack,
  onNoShow,
}: {
  item: WaitingItemDto;
  now: number;
  busy: boolean;
  canStart: boolean;
  onStart: () => void;
  onCallAgain: () => void;
  onToBack: () => void;
  onNoShow: () => void;
}) {
  const mins = minutesSince(item.calledAt, now);
  return (
    <div className="mt-3 rounded-2xl border border-accent/50 bg-accent/5 p-4">
      <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-accent">
        <BellRing className="size-3.5" />
        Llamado {mins < 1 ? "recién" : `hace ${mins} min`}
        {item.callCount > 1 ? ` · ${item.callCount} veces` : ""}
      </p>
      <p className="mt-1 font-display text-xl font-semibold">
        #{item.ticketNumber} {item.displayName}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Button
          size="sm"
          onClick={onStart}
          disabled={busy || !canStart}
          title={canStart ? undefined : "Terminá la atención actual primero"}
        >
          <PlayCircle className="size-4" />
          Atender
        </Button>
        <Button variant="outline" size="sm" onClick={onCallAgain} disabled={busy}>
          <BellRing className="size-4" />
          Llamar de nuevo
        </Button>
        <Button variant="outline" size="sm" onClick={onToBack} disabled={busy}>
          <SkipForward className="size-4" />
          Al final
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive"
          onClick={onNoShow}
          disabled={busy}
        >
          <UserX className="size-4" />
          No vino
        </Button>
      </div>
    </div>
  );
}

/** Aviso al profesional (web push) cuando alguien se anota por QR: nadie mira la pantalla con la fila llena. */
function ProPushButton() {
  const publicKey = usePushPublicKey();
  const subscribe = useSubscribeProPush();
  const [on, setOn] = useState(false);
  const [support, setSupport] = useState<ReturnType<typeof pushSupport>>("unsupported");

  useEffect(() => {
    setSupport(pushSupport());
    void currentEndpoint().then((ep) => setOn(!!ep && Notification.permission === "granted"));
  }, []);

  if (!publicKey.data?.enabled || support === "unsupported") return null;

  async function enable() {
    try {
      const sub = await subscribeBrowser(publicKey.data!.publicKey);
      subscribe.mutate(sub, { onSuccess: () => setOn(true) });
    } catch {
      setSupport(pushSupport());
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={enable}
      disabled={on || support === "denied" || subscribe.isPending}
      title={
        support === "denied"
          ? "Bloqueaste las notificaciones en el navegador"
          : on
            ? "Te avisamos cuando alguien se anote"
            : "Avisarme cuando alguien se anote desde su celular"
      }
    >
      {on ? <Bell className="size-4" /> : <BellOff className="size-4" />}
      {on ? "Avisos activos" : "Activar avisos"}
    </Button>
  );
}

/**
 * Estado que ve el cliente en la pantalla pública (abierto / en pausa / cerrado)
 * y el interruptor del self check-in por QR.
 */
function RoomStatusBar({
  room,
  comercioId,
  onChanged,
}: {
  room: WaitingRoomDto;
  comercioId: string;
  onChanged: () => void;
}) {
  const update = useUpdateMyMembership(comercioId);

  const options: { value: WaitingRoomStatus; label: string; icon: typeof Play }[] = [
    { value: WaitingRoomStatus.open, label: "Abierto", icon: Play },
    { value: WaitingRoomStatus.paused, label: "En pausa", icon: Pause },
    { value: WaitingRoomStatus.closed, label: "Cerrado", icon: Power },
  ];

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
      <div className="flex gap-1.5">
        {options.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            disabled={update.isPending}
            onClick={() => update.mutate({ waitingRoomStatus: value }, { onSuccess: onChanged })}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              room.status === value
                ? "border-accent bg-accent/10 text-accent"
                : "border-border text-muted-foreground hover:border-accent/50",
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
      </div>

      <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          className="size-4 accent-[var(--accent)]"
          checked={room.selfCheckInEnabled}
          disabled={update.isPending}
          onChange={(e) =>
            update.mutate({ waitingRoomSelfCheckIn: e.target.checked }, { onSuccess: onChanged })
          }
        />
        Dejar que se anoten con el QR
      </label>
    </div>
  );
}

function QueueRow({
  item,
  isFirst,
  isLast,
  busy,
  canServe,
  onCall,
  onServe,
  onMove,
  onPriority,
  onRemove,
}: {
  item: WaitingItemDto;
  isFirst: boolean;
  isLast: boolean;
  busy: boolean;
  canServe: boolean;
  onCall: () => void;
  onServe: () => void;
  onMove: (direction: "up" | "down") => void;
  onPriority: () => void;
  onRemove: () => void;
}) {
  const away = !!item.awayUntil;
  return (
    <li
      className={cn(
        "rounded-xl border bg-card px-3.5 py-3",
        item.calledAt ? "border-accent/60" : item.isPriority ? "border-warning/60" : "border-border",
        away && "opacity-70",
      )}
    >
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted font-display text-sm font-semibold tabular-nums">
          {item.ticketNumber}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
            <span className="truncate">{item.displayName}</span>
            {item.isPriority && <Badge icon={Siren} tone="warning">urgente</Badge>}
            {item.isWalkIn && <Badge icon={Footprints}>sin turno</Badge>}
            {item.calledAt && <Badge icon={BellRing} tone="accent">llamado</Badge>}
            {away && item.awayUntil && (
              <Badge icon={Hourglass}>vuelve {formatTime(item.awayUntil)}</Badge>
            )}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {titleCaseName(item.serviceName)} · llegó {formatTime(item.checkedInAt ?? item.startAt)}{" "}
            ·{" "}
            <span title={item.etaLearned ? "Calculado con tus tiempos reales" : "Duración configurada"}>
              <Clock3 className="inline size-3" /> {item.etaLearned ? "" : "≈"}
              {item.etaMinutes}′
            </span>
          </p>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pl-12">
        <Button
          size="sm"
          onClick={onCall}
          disabled={busy}
          title="Avisarle que le toca (notificación en su celular)"
        >
          <BellRing className="size-4" />
          {item.calledAt ? "Llamar de nuevo" : "Llamar"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onServe}
          disabled={busy || !canServe}
          title={canServe ? "Atender ahora, sin llamarlo" : "Terminá la atención actual primero"}
        >
          <PlayCircle className="size-4" />
          Atender
        </Button>
        <span className="mx-1 h-5 w-px bg-border" />
        <IconBtn label="Subir un lugar" onClick={() => onMove("up")} disabled={busy || isFirst}>
          <ArrowUp className="size-4" />
        </IconBtn>
        <IconBtn label="Bajar un lugar" onClick={() => onMove("down")} disabled={busy || isLast}>
          <ArrowDown className="size-4" />
        </IconBtn>
        <IconBtn
          label={item.isPriority ? "Quitar urgencia" : "Marcar como urgente (pasa al frente)"}
          onClick={onPriority}
          disabled={busy}
          active={item.isPriority}
        >
          <Siren className="size-4" />
        </IconBtn>
        <IconBtn
          label="Sacar de la fila (el turno se conserva)"
          onClick={onRemove}
          disabled={busy}
          danger
        >
          <X className="size-4" />
        </IconBtn>
      </div>
    </li>
  );
}

function IconBtn({
  label,
  onClick,
  disabled,
  active,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cn(
        "size-8 p-0",
        active && "bg-warning/15 text-warning-foreground",
        danger && "text-destructive hover:bg-destructive/10",
      )}
    >
      {children}
    </Button>
  );
}

function Badge({
  icon: Icon,
  tone,
  children,
}: {
  icon: typeof Wallet;
  tone?: "accent" | "warning";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
        tone === "accent"
          ? "bg-accent/15 text-accent"
          : tone === "warning"
            ? "bg-warning/15 text-warning-foreground"
            : "bg-muted text-muted-foreground",
      )}
    >
      <Icon className="size-3" />
      {children}
    </span>
  );
}

function ConnectionPill({ state }: { state: ConnectionState }) {
  const live = state === "live" || state === "polling";
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
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60" />
          <span className="relative inline-flex size-1.5 rounded-full bg-current" />
        </span>
      ) : (
        <Wifi className="size-3.5" />
      )}
      {state === "connecting" ? "Conectando…" : "En vivo"}
    </span>
  );
}
