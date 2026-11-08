"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  Volume2,
  MessageCircle,
  ArrowUp,
  ArrowDown,
  Siren,
  SkipForward,
  Hourglass,
  Wallet,
  CalendarClock,
  Tag,
  Settings,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { getApiErrorMessage } from "@/lib/api/error-message";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/state-views";
import { QrCard } from "@/components/qr-card";
import { ChargeDialog } from "@/components/charge-dialog";
import { AssignServiceDialog } from "@/components/assign-service-dialog";
import { DelayNotice } from "@/components/delay-notice";
import { PUBLIC_HOST } from "@/components/public-page-link";
import { useActiveComercio } from "@/components/comercio-context";
import { useMyMemberships, useUpdateMyMembership } from "@/lib/api/comercios";
import { useServices } from "@/lib/api/catalog";
import { usePushPublicKey, useSubscribeProPush } from "@/lib/api/sala";
import { currentEndpoint, pushSupport, subscribeBrowser } from "@/lib/push";
import { armAttention, beep, isAttentionArmed } from "@/lib/attention";
import {
  DEFAULT_WAITING_MESSAGES,
  peopleLabel,
  renderWhatsAppMessage,
  whatsAppLink,
} from "@/lib/whatsapp";
import { useProfessional } from "@/lib/api/professional";
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
  useAppointmentsGet,
} from "@/lib/api/generated/endpoints/appointments/appointments";
import {
  useWaitingRoom,
  type ConnectionState,
} from "@/lib/realtime/use-waiting-room";
import { WaitingRoomStatus } from "@/lib/api/generated/model/waitingRoomStatus";
import { formatWalkInWindows } from "@/lib/attendance";
import { formatTime, titleCaseName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AddToQueueDialog } from "./add-to-queue-dialog";
import { StatsPanel } from "./stats-panel";
import { WhatsAppMessagesEditor } from "./whatsapp-messages-editor";
import { useBackLayer } from "@/lib/use-back-layer";
import type { WaitingRoomWhatsappMessagesDto } from "@/lib/api/generated/model/waitingRoomWhatsappMessagesDto";
import type { Staff } from "@/lib/api/generated/model/staff";
import type { WaitingItemDto } from "@/lib/api/generated/model/waitingItemDto";
import type { WaitingRoomDto } from "@/lib/api/generated/model/waitingRoomDto";

/**
 * Mensajes de WhatsApp del profesional y su teléfono, para armar el aviso a cada cliente. Llegan por
 * contexto porque el botón de WhatsApp está varios niveles abajo (panel de llamados y cada fila).
 */
const WhatsAppConfigContext = createContext<{
  messages: WaitingRoomWhatsappMessagesDto | null | undefined;
  phone: string;
}>({ messages: null, phone: "" });

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
  return iso
    ? Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000))
    : 0;
}

export function StaffWaitingRoomControl() {
  const staffQuery = useProfessionalsListStaff();
  const staffList = (staffQuery.data ?? []).filter((s: Staff) => s.isActive);
  const [activeStaffId, setActiveStaffId] = useState<string | null>(null);
  const staffId = activeStaffId ?? staffList[0]?.id ?? "";

  // La sala se configura por comercio: cada local tiene su pantalla y su QR.
  const { active } = useActiveComercio();
  const memberships = useMyMemberships();
  const membership = (memberships.data ?? []).find(
    (m) => m.comercioId === active?.comercioId,
  );

  return (
    <div className="mx-auto max-w-4xl px-5 py-6 sm:px-8">
      <header className="py-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Sala de espera
        </h1>
        <p className="text-sm text-muted-foreground">
          Control de la cola en vivo
        </p>
      </header>

      {staffQuery.isLoading && <Skeleton className="h-10 w-48 rounded-full" />}
      {staffQuery.isError && (
        <ErrorState
          message="No pudimos cargar tu equipo."
          onRetry={() => staffQuery.refetch()}
        />
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
              whatsappMessages={membership?.waitingRoomWhatsappMessages}
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
  whatsappMessages,
}: {
  staffId: string;
  membershipId?: string;
  comercioId?: string;
  comercioSlug?: string;
  whatsappMessages?: WaitingRoomWhatsappMessagesDto | null;
}) {
  const { room, isLoading, isError, refetch, connection, invalidate } =
    useWaitingRoom(staffId, {
      membershipId,
    });
  // El teléfono del profesional vive en su página pública (`publicPageSettings.phone`).
  const professional = useProfessional();
  const publicPageSettings = (professional.data?.publicPageSettings ??
    {}) as Record<string, unknown>;
  const phone =
    typeof publicPageSettings.phone === "string"
      ? publicPageSettings.phone
      : "";
  const whatsappConfig = useMemo(
    () => ({ messages: whatsappMessages, phone }),
    [whatsappMessages, phone],
  );
  const [adding, setAdding] = useState(false);
  const [showQr, setShowQr] = useState(false);
  // Turno que se está cobrando (se abre solo al terminar una atención).
  const [charging, setCharging] = useState<{ id: string; name: string } | null>(
    null,
  );
  // Entrada a la que hay que ponerle servicio (se anotó sin elegir). `thenComplete`: venía de
  // "Terminé y cobrar", así que al confirmar sigue con el cierre y el cobro.
  const [assigning, setAssigning] = useState<{
    id: string;
    name: string;
    thenComplete: boolean;
  } | null>(null);
  const now = useNow();

  // Aviso sonoro cuando entra alguien nuevo por QR: sirve aunque las notificaciones del
  // navegador estén bloqueadas (si el audio no se activó, simplemente no suena).
  const pendingCount = room?.pending.length ?? 0;
  const prevPending = useRef<number | null>(null);
  useEffect(() => {
    if (
      room &&
      prevPending.current !== null &&
      pendingCount > prevPending.current
    )
      beep();
    prevPending.current = room ? pendingCount : null;
  }, [room, pendingCount]);

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
  const busy = [
    start,
    complete,
    noShow,
    confirm,
    cancel,
    undoCheckIn,
    call,
    sendToBack,
    move,
    priority,
  ].some((m) => m.isPending);

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
        <ErrorState
          message="No pudimos cargar la sala."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const serving = room.nowServing;
  const isAway = (i: WaitingItemDto) => !!i.awayUntil;
  // "Al siguiente" salta a los ausentes ("me voy y vuelvo") y a los que ya fueron llamados.
  const next = room.queue.find((i) => !isAway(i) && !i.calledAt) ?? null;
  const called = room.queue.filter((i) => i.calledAt && !isAway(i));
  const publicUrl = comercioSlug
    ? `https://${PUBLIC_HOST}/r/${comercioSlug}/sala`
    : null;

  return (
    <WhatsAppConfigContext.Provider value={whatsappConfig}>
      <div className="mt-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <ConnectionPill state={connection} />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {room.queue.length} en espera
            </span>
            <ProPushButton />
            {publicUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowQr((v) => !v)}
              >
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
          <RoomStatusBar
            room={room}
            comercioId={comercioId}
            whatsappMessages={whatsappMessages}
            publicPageSettings={publicPageSettings}
            onChanged={() => invalidate()}
          />
        )}

        <AttendanceInfo room={room} />

        <DelayNotice
          minutes={room.delayMinutes}
          audience="pro"
          className="mb-4"
        />

        {showQr && publicUrl && (
          <QrCard
            className="mb-4"
            url={publicUrl}
            title="Pantalla pública de la sala"
            hint="Imprimí este QR y colgalo en el local: quien lo escanee ve la fila en vivo y cuántos tiene delante."
            printTitle="Sala de espera"
            printSteps={
              room.selfCheckInEnabled
                ? [
                    "Abrí la cámara de tu celular y apuntá al código QR.",
                    "Tocá el aviso o el link que aparece en pantalla.",
                    room.selfCheckInAskService
                      ? "Tocá «Anotarme en la fila», elegí qué venís a hacerte y poné tu nombre y teléfono."
                      : "Tocá «Anotarme en la fila» y poné tu nombre y teléfono.",
                    room.selfCheckInAutoAccept
                      ? "Listo: ya estás en la fila. Vas a ver tu número y cuántas personas tenés adelante."
                      : "Esperá a que el local confirme tu llegada. Vas a ver tu número y cuántas personas tenés adelante.",
                    "Cuando te llamen, pasá. Podés dejar el celular a mano: la pantalla se actualiza sola.",
                  ]
                : [
                    "Abrí la cámara de tu celular y apuntá al código QR.",
                    "Tocá el aviso o el link que aparece en pantalla.",
                    "Mirá quién está siendo atendido y cuántas personas esperan.",
                    "Cuando sea tu turno, el local te va a llamar.",
                  ]
            }
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
                    <p className="truncate text-sm font-medium">
                      {item.displayName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {titleCaseName(item.serviceName)} · llegó{" "}
                      {formatTime(item.checkedInAt)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() =>
                      confirm.mutate({ id: item.appointmentId }, done)
                    }
                    disabled={busy}
                  >
                    <Check className="size-4" />
                    Aceptar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() =>
                      cancel.mutate({ id: item.appointmentId, data: {} }, done)
                    }
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
                  <span className="text-status-serving-foreground">
                    #{serving.ticketNumber}
                  </span>{" "}
                  {serving.displayName}
                </p>
                <p className="text-sm text-status-serving-foreground/80">
                  {titleCaseName(serving.serviceName)}
                  {!serving.serviceId && (
                    <button
                      type="button"
                      className="ml-2 font-medium underline underline-offset-2"
                      onClick={() =>
                        setAssigning({
                          id: serving.appointmentId,
                          name: serving.displayName,
                          thenComplete: false,
                        })
                      }
                    >
                      Elegir servicio
                    </button>
                  )}
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button
                onClick={() =>
                  // Sin servicio no hay precio que cobrar: se pide justo antes de cerrar.
                  serving.serviceId
                    ? doComplete(serving.appointmentId, serving.displayName)
                    : setAssigning({
                        id: serving.appointmentId,
                        name: serving.displayName,
                        thenComplete: true,
                      })
                }
                disabled={busy}
              >
                {complete.isPending ? (
                  <Spinner />
                ) : (
                  <Check className="size-4" />
                )}
                Terminé y cobrar
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  noShow.mutate({ id: serving.appointmentId }, done)
                }
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
              {next || called.length > 0
                ? "Llamá al siguiente para empezar."
                : "La cola está vacía."}
            </p>
          </div>
        )}

        {/* Llamados: esperando que se acerquen */}
        {called.map((item) => (
          <CalledPanel
            key={item.appointmentId}
            item={item}
            now={now}
            staffName={room.staffName}
            busy={busy}
            canStart={!serving}
            onStart={() => start.mutate({ id: item.appointmentId }, done)}
            onCallAgain={() => call.mutate({ id: item.appointmentId }, done)}
            onBackOne={() =>
              sendToBack.mutate(
                { id: item.appointmentId, data: { position: "next" } },
                done,
              )
            }
            onToBack={() =>
              sendToBack.mutate(
                { id: item.appointmentId, data: { position: "end" } },
                done,
              )
            }
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
          <h2 className="mb-3 font-display text-sm font-semibold text-muted-foreground">
            Próximos
          </h2>
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
                  staffName={room.staffName}
                  isFirst={i === 0}
                  isLast={i === room.queue.length - 1}
                  busy={busy}
                  canServe={!serving}
                  onCall={() => call.mutate({ id: item.appointmentId }, done)}
                  onServe={() => start.mutate({ id: item.appointmentId }, done)}
                  onMove={(direction) =>
                    move.mutate(
                      { id: item.appointmentId, data: { direction } },
                      done,
                    )
                  }
                  onPriority={() =>
                    priority.mutate(
                      {
                        id: item.appointmentId,
                        data: { priority: !item.isPriority },
                      },
                      done,
                    )
                  }
                  onRemove={() =>
                    undoCheckIn.mutate({ id: item.appointmentId }, done)
                  }
                  onAssignService={() =>
                    setAssigning({
                      id: item.appointmentId,
                      name: item.displayName,
                      thenComplete: false,
                    })
                  }
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

        {assigning && (
          <AssignServiceDialog
            appointmentId={assigning.id}
            clientName={assigning.name}
            services={services}
            onClose={() => setAssigning(null)}
            onAssigned={() => {
              const { id, name, thenComplete } = assigning;
              setAssigning(null);
              invalidate();
              if (thenComplete) doComplete(id, name);
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
    </WhatsAppConfigContext.Provider>
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
            <span className="font-medium text-foreground">
              Siempre por orden de llegada.
            </span>{" "}
            {lines.length > 0
              ? lines.join(" · ")
              : "Sin horario: abierto todo el tiempo."}
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
      <Link
        href="/app/horarios"
        className="font-medium text-accent hover:underline"
      >
        Horarios
      </Link>
    </div>
  );
}

/**
 * Alguien a quien ya se llamó y todavía no se acercó. En lugar de decidir "no vino" de golpe,
 * el profesional puede llamarlo de nuevo, pasarlo un lugar atrás, mandarlo al final de la fila o
 * recién ahí darlo por ausente.
 */
function CalledPanel({
  item,
  now,
  staffName,
  busy,
  canStart,
  onStart,
  onCallAgain,
  onBackOne,
  onToBack,
  onNoShow,
}: {
  item: WaitingItemDto;
  now: number;
  staffName: string;
  busy: boolean;
  canStart: boolean;
  onStart: () => void;
  onCallAgain: () => void;
  /** Un solo lugar atrás: cede el paso a quien venía detrás. */
  onBackOne: () => void;
  /** Al último lugar de la fila. */
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
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Button
          size="sm"
          onClick={onStart}
          disabled={busy || !canStart}
          title={canStart ? undefined : "Terminá la atención actual primero"}
        >
          <PlayCircle className="size-4" />
          Atender
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onCallAgain}
          disabled={busy}
        >
          <BellRing className="size-4" />
          Llamar de nuevo
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onBackOne}
          disabled={busy}
          title="Deja pasar a quien sigue y queda detrás de esa persona"
        >
          <ArrowDown className="size-4" />
          Un lugar atrás
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onToBack}
          disabled={busy}
          title="Pasa al último lugar de la fila"
        >
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
      <div className="mt-2">
        <WhatsAppNotify
          item={item}
          staffName={staffName}
          label="Avisarle por WhatsApp"
        />
      </div>
    </div>
  );
}

/**
 * Avisarle al cliente por WhatsApp desde el celular del profesional: abre `wa.me` con el mensaje ya
 * escrito y el profesional toca "Enviar" (el navegador no puede mandarlo solo). Sirve de respaldo
 * cuando el cliente tiene las notificaciones bloqueadas o ya cerró la pantalla.
 * El teléfono no viaja en la sala (es pública): se pide aparte, solo para quien se va a avisar. Es
 * un <a> y no un botón con fetch al hacer clic, porque los navegadores bloquean abrir ventanas
 * después de una espera.
 */
function WhatsAppNotify({
  item,
  staffName,
  label = "Avisar por WhatsApp",
}: {
  item: WaitingItemDto;
  staffName: string;
  label?: string;
}) {
  const config = useContext(WhatsAppConfigContext);
  const appt = useAppointmentsGet(item.appointmentId, {
    query: { staleTime: 60_000 },
  });
  const phone = appt.data?.personPhone;
  if (!phone) return null; // sin teléfono cargado no hay a quién escribirle

  // Texto según la situación; el del profesional si lo cambió, y si no el de siempre.
  const kind = item.calledAt
    ? "called"
    : item.position === 0
      ? "next"
      : "waiting";
  const template =
    config.messages?.[kind]?.trim() || DEFAULT_WAITING_MESSAGES[kind];
  const link = appt.data?.publicToken
    ? `\n\nSeguí tu lugar acá: https://${PUBLIC_HOST}/sala/t/${appt.data.publicToken}`
    : "";
  const text =
    renderWhatsAppMessage(template, {
      nombre: titleCaseName(item.displayName),
      profesional: titleCaseName(staffName),
      numero: item.ticketNumber,
      personas: peopleLabel(item.position),
      minutos: item.etaMinutes,
      telefono: config.phone,
    }) + link;

  return (
    <Button
      asChild
      variant="outline"
      size="sm"
      title="Se abre WhatsApp con el mensaje escrito: solo tenés que tocar Enviar"
    >
      <a
        href={whatsAppLink(phone, text)}
        target="_blank"
        rel="noopener noreferrer"
      >
        <MessageCircle className="size-4 text-accent" />
        {label}
      </a>
    </Button>
  );
}

/** Aviso al profesional (web push) cuando alguien se anota por QR: nadie mira la pantalla con la fila llena. */
function ProPushButton() {
  const publicKey = usePushPublicKey();
  const subscribe = useSubscribeProPush();
  const [on, setOn] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [support, setSupport] =
    useState<ReturnType<typeof pushSupport>>("unsupported");

  useEffect(() => {
    setSoundOn(isAttentionArmed());
    setSupport(pushSupport());
    void currentEndpoint().then((ep) =>
      setOn(!!ep && Notification.permission === "granted"),
    );
  }, []);

  // Notificaciones bloqueadas o sin soporte: queda el aviso sonoro con la pantalla abierta.
  if (
    support === "unsupported" ||
    support === "denied" ||
    !publicKey.data?.enabled
  ) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={async () => setSoundOn(await armAttention())}
        disabled={soundOn}
        title={
          support === "denied"
            ? "Bloqueaste las notificaciones del navegador: avisamos con sonido mientras esta pantalla esté abierta"
            : "Suena un aviso cuando alguien se anota, mientras esta pantalla esté abierta"
        }
      >
        <Volume2 className="size-4" />
        {soundOn ? "Sonido activo" : "Activar sonido"}
      </Button>
    );
  }

  async function enable() {
    void armAttention(); // además de la notificación, deja listo el sonido
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
      disabled={on || subscribe.isPending}
      title={
        on
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
  whatsappMessages,
  publicPageSettings,
  onChanged,
}: {
  room: WaitingRoomDto;
  comercioId: string;
  whatsappMessages?: WaitingRoomWhatsappMessagesDto | null;
  publicPageSettings: Record<string, unknown>;
  onChanged: () => void;
}) {
  const update = useUpdateMyMembership(comercioId);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const options: {
    value: WaitingRoomStatus;
    label: string;
    icon: typeof Play;
  }[] = [
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
            onClick={() =>
              update.mutate(
                { waitingRoomStatus: value },
                { onSuccess: onChanged },
              )
            }
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

      <Button
        variant="outline"
        size="sm"
        className="ml-auto"
        onClick={() => setSettingsOpen(true)}
        title="Opciones de la sala: QR, servicio, aceptación y demora"
      >
        <Settings className="size-4" />
        Configuración
      </Button>

      {settingsOpen && (
        <RoomSettingsDialog
          room={room}
          comercioId={comercioId}
          whatsappMessages={whatsappMessages}
          publicPageSettings={publicPageSettings}
          onChanged={onChanged}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}

/**
 * Opciones de la sala de espera de este profesional (aplican a todos sus clientes). Cada cambio se
 * guarda al instante, igual que antes en la barra. Las dos que dependen del QR quedan apagadas
 * mientras el QR no esté habilitado: sin self check-in no hay nada que elegir ni que aceptar.
 */
function RoomSettingsDialog({
  room,
  comercioId,
  whatsappMessages,
  publicPageSettings,
  onChanged,
  onClose,
}: {
  room: WaitingRoomDto;
  comercioId: string;
  whatsappMessages?: WaitingRoomWhatsappMessagesDto | null;
  publicPageSettings: Record<string, unknown>;
  onChanged: () => void;
  onClose: () => void;
}) {
  const update = useUpdateMyMembership(comercioId);
  const qrOff = !room.selfCheckInEnabled;
  // El editor de mensajes reemplaza el contenido del mismo modal (con "Volver").
  const [view, setView] = useState<"main" | "whatsapp">("main");
  // "Atrás" desde el editor vuelve a la configuración (no cierra el modal).
  useBackLayer(view === "whatsapp", () => setView("main"));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={view === "whatsapp" ? "max-w-md sm:max-w-lg" : "max-w-md"}
      >
        {view === "whatsapp" ? (
          <WhatsAppMessagesEditor
            comercioId={comercioId}
            staffName={room.staffName}
            saved={whatsappMessages}
            publicPageSettings={publicPageSettings}
            onBack={() => setView("main")}
            onChanged={onChanged}
          />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Configuración de la sala</DialogTitle>
              <DialogDescription>
                Cómo se anotan tus clientes y cómo se calcula la espera. Los
                cambios se guardan solos.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
              <SettingCheckbox
                label="Dejar que se anoten con el QR"
                hint="Quien escanea el QR del local puede anotarse en la fila desde su celular."
                checked={room.selfCheckInEnabled}
                disabled={update.isPending}
                onChange={(v) =>
                  update.mutate(
                    { waitingRoomSelfCheckIn: v },
                    { onSuccess: onChanged },
                  )
                }
              />
              {/* Por defecto el cliente solo se anota; el servicio lo completa el profesional. */}
              <SettingCheckbox
                label="Que el cliente elija el servicio"
                hint="Apagado: el cliente solo se anota y vos elegís el servicio al atenderlo. Con un único servicio se asigna solo."
                checked={room.selfCheckInAskService}
                disabled={update.isPending || qrOff}
                onChange={(v) =>
                  update.mutate(
                    { waitingRoomAskService: v },
                    { onSuccess: onChanged },
                  )
                }
              />
              {/* Por defecto cada anotado queda pendiente hasta que lo aceptás. */}
              <SettingCheckbox
                label="Aceptar automáticamente a quien se anota"
                hint="Apagado: cada persona que se anota espera a que la aceptes. Prendido: entra directo a la fila (te llega el aviso igual)."
                checked={room.selfCheckInAutoAccept}
                disabled={update.isPending || qrOff}
                onChange={(v) =>
                  update.mutate(
                    { waitingRoomAutoAccept: v },
                    { onSuccess: onChanged },
                  )
                }
              />
              <DefaultMinutesField
                key={room.defaultServiceMinutes}
                minutes={room.defaultServiceMinutes}
                disabled={update.isPending}
                onSave={(n) =>
                  update.mutate(
                    { waitingRoomDefaultMinutes: n },
                    { onSuccess: onChanged },
                  )
                }
              />

              {update.isError && (
                <p className="text-sm text-destructive">
                  {getApiErrorMessage(update.error)}
                </p>
              )}

              <button
                type="button"
                onClick={() => setView("whatsapp")}
                className="flex w-full items-center gap-3 rounded-xl border border-border px-3.5 py-3 text-left transition-colors hover:border-accent/50"
              >
                <MessageCircle className="size-5 shrink-0 text-accent" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    Editar mensaje de WhatsApp
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {whatsappMessages
                      ? "Usás un mensaje personalizado"
                      : "Con el mensaje por defecto"}
                    {typeof publicPageSettings.phone === "string" &&
                    publicPageSettings.phone
                      ? ""
                      : " · Sin teléfono propio cargado"}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </button>

              <Button variant="outline" className="w-full" onClick={onClose}>
                Listo
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SettingCheckbox({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "flex items-start gap-3",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
      )}
    >
      <input
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </label>
  );
}

/** Rango que acepta el backend (`waitingRoomDefaultMinutes`). */
const DEFAULT_MINUTES_MIN = 5;
const DEFAULT_MINUTES_MAX = 240;

/**
 * Cuánto se demora el profesional con cada cliente que se anotó sin servicio. Estima la espera de
 * los de atrás hasta que se le asigne el servicio. Se guarda al salir del campo (o con Enter);
 * un valor fuera de rango vuelve al anterior en vez de mandarse y fallar.
 * El padre lo remonta (`key`) cuando el valor guardado cambia, así el campo nunca queda desfasado.
 */
function DefaultMinutesField({
  minutes,
  disabled,
  onSave,
}: {
  minutes: number;
  disabled: boolean;
  onSave: (minutes: number) => void;
}) {
  const [value, setValue] = useState(String(minutes));

  function commit() {
    const n = Number(value);
    const valid =
      Number.isInteger(n) &&
      n >= DEFAULT_MINUTES_MIN &&
      n <= DEFAULT_MINUTES_MAX;
    if (!valid) return setValue(String(minutes));
    if (n !== minutes) onSave(n);
  }

  return (
    <label
      className="flex items-center gap-2 text-sm font-medium"
      title={`Cuánto te demorás con cada cliente que se anota sin elegir servicio. Entre ${DEFAULT_MINUTES_MIN} y ${DEFAULT_MINUTES_MAX} minutos.`}
    >
      Demora por cliente sin servicio
      <input
        type="number"
        inputMode="numeric"
        min={DEFAULT_MINUTES_MIN}
        max={DEFAULT_MINUTES_MAX}
        step={5}
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className="h-9 w-16 rounded-md border border-input bg-card px-2 text-center text-base text-foreground sm:text-sm"
      />
      <span className="text-muted-foreground">min</span>
    </label>
  );
}

function QueueRow({
  item,
  staffName,
  isFirst,
  isLast,
  busy,
  canServe,
  onCall,
  onServe,
  onMove,
  onPriority,
  onRemove,
  onAssignService,
}: {
  item: WaitingItemDto;
  staffName: string;
  isFirst: boolean;
  isLast: boolean;
  busy: boolean;
  canServe: boolean;
  onCall: () => void;
  onServe: () => void;
  onMove: (direction: "up" | "down") => void;
  onPriority: () => void;
  onRemove: () => void;
  onAssignService: () => void;
}) {
  const away = !!item.awayUntil;
  return (
    <li
      className={cn(
        "rounded-xl border bg-card px-3.5 py-3",
        item.calledAt
          ? "border-accent/60"
          : item.isPriority
            ? "border-warning/60"
            : "border-border",
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
            {item.isPriority && (
              <Badge icon={Siren} tone="warning">
                urgente
              </Badge>
            )}
            {item.isWalkIn && <Badge icon={Footprints}>sin turno</Badge>}
            {item.calledAt && (
              <Badge icon={BellRing} tone="accent">
                llamado
              </Badge>
            )}
            {away && item.awayUntil && (
              <Badge icon={Hourglass}>
                vuelve {formatTime(item.awayUntil)}
              </Badge>
            )}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {titleCaseName(item.serviceName)} · llegó{" "}
            {formatTime(item.checkedInAt ?? item.startAt)} ·{" "}
            <span
              title={
                item.etaLearned
                  ? "Calculado con tus tiempos reales"
                  : "Duración configurada"
              }
            >
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
          title={
            canServe
              ? "Atender ahora, sin llamarlo"
              : "Terminá la atención actual primero"
          }
        >
          <PlayCircle className="size-4" />
          Atender
        </Button>
        {/* Solo a los que están por tocar; quien ya fue llamado tiene su botón en el panel de arriba. */}
        {!item.calledAt && !away && item.position <= 2 && (
          <WhatsAppNotify item={item} staffName={staffName} label="WhatsApp" />
        )}
        {!item.serviceId && (
          <Button
            variant="outline"
            size="sm"
            onClick={onAssignService}
            disabled={busy}
            title="Todavía no eligió servicio: definilo para calcular precio y espera"
          >
            <Tag className="size-4" />
            Elegir servicio
          </Button>
        )}
        <span className="mx-1 h-5 w-px bg-border" />
        <IconBtn
          label="Subir un lugar"
          onClick={() => onMove("up")}
          disabled={busy || isFirst}
        >
          <ArrowUp className="size-4" />
        </IconBtn>
        <IconBtn
          label="Bajar un lugar"
          onClick={() => onMove("down")}
          disabled={busy || isLast}
        >
          <ArrowDown className="size-4" />
        </IconBtn>
        <IconBtn
          label={
            item.isPriority
              ? "Quitar urgencia"
              : "Marcar como urgente (pasa al frente)"
          }
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
