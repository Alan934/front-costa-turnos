"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MapPin,
  Clock3,
  Check,
  ChevronLeft,
  CalendarX2,
  CalendarCheck2,
  Info,
  ArrowRight,
  Users,
  Sunrise,
  Sun,
  Moon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/theme-toggle";
import { ErrorState, EmptyState } from "@/components/state-views";
import {
  useComercioPublicPage,
  usePublicServices,
  usePublicProfessionalSlots,
  usePublicProfessionalDayAvailability,
  usePublicServiceSlots,
  usePublicServiceDayAvailability,
  useBookProfessional,
  useBookProfessionalWithDeposit,
  useBookService,
  useBookServiceWithDeposit,
} from "@/lib/api/public-booking";
import { getPaymentOptions, paymentSummary, baseCents, type PayOption } from "@/lib/deposit";
import { env } from "@/lib/env";
import {
  formatMoney,
  formatDuration,
  formatDayChip,
  formatTime,
  formatDateLong,
  isSameDay,
  timeBand,
  type TimeBand,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ComercioPublicPageDto } from "@/lib/api/generated/model/comercioPublicPageDto";
import type { PublicServiceDto } from "@/lib/api/generated/model/publicServiceDto";
import type { PublicServiceProfessionalDto } from "@/lib/api/generated/model/publicServiceProfessionalDto";
import type { DayAvailabilityDto } from "@/lib/api/generated/model/dayAvailabilityDto";
import { DayAvailabilityStatus } from "@/lib/api/generated/model/dayAvailabilityStatus";
import { TimeOffType } from "@/lib/api/generated/model/timeOffType";
import type { Slot } from "@/mocks/contract-extensions";
import {
  getApiErrorMessage,
  getApiValidationMessages,
  matchFieldErrors,
} from "@/lib/api/error-message";

/** Opción de profesional: uno concreto o "cualquiera" (el back asigna al de menor carga). */
type ProfessionalChoice = PublicServiceProfessionalDto | "any";

type Step = 1 | 2 | 3 | 4;

interface Selection {
  service: PublicServiceDto | null;
  professional: ProfessionalChoice | null;
  slot: Slot | null;
}

interface ConfirmedState {
  provisional: boolean;
  /** Nombre del profesional asignado por el back cuando se eligió "cualquiera". */
  professionalDisplayName?: string;
}

function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Estado visual de un día en el selector. El back solo distingue
 * available/closed/time_off/full; "almost" lo inferimos contando huecos libres y, dentro de
 * time_off, separamos feriado/vacaciones/bloqueo leyendo el `reason` cargado por el profesional.
 */
type DayKind =
  | "available"
  | "almost"
  | "full"
  | "block"
  | "holiday"
  | "vacation"
  | "closed";

/** ¿En este estado el cliente puede elegir el día? */
function isBookableKind(kind: DayKind): boolean {
  return kind === "available" || kind === "almost";
}

/**
 * Subtipo de un día bloqueado (time_off). Usa el `timeOffType` tipado del back;
 * si no viene (back anterior), cae al texto libre `reason` como respaldo.
 */
function timeOffKind(type: TimeOffType | null | undefined, reason: string | null | undefined): DayKind {
  if (type === TimeOffType.holiday) return "holiday";
  if (type === TimeOffType.vacation) return "vacation";
  if (type === TimeOffType.block) return "block";
  const r = (reason ?? "").toLowerCase();
  if (/vacac/.test(r)) return "vacation";
  if (/feriad/.test(r)) return "holiday";
  return "block";
}

/** Clases (chip y punto de leyenda) + etiqueta de cada estado de día. */
const DAY_KIND_STYLE: Record<DayKind, { chip: string; dot: string; label: string }> = {
  available: {
    chip: "border-cal-available-foreground/20 bg-cal-available/60 text-cal-available-foreground hover:bg-cal-available",
    dot: "bg-cal-available-foreground",
    label: "Disponible",
  },
  almost: {
    chip: "border-cal-almost-foreground/25 bg-cal-almost/70 text-cal-almost-foreground hover:bg-cal-almost",
    dot: "bg-cal-almost-foreground",
    label: "Quedan pocos",
  },
  full: {
    chip: "border-cal-full-foreground/25 bg-cal-full/60 text-cal-full-foreground",
    dot: "bg-cal-full-foreground",
    label: "Completo",
  },
  block: {
    chip: "border-cal-block-foreground/25 bg-cal-block/55 text-cal-block-foreground",
    dot: "bg-cal-block-foreground",
    label: "Bloqueado",
  },
  holiday: {
    chip: "border-cal-holiday-foreground/25 bg-cal-holiday/55 text-cal-holiday-foreground",
    dot: "bg-cal-holiday-foreground",
    label: "Feriado",
  },
  vacation: {
    chip: "border-cal-vacation-foreground/25 bg-cal-vacation/55 text-cal-vacation-foreground",
    dot: "bg-cal-vacation-foreground",
    label: "Vacaciones",
  },
  closed: {
    chip: "bg-off border-cal-closed-foreground/20 bg-cal-closed/60 text-cal-closed-foreground",
    dot: "bg-cal-closed-foreground",
    label: "No atiende",
  },
};

/** Franjas horarias para agrupar y colorear los turnos de un día. */
const TIME_BANDS: { key: TimeBand; label: string; icon: typeof Sun; slotChip: string }[] = [
  {
    key: "morning",
    label: "Mañana",
    icon: Sunrise,
    slotChip:
      "border-cal-morning-foreground/25 bg-cal-morning/50 text-cal-morning-foreground hover:bg-cal-morning hover:border-cal-morning-foreground/45",
  },
  {
    key: "afternoon",
    label: "Tarde",
    icon: Sun,
    slotChip:
      "border-cal-afternoon-foreground/25 bg-cal-afternoon/50 text-cal-afternoon-foreground hover:bg-cal-afternoon hover:border-cal-afternoon-foreground/45",
  },
  {
    key: "evening",
    label: "Noche",
    icon: Moon,
    slotChip:
      "border-cal-evening-foreground/25 bg-cal-evening/50 text-cal-evening-foreground hover:bg-cal-evening hover:border-cal-evening-foreground/45",
  },
];

export function PublicBookingPage({ slug }: { slug: string }) {
  const { data, isLoading, isError, refetch } = useComercioPublicPage(slug);

  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 pb-24 sm:px-6">
      <TopBar />
      {isLoading && <PageSkeleton />}
      {isError && (
        <div className="py-10">
          <ErrorState
            title="No encontramos esta página"
            message="Puede que el enlace sea incorrecto o el negocio no esté disponible."
            onRetry={() => refetch()}
          />
        </div>
      )}
      {data && <BookingShell slug={slug} page={data} />}
    </div>
  );
}

function TopBar() {
  return (
    <header className="flex items-center justify-between py-5">
      <span className="font-display text-sm font-semibold tracking-tight text-muted-foreground">
        Costa Turnos
      </span>
      <ThemeToggle />
    </header>
  );
}

function BookingShell({ slug, page }: { slug: string; page: ComercioPublicPageDto }) {
  const [step, setStep] = useState<Step>(1);
  const [sel, setSel] = useState<Selection>({ service: null, professional: null, slot: null });
  const [confirmed, setConfirmed] = useState<ConfirmedState | null>(null);

  // Si el servicio tiene un único profesional asignado, se omite el paso de selección.
  const singlePro = !sel.service || sel.service.professionals.length <= 1;

  // El back envía mpConnected para indicar si hay cobros online disponibles.
  // Si no viene el campo (backend anterior), asumimos true para no bloquear servicios.
  const mpConnected = (page as ComercioPublicPageDto & { mpConnected?: boolean }).mpConnected ?? true;

  function pickService(service: PublicServiceDto) {
    const profs = service.professionals;
    // Un solo profesional: lo preseleccionamos y pasamos directo al selector de horario.
    const autoProf = profs.length === 1 ? profs[0] : null;
    setSel({ service, professional: autoProf, slot: null });
    setStep(autoProf ? 3 : 2);
  }

  function pickProfessional(professional: ProfessionalChoice) {
    setSel((s) => ({ ...s, professional, slot: null }));
    setStep(3);
  }

  function pickSlot(slot: Slot) {
    setSel((s) => ({ ...s, slot }));
    setStep(4);
  }

  function back() {
    if (step === 4) setStep(3);
    else if (step === 3) setStep(singlePro ? 1 : 2);
    else if (step === 2) setStep(1);
  }

  function reset() {
    setConfirmed(null);
    setSel({ service: null, professional: null, slot: null });
    setStep(1);
  }

  if (confirmed) {
    return (
      <Confirmation
        page={page}
        sel={sel}
        provisional={confirmed.provisional}
        assignedProName={confirmed.professionalDisplayName}
        onReset={reset}
      />
    );
  }

  return (
    <div>
      <ComercioHeader page={page} />
      <Stepper step={step} singlePro={singlePro} />

      <div className="mt-6">
        {step > 1 ? (
          <button
            type="button"
            onClick={back}
            className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
            Volver
          </button>
        ) : null}

        {step === 1 && <ServiceStep slug={slug} onPick={pickService} mpConnected={mpConnected} />}

        {step === 2 && sel.service && (
          <ProfessionalStep service={sel.service} onPick={pickProfessional} />
        )}

        {step === 3 && sel.service && sel.professional && (
          <SlotStep
            slug={slug}
            service={sel.service}
            professional={sel.professional}
            onPick={pickSlot}
          />
        )}

        {step === 4 && sel.service && sel.professional && sel.slot && (
          <ConfirmStep
            slug={slug}
            service={sel.service}
            professional={sel.professional}
            slot={sel.slot}
            mpConnected={mpConnected}
            onConfirmed={(provisional, professionalDisplayName) =>
              setConfirmed({ provisional, professionalDisplayName })
            }
          />
        )}
      </div>
    </div>
  );
}

/* ---------- Header del comercio ---------- */
function ComercioHeader({ page }: { page: ComercioPublicPageDto }) {
  const settings = (page.settings ?? {}) as { bio?: string; phone?: string };
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h1 className="font-display text-2xl font-semibold tracking-tight">{page.name}</h1>
      {settings.bio && <p className="mt-1.5 text-sm text-muted-foreground">{settings.bio}</p>}
      {page.address && (
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-3.5 text-accent" />
            {page.address}
          </span>
        </div>
      )}
    </div>
  );
}

/* ---------- Stepper ---------- */
function Stepper({ step, singlePro }: { step: Step; singlePro: boolean }) {
  const labels = singlePro
    ? ["Servicio", "Horario", "Confirmar"]
    : ["Servicio", "Profesional", "Horario", "Confirmar"];

  // Índice visible del paso actual (omitimos el paso 2 en modo singlePro).
  const current = singlePro
    ? step === 1 ? 0 : step === 3 ? 1 : 2
    : step - 1;

  return (
    <ol className="mt-6 flex items-center gap-2" aria-label="Pasos de la reserva">
      {labels.map((label, i) => {
        const state = i < current ? "done" : i === current ? "current" : "todo";
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold transition-colors",
                state === "done" && "bg-accent text-accent-foreground",
                state === "current" && "border-2 border-accent text-accent",
                state === "todo" && "border border-border text-muted-foreground",
              )}
            >
              {state === "done" ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span
              className={cn(
                "hidden text-xs font-medium sm:inline",
                state === "todo" ? "text-muted-foreground" : "text-foreground",
              )}
            >
              {label}
            </span>
            {i < labels.length - 1 && <span className="h-px flex-1 bg-border" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

/* ---------- Paso 1: Servicio ---------- */
function ServiceStep({
  slug,
  onPick,
  mpConnected,
}: {
  slug: string;
  onPick: (s: PublicServiceDto) => void;
  mpConnected: boolean;
}) {
  const { data, isLoading, isError, refetch } = usePublicServices(slug);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }
  if (isError) {
    return <ErrorState message="No pudimos cargar los servicios." onRetry={() => refetch()} />;
  }
  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={<CalendarX2 className="size-5" />}
        title="Sin servicios disponibles"
        message="Este negocio todavía no publicó servicios para reservar."
      />
    );
  }

  // Sin MP conectado, solo se pueden reservar servicios con opción "sin pago".
  const available = mpConnected ? data : data.filter((s) => s.allowNoPayment);

  if (available.length === 0) {
    return (
      <EmptyState
        icon={<CalendarX2 className="size-5" />}
        title="Sin servicios disponibles"
        message="Los servicios de este negocio requieren pago online, que no está activo en este momento."
      />
    );
  }

  return (
    <div>
      <h2 className="font-display text-lg font-semibold">Elegí el servicio</h2>
      <div className="mt-4 space-y-3">
        {available.map((s) => {
          // Sin MP, no mostramos la badge de pago online para no confundir al cliente.
          const displaySvc = mpConnected ? s : { ...s, allowDeposit: false, allowFullPayment: false };
          const summary = paymentSummary(displaySvc);
          const proCount = s.professionals.length;
          return (
            <button
              key={s.serviceId}
              type="button"
              onClick={() => onPick(s)}
              className="group flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-accent focus-visible:border-accent"
            >
              {s.imageUrls.length > 0 && (
                <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {/* URL firmada lista para mostrar (la provee el back, ~15 min). */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.imageUrls[0]} alt="" className="size-full object-cover" />
                  {s.imageUrls.length > 1 && (
                    <span className="absolute bottom-0.5 right-0.5 rounded bg-black/60 px-1 text-[10px] font-medium text-white">
                      +{s.imageUrls.length - 1}
                    </span>
                  )}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium">{s.name}</p>
                {s.description && (
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{s.description}</p>
                )}
                <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock3 className="size-3.5" />
                  {formatDuration(s.durationMinutes)}
                  {proCount > 1 && (
                    <>
                      <span className="mx-0.5">·</span>
                      <Users className="size-3.5" />
                      {proCount} profesionales
                    </>
                  )}
                </p>
                {summary && (
                  <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-accent">
                    <Info className="size-3" />
                    {summary}
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="font-display font-semibold tabular-nums">{formatMoney(s.priceCents)}</p>
                <ArrowRight className="ml-auto mt-1 size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Paso 2: Profesional (o "Cualquiera") ---------- */
function ProfessionalStep({
  service,
  onPick,
}: {
  service: PublicServiceDto;
  onPick: (p: ProfessionalChoice) => void;
}) {
  return (
    <div>
      <h2 className="font-display text-lg font-semibold">¿Con quién te atendés?</h2>
      <p className="mt-1 text-sm text-muted-foreground">{service.name}</p>
      <div className="mt-4 space-y-3">
        {/* Opción "Cualquiera": el back asigna el profesional de menor carga */}
        <button
          type="button"
          onClick={() => onPick("any")}
          className="group flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-accent focus-visible:border-accent"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-muted">
            <Users className="size-5 text-muted-foreground" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium">Cualquiera disponible</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Te asignamos el profesional más libre ese día.
            </p>
          </div>
          <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
        </button>

        {service.professionals.map((p) => (
          <button
            key={p.membershipId}
            type="button"
            onClick={() => onPick(p)}
            className="group flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-accent focus-visible:border-accent"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-muted font-display text-lg font-semibold text-foreground">
              {p.displayName.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{p.displayName}</p>
              {p.address && (
                <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="size-3.5" />
                  {p.address}
                </p>
              )}
            </div>
            <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- Paso 3: Fecha y hora ---------- */
function SlotStep({
  slug,
  service,
  professional,
  onPick,
}: {
  slug: string;
  service: PublicServiceDto;
  professional: ProfessionalChoice;
  onPick: (s: Slot) => void;
}) {
  const isAny = professional === "any";
  const membershipId = isAny ? null : professional.membershipId;

  const days = useMemo(() => {
    const out: Date[] = [];
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    for (let i = 0; i < 14; i++) {
      const day = new Date(d);
      day.setDate(d.getDate() + i);
      out.push(day);
    }
    return out;
  }, []);

  const [activeDay, setActiveDay] = useState<Date>(days[0]);

  const range = useMemo(() => {
    const from = new Date(days[0]);
    const to = new Date(days[days.length - 1]);
    to.setHours(23, 59, 59, 999);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [days]);

  const slotsParams = { serviceId: service.serviceId, from: range.from, to: range.to };

  // Cada par de hooks se monta siempre; solo uno de los dos está habilitado según `isAny`.
  const slotsService = usePublicServiceSlots(slug, isAny ? service.serviceId : null, isAny ? slotsParams : null);
  const slotsPro = usePublicProfessionalSlots(slug, membershipId, isAny ? null : slotsParams);
  const { data: slots, isLoading, isError, refetch } = isAny ? slotsService : slotsPro;

  const availService = usePublicServiceDayAvailability(slug, isAny ? service.serviceId : null, isAny ? slotsParams : null);
  const availPro = usePublicProfessionalDayAvailability(slug, membershipId, isAny ? null : slotsParams);
  const { data: availability } = isAny ? availService : availPro;

  const availByDate = useMemo(() => {
    const map = new Map<string, DayAvailabilityDto>();
    for (const a of availability ?? []) map.set(a.date, a);
    return map;
  }, [availability]);

  const slotsLoaded = slots != null;

  // Ocupación ≥80% (dato exacto del back) ⇒ "quedan pocos".
  const ALMOST_THRESHOLD = 0.8;

  // Estado visual de cada día (color + etiqueta) a partir de la disponibilidad del back:
  // status + ocupación exacta (occupancyRatio) + tipo de ausencia (timeOffType).
  const dayInfos = useMemo(() => {
    return days.map((d) => {
      const a = availByDate.get(localDateKey(d));
      if (a) {
        let kind: DayKind;
        switch (a.status) {
          case DayAvailabilityStatus.full:
            kind = "full";
            break;
          case DayAvailabilityStatus.closed:
            kind = "closed";
            break;
          case DayAvailabilityStatus.time_off:
            kind = timeOffKind(a.timeOffType, a.reason);
            break;
          default: // available
            kind = a.occupancyRatio >= ALMOST_THRESHOLD ? "almost" : "available";
        }
        return { d, a, free: a.freeSlots, total: a.totalSlots, kind };
      }
      // Fallback (back sin day-availability): inferimos desde los huecos libres.
      const free = slotsLoaded ? (slots ?? []).filter((s) => isSameDay(s.startAt, d)).length : 0;
      const kind: DayKind = !slotsLoaded ? "available" : free === 0 ? "closed" : "available";
      return { d, a: undefined, free, total: free, kind };
    });
  }, [days, availByDate, slots, slotsLoaded]);

  const activeInfo = dayInfos.find((di) => isSameDay(di.d, activeDay));

  // Estados realmente presentes en el rango, en orden, para armar una leyenda relevante.
  const presentKinds = useMemo(() => {
    const order: DayKind[] = ["available", "almost", "full", "block", "holiday", "vacation", "closed"];
    const set = new Set(dayInfos.map((di) => di.kind));
    return order.filter((k) => set.has(k));
  }, [dayInfos]);

  const daySlots = (slots ?? []).filter((s) => isSameDay(s.startAt, activeDay));

  // Huecos del día activo agrupados por franja (mañana/tarde/noche).
  const groupedSlots = useMemo(() => {
    const g: Record<TimeBand, Slot[]> = { morning: [], afternoon: [], evening: [] };
    for (const s of daySlots) g[timeBand(s.startAt)].push(s);
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, activeDay]);

  useEffect(() => {
    if (availByDate.size === 0) return;
    if (activeInfo && isBookableKind(activeInfo.kind)) return;
    const firstOpen = dayInfos.find((di) => isBookableKind(di.kind));
    if (firstOpen) setActiveDay(firstOpen.d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayInfos]);

  const proLabel = isAny ? "cualquier profesional" : `con ${professional.displayName}`;

  return (
    <div>
      <h2 className="font-display text-lg font-semibold">Elegí día y hora</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {service.name} · {formatDuration(service.durationMinutes)} · {proLabel}
      </p>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
        {dayInfos.map(({ d, a, free, total, kind }) => {
          const chip = formatDayChip(d);
          const active = isSameDay(d, activeDay);
          const bookable = isBookableKind(kind);
          const style = DAY_KIND_STYLE[kind];
          const subLabel =
            kind === "available"
              ? "Libre"
              : kind === "almost"
                ? `${free} libre${free === 1 ? "" : "s"}`
                : kind === "block"
                  ? a?.reason?.trim() || style.label
                  : style.label;
          // En días reservables informamos la ocupación exacta (dato del back) como tooltip.
          const occupancyTitle = bookable && total > 0 ? `Quedan ${free} de ${total} turnos` : null;
          const ariaLabel =
            `${chip.weekday} ${chip.day} — ${occupancyTitle ?? subLabel}` +
            (active ? " (seleccionado)" : "");
          return (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => bookable && setActiveDay(d)}
              disabled={!bookable}
              aria-label={ariaLabel}
              title={
                occupancyTitle ?? (kind === "block" && a?.reason ? a.reason : style.label)
              }
              className={cn(
                "relative flex shrink-0 flex-col items-center rounded-xl border px-3.5 py-2.5 transition-colors",
                style.chip,
                !bookable && "cursor-not-allowed",
                active && "ring-2 ring-accent ring-offset-2 ring-offset-background",
              )}
            >
              <span className="text-[11px] uppercase">{chip.weekday}</span>
              <span className="font-display text-base font-semibold tabular-nums">{chip.day}</span>
              <span className="mt-0.5 max-w-[5rem] truncate text-[9px] font-medium uppercase tracking-wide">
                {subLabel}
              </span>
            </button>
          );
        })}
      </div>

      {/* Leyenda: qué significa cada color de día. */}
      {presentKinds.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-3.5 gap-y-1.5">
          {presentKinds.map((k) => (
            <span
              key={k}
              className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"
            >
              <span className={cn("size-2.5 rounded-full", DAY_KIND_STYLE[k].dot)} aria-hidden />
              {DAY_KIND_STYLE[k].label}
            </span>
          ))}
        </div>
      )}

      <div className="mt-5">
        {isLoading && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded-lg" />
            ))}
          </div>
        )}
        {isError && <ErrorState message="No pudimos cargar los horarios." onRetry={() => refetch()} />}
        {!isLoading && !isError && daySlots.length === 0 && (() => {
          const kind = activeInfo?.kind;
          const blocked = kind != null && !isBookableKind(kind);
          const title = blocked
            ? kind === "block"
              ? activeInfo?.a?.reason?.trim() || "Bloqueado"
              : DAY_KIND_STYLE[kind].label
            : "Sin horarios este día";
          const message =
            kind === "vacation" || kind === "holiday" || kind === "block"
              ? "Ese día el profesional no atiende. Probá con otra fecha de la lista."
              : kind === "full"
                ? "Todos los turnos de ese día ya están reservados. Probá con otra fecha."
                : "Probá con otra fecha de la lista.";
          return (
            <EmptyState icon={<CalendarX2 className="size-5" />} title={title} message={message} />
          );
        })()}
        {!isLoading && !isError && daySlots.length > 0 && (
          <div className="space-y-5">
            {TIME_BANDS.map((band) => {
              const items = groupedSlots[band.key];
              if (items.length === 0) return null;
              const Icon = band.icon;
              return (
                <div key={band.key}>
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Icon className="size-3.5" />
                    <span>{band.label}</span>
                    <span className="text-muted-foreground/60">
                      · {items.length} {items.length === 1 ? "turno" : "turnos"}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {items.map((slot) => (
                      <button
                        key={slot.startAt}
                        type="button"
                        onClick={() => onPick(slot)}
                        className={cn(
                          "rounded-lg border py-2.5 font-display text-sm font-medium tabular-nums transition-colors focus-visible:border-accent",
                          band.slotChip,
                        )}
                      >
                        {formatTime(slot.startAt)}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Paso 4: Confirmar ---------- */
function ConfirmStep({
  slug,
  service,
  professional,
  slot,
  mpConnected,
  onConfirmed,
}: {
  slug: string;
  service: PublicServiceDto;
  professional: ProfessionalChoice;
  slot: Slot;
  mpConnected: boolean;
  onConfirmed: (provisional: boolean, professionalDisplayName?: string) => void;
}) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [payRedirectError, setPayRedirectError] = useState(false);

  const isAny = professional === "any";
  const membershipId = isAny ? "" : professional.membershipId;

  // Sin MP conectado, forzamos "sin pago" en las opciones online (seña/total). El efectivo NO
  // requiere MP (se cobra en persona), así que se mantiene disponible aunque no haya MercadoPago.
  const effectiveSvc = mpConnected
    ? service
    : { ...service, allowDeposit: false, allowFullPayment: false };
  const options = getPaymentOptions(effectiveSvc);
  const hasNoPay = options.some((o) => o.choice === "none");
  // Efectivo y transferencia comparten el mismo aviso (turno confirmado, se paga en persona).
  const hasInPerson = options.some((o) => o.choice === "cash" || o.choice === "transfer");
  const hasPaid = mpConnected && options.some((o) => o.requiresPayment);

  // ¿Una reserva sin seña podría quedar provisional (desplazable por quien pague)? Depende de la
  // config del profesional. En "cualquiera" basta con que UNO la tenga activa: la reserva podría
  // caer en él. Con profesional concreto, su propio flag manda. false = el aviso no aplica.
  const provisionalPossible = isAny
    ? service.professionals.some((p) => p.allowProvisionalBookings)
    : professional.allowProvisionalBookings;

  // Siempre se montan los cuatro hooks; solo se llama al que corresponde al camino elegido.
  const bookPro = useBookProfessional(slug, membershipId);
  const bookProDeposit = useBookProfessionalWithDeposit(slug, membershipId);
  const bookSvc = useBookService(slug, service.serviceId);
  const bookSvcDeposit = useBookServiceWithDeposit(slug, service.serviceId);

  const book = isAny ? bookSvc : bookPro;
  const bookWithDeposit = isAny ? bookSvcDeposit : bookProDeposit;
  const submitting = book.isPending || bookWithDeposit.isPending;

  const bookError = book.error ?? bookWithDeposit.error;
  const failed = book.isError || bookWithDeposit.isError;
  const validationMessages = failed ? getApiValidationMessages(bookError) : [];
  const fieldErrors = matchFieldErrors(validationMessages, ["fullName", "phone", "email"]);
  const hasFieldErrors = Object.keys(fieldErrors).length > 0;
  const slotTaken = !hasFieldErrors && (bookError as { response?: { status?: number } } | null)
    ?.response?.status === 409;
  const generalError = payRedirectError
    ? "No pudimos generar el link de pago. Tu turno no quedó confirmado. Probá de nuevo en unos minutos."
    : failed && !hasFieldErrors
      ? slotTaken
        ? "Ese horario ya fue reservado por otra persona. Volvé atrás y elegí otro."
        : getApiErrorMessage(bookError, "No pudimos confirmar el turno. Probá de nuevo.")
      : null;

  const canSubmit = fullName.trim().length > 1 && phone.trim().length > 5;

  const proSummary = isAny
    ? "Cualquier profesional disponible"
    : professional.displayName + (professional.address ? ` · ${professional.address}` : "");

  function submit(option: PayOption) {
    const base = {
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      serviceId: service.serviceId,
      startAt: slot.startAt,
    };
    if (option.flow === "cash" || option.flow === "transfer") {
      // Efectivo / transferencia: turno confirmado al instante (no provisional). Sin paymentOption:
      // el back cobra el precio base. El cobro queda pendiente hasta el turno presencial.
      bookWithDeposit.mutate(
        { ...base, method: option.flow === "transfer" ? "transfer" : "cash" },
        {
          // En cash/transfer el back devuelve el turno creado (con professionalDisplayName si fue "cualquiera").
          onSuccess: (res) => onConfirmed(false, res.appointment?.professionalDisplayName),
        },
      );
    } else if (option.paymentOption) {
      setPayRedirectError(false);
      bookWithDeposit.mutate(
        { ...base, method: "mercadopago", paymentOption: option.paymentOption },
        {
          onSuccess: (res) => {
            // En MP el turno se crea al acreditar el pago (appointment llega null): redirigimos al checkout.
            if (env.mockingEnabled) {
              onConfirmed(false, res.appointment?.professionalDisplayName);
              return;
            }
            if (res.mpInitPoint) {
              window.location.href = res.mpInitPoint;
              return;
            }
            setPayRedirectError(true);
          },
        },
      );
    } else {
      book.mutate(base, {
        onSuccess: (appt) => {
          const proName = isAny
            ? (appt as { professionalDisplayName?: string } & typeof appt).professionalDisplayName
            : undefined;
          onConfirmed(!!appt?.isProvisional, proName);
        },
      });
    }
  }

  return (
    <div>
      <h2 className="font-display text-lg font-semibold">Confirmá tu turno</h2>

      <div className="mt-4 rounded-xl border border-border bg-card p-4">
        <Row label="Servicio" value={service.name} />
        <Row label="Profesional" value={proSummary} />
        <Row label="Cuándo" value={`${formatDateLong(slot.startAt)} · ${formatTime(slot.startAt)}`} />
        <Row label="Precio" value={formatMoney(baseCents(service))} strong />
        {hasPaid && (
          <p className="pt-1 text-right text-xs text-muted-foreground">
            Los pagos por Mercado Pago suman IVA (ver cada opción).
          </p>
        )}
      </div>

      {hasPaid && hasNoPay && provisionalPossible && (
        <div className="mt-4 flex gap-3 rounded-xl border border-warning/40 bg-warning/10 p-3.5">
          <Info className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
          <p className="text-sm text-warning-foreground">
            Si reservás sin pagar, tu turno puede quedar <strong>provisional</strong>: si otra
            persona abona para el mismo horario, puede quedarse con tu lugar. Pagando, lo asegurás.
          </p>
        </div>
      )}
      {hasPaid && !hasNoPay && (
        <div className="mt-4 flex gap-3 rounded-xl border border-accent/40 bg-accent/10 p-3.5">
          <Info className="mt-0.5 size-4 shrink-0 text-accent" />
          <p className="text-sm">Este servicio se reserva pagando para confirmar el turno.</p>
        </div>
      )}
      {hasInPerson && (
        <div className="mt-4 flex gap-3 rounded-xl border border-accent/40 bg-accent/10 p-3.5">
          <Info className="mt-0.5 size-4 shrink-0 text-accent" />
          <p className="text-sm">
            Pagando en efectivo o por transferencia tu turno queda <strong>confirmado</strong>.
            Abonás el total en persona el día del turno (sin IVA).
          </p>
        </div>
      )}

      <div className="mt-5 space-y-3">
        <div>
          <Label htmlFor="fullName">Nombre y apellido</Label>
          <Input
            id="fullName"
            className="mt-1.5"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Ej: Sofía Pérez"
            autoComplete="name"
            aria-invalid={!!fieldErrors.fullName}
          />
          {fieldErrors.fullName && (
            <p className="mt-1.5 text-sm text-destructive">{fieldErrors.fullName}</p>
          )}
        </div>
        <div>
          <Label htmlFor="phone">Teléfono / WhatsApp</Label>
          <Input
            id="phone"
            className="mt-1.5"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Ej: 261 555 1234"
            inputMode="tel"
            autoComplete="tel"
            aria-invalid={!!fieldErrors.phone}
          />
          {fieldErrors.phone && (
            <p className="mt-1.5 text-sm text-destructive">{fieldErrors.phone}</p>
          )}
        </div>
        <div>
          <Label htmlFor="email">
            Email <span className="text-muted-foreground">(opcional)</span>
          </Label>
          <Input
            id="email"
            type="email"
            className="mt-1.5"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vos@email.com"
            autoComplete="email"
            aria-invalid={!!fieldErrors.email}
          />
          {fieldErrors.email && (
            <p className="mt-1.5 text-sm text-destructive">{fieldErrors.email}</p>
          )}
        </div>
      </div>

      {hasFieldErrors && (
        <p className="mt-3 text-sm text-destructive">
          Revisá los datos marcados y volvé a intentar.
        </p>
      )}
      {generalError && <p className="mt-3 text-sm text-destructive">{generalError}</p>}

      <div className="mt-6 space-y-2.5">
        {options.map((opt, i) => {
          const label =
            opt.choice === "deposit"
              ? `Pagar seña y reservar · ${formatMoney(opt.amountCents)}`
              : opt.choice === "full"
                ? `Pagar el total · ${formatMoney(opt.amountCents)}`
                : opt.choice === "cash"
                  ? `Pagar en efectivo · ${formatMoney(opt.amountCents)}`
                  : opt.choice === "transfer"
                    ? `Pagar por transferencia · ${formatMoney(opt.amountCents)}`
                    : hasPaid
                      ? "Reservar sin pagar"
                      : "Confirmar turno";
          // Para pagos por MP que suman IVA al cliente, mostramos el desglose sin IVA / IVA.
          const br = opt.breakdown;
          const showVat = br && br.vatChargedToClient && br.vatAmountCents > 0;
          return (
            <div key={opt.choice}>
              <Button
                className="w-full"
                size="lg"
                variant={i === 0 ? "default" : "outline"}
                disabled={!canSubmit || submitting}
                onClick={() => submit(opt)}
              >
                {submitting && i === 0 ? <Spinner /> : null}
                {label}
              </Button>
              {showVat && (
                <p className="mt-1 text-center text-xs text-muted-foreground">
                  Sin IVA {formatMoney(br.baseCents)} · IVA {br.vatPercent}% {formatMoney(br.vatAmountCents)}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("text-right", strong && "font-display font-semibold")}>{value}</span>
    </div>
  );
}

/* ---------- Confirmación ---------- */
function Confirmation({
  page,
  sel,
  provisional,
  assignedProName,
  onReset,
}: {
  page: ComercioPublicPageDto;
  sel: Selection;
  provisional: boolean;
  assignedProName?: string;
  onReset: () => void;
}) {
  const proDisplay =
    sel.professional === "any"
      ? assignedProName ?? "un profesional disponible"
      : sel.professional?.displayName ?? "";

  return (
    <div className="py-8 text-center">
      <span
        className={cn(
          "mx-auto grid size-14 place-items-center rounded-full",
          provisional ? "bg-warning/15 text-warning-foreground" : "bg-accent/15 text-accent",
        )}
      >
        <CalendarCheck2 className="size-7" />
      </span>
      <h2 className="mt-4 font-display text-2xl font-semibold">
        {provisional ? "Turno provisional reservado" : "¡Turno confirmado!"}
      </h2>
      {sel.service && sel.slot && (
        <p className="mt-2 text-muted-foreground">
          {sel.service.name} con {proDisplay}
          <br />
          {formatDateLong(sel.slot.startAt)} · {formatTime(sel.slot.startAt)}
        </p>
      )}
      {provisional && (
        <p className="mx-auto mt-4 max-w-sm rounded-xl border border-warning/40 bg-warning/10 p-3.5 text-sm text-warning-foreground">
          Recordá: sin seña tu turno es provisional y puede ser tomado por quien abone. Te enviamos
          los datos para asegurarlo.
        </p>
      )}
      <p className="mt-4 text-sm text-muted-foreground">
        Te avisaremos por WhatsApp. {page.name} te espera.
      </p>
      <Button variant="outline" className="mt-6" onClick={onReset}>
        Reservar otro turno
      </Button>
    </div>
  );
}

/* ---------- Skeleton de carga inicial ---------- */
function PageSkeleton() {
  return (
    <div className="space-y-6 py-2">
      <Skeleton className="h-28 w-full rounded-2xl" />
      <Skeleton className="h-6 w-2/3" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
