"use client";

import { useState } from "react";
import {
  ChevronRight,
  Check,
  UserX,
  PlayCircle,
  Coffee,
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/state-views";
import { AppointmentStatusBadge } from "@/components/appointment-status-badge";
import { useProfessionalsListStaff } from "@/lib/api/generated/endpoints/professionals/professionals";
import {
  useAppointmentsStart,
  useAppointmentsComplete,
  useAppointmentsNoShow,
} from "@/lib/api/generated/endpoints/appointments/appointments";
import { useWaitingRoom, type ConnectionState } from "@/lib/realtime/use-waiting-room";
import { AppointmentStatus } from "@/lib/api/generated/model/appointmentStatus";
import { formatTime, titleCaseName } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Staff } from "@/lib/api/generated/model/staff";
import type { WaitingItem } from "@/mocks/contract-extensions";

export function StaffWaitingRoomControl() {
  const staffQuery = useProfessionalsListStaff();
  const staffList = (staffQuery.data ?? []).filter((s: Staff) => s.isActive);
  const [activeStaffId, setActiveStaffId] = useState<string | null>(null);
  const staffId = activeStaffId ?? staffList[0]?.id ?? "";

  return (
    <div className="mx-auto max-w-4xl px-5 py-6 sm:px-8">
      <header className="py-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Sala de espera
        </h1>
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

          {staffId && <RoomBoard staffId={staffId} />}
        </>
      )}
    </div>
  );
}

function RoomBoard({ staffId }: { staffId: string }) {
  const { room, isLoading, isError, refetch, connection, invalidate } =
    useWaitingRoom(staffId);

  const start = useAppointmentsStart();
  const complete = useAppointmentsComplete();
  const noShow = useAppointmentsNoShow();
  const busy = start.isPending || complete.isPending || noShow.isPending;

  function act(mutate: { mutate: (v: { id: string }, o: object) => void }, id: string) {
    mutate.mutate({ id }, { onSuccess: () => invalidate() });
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
  const next = room.queue[0] ?? null;

  return (
    <div className="mt-5">
      <div className="mb-4 flex items-center justify-between">
        <ConnectionPill state={connection} />
        <span className="text-sm text-muted-foreground">
          {room.queue.length} en espera
        </span>
      </div>

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
              <p className="text-sm text-status-serving-foreground/80">{titleCaseName(serving.serviceName)}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button onClick={() => act(complete, serving.appointmentId)} disabled={busy}>
              {complete.isPending ? <Spinner /> : <Check className="size-4" />}
              Terminé
            </Button>
            <Button
              variant="outline"
              onClick={() => act(noShow, serving.appointmentId)}
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
            {next ? "Llamá al siguiente para empezar." : "La cola está vacía."}
          </p>
        </div>
      )}

      {/* Llamar al siguiente */}
      {next && (
        <Button
          size="lg"
          className="mt-4 w-full"
          onClick={() => act(start, next.appointmentId)}
          disabled={busy || !!serving}
          title={serving ? "Terminá el turno actual primero" : undefined}
        >
          {start.isPending ? <Spinner /> : <PlayCircle className="size-5" />}
          Llamar al siguiente · #{next.ticketNumber} {next.displayName}
        </Button>
      )}

      {/* Cola */}
      <div className="mt-8">
        <h2 className="mb-3 font-display text-sm font-semibold text-muted-foreground">
          Próximos
        </h2>
        {room.queue.length === 0 ? (
          <EmptyState
            title="Sin turnos en cola"
            message="Cuando lleguen reservas del día, aparecen acá."
          />
        ) : (
          <ol className="space-y-2">
            {room.queue.map((item, i) => (
              <QueueRow key={item.appointmentId} item={item} isNext={i === 0 && !serving} />
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function QueueRow({ item, isNext }: { item: WaitingItem; isNext: boolean }) {
  const provisional = item.status === AppointmentStatus.requested;
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-xl border bg-card px-3.5 py-3",
        isNext ? "border-accent/50" : "border-border",
      )}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted font-display text-sm font-semibold tabular-nums">
        {item.ticketNumber}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.displayName}</p>
        <p className="truncate text-xs text-muted-foreground">
          {formatTime(item.startAt)} · {titleCaseName(item.serviceName)}
        </p>
      </div>
      <AppointmentStatusBadge status={item.status} isProvisional={provisional} />
      {isNext && <ChevronRight className="size-4 text-accent" />}
    </li>
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
