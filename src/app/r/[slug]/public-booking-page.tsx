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
  usePublicProfessional,
  usePublicProfessionalSlots,
  usePublicProfessionalDayAvailability,
  useBookProfessional,
  useBookProfessionalWithDeposit,
} from "@/lib/api/public-booking";
import { getPaymentOptions, paymentSummary, type PayOption } from "@/lib/deposit";
import { env } from "@/lib/env";
import {
  formatMoney,
  formatDuration,
  formatDayChip,
  formatTime,
  formatDateLong,
  isSameDay,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Service } from "@/lib/api/generated/model/service";
import type { ComercioPublicPageDto } from "@/lib/api/generated/model/comercioPublicPageDto";
import type { PublicProfessionalDto } from "@/lib/api/generated/model/publicProfessionalDto";
import type { DayAvailabilityDto } from "@/lib/api/generated/model/dayAvailabilityDto";
import { DayAvailabilityStatus } from "@/lib/api/generated/model/dayAvailabilityStatus";
import type { Slot } from "@/mocks/contract-extensions";
import type { AxiosError } from "axios";

/** Clave local YYYY-MM-DD para casar una fecha con el `date` del DayAvailabilityDto. */
function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Etiqueta corta para el chip de un día no reservable (motivo de time_off o "Cerrado"). */
function dayBlockLabel(avail: DayAvailabilityDto | undefined): string {
  if (!avail) return "Cerrado";
  if (avail.status === DayAvailabilityStatus.time_off) return avail.reason?.trim() || "Bloqueado";
  if (avail.status === DayAvailabilityStatus.full) return "Completo";
  return "Cerrado";
}

type Step = 1 | 2 | 3 | 4;

interface Selection {
  professional: PublicProfessionalDto | null;
  service: Service | null;
  slot: Slot | null;
}

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
  const professionals = page.professionals ?? [];
  // Comercio-de-uno o con un solo profesional: autoseleccionamos y arrancamos en "Servicio".
  const single = page.isPersonal || professionals.length === 1;
  const soleProfessional = single ? (professionals[0] ?? null) : null;

  const [step, setStep] = useState<Step>(single ? 2 : 1);
  const [sel, setSel] = useState<Selection>({
    professional: soleProfessional,
    service: null,
    slot: null,
  });
  const [confirmed, setConfirmed] = useState<{ provisional: boolean } | null>(null);

  function pickProfessional(professional: PublicProfessionalDto) {
    setSel({ professional, service: null, slot: null });
    setStep(2);
  }
  function pickService(service: Service) {
    setSel((s) => ({ ...s, service, slot: null }));
    setStep(3);
  }
  function pickSlot(slot: Slot) {
    setSel((s) => ({ ...s, slot }));
    setStep(4);
  }

  function back() {
    if (step === 4) setStep(3);
    else if (step === 3) setStep(2);
    else if (step === 2) setStep(single ? 2 : 1);
  }

  function reset() {
    setConfirmed(null);
    setSel({ professional: soleProfessional, service: null, slot: null });
    setStep(single ? 2 : 1);
  }

  if (confirmed) {
    return <Confirmation page={page} sel={sel} provisional={confirmed.provisional} onReset={reset} />;
  }

  // Comercio sin profesionales: no se puede reservar todavía.
  if (professionals.length === 0) {
    return (
      <div>
        <ComercioHeader page={page} />
        <div className="mt-6">
          <EmptyState
            icon={<CalendarX2 className="size-5" />}
            title="Todavía no se puede reservar"
            message="Este negocio aún está configurando su agenda. Volvé a intentar más tarde."
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <ComercioHeader page={page} />
      <Stepper step={step} single={single} />

      <div className="mt-6">
        {(step > 1 && !single) || (step > 2 && single) ? (
          <button
            type="button"
            onClick={back}
            className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
            Volver
          </button>
        ) : null}

        {step === 1 && <ProfessionalStep professionals={professionals} onPick={pickProfessional} />}
        {step === 2 && sel.professional && (
          <ServiceStep slug={slug} membershipId={sel.professional.membershipId} onPick={pickService} />
        )}
        {step === 3 && sel.professional && sel.service && (
          <SlotStep
            slug={slug}
            membershipId={sel.professional.membershipId}
            service={sel.service}
            professional={sel.professional}
            onPick={pickSlot}
          />
        )}
        {step === 4 && sel.professional && sel.service && sel.slot && (
          <ConfirmStep
            slug={slug}
            professional={sel.professional}
            service={sel.service}
            slot={sel.slot}
            onConfirmed={(provisional) => setConfirmed({ provisional })}
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
function Stepper({ step, single }: { step: Step; single: boolean }) {
  const labels = single
    ? ["Servicio", "Horario", "Confirmar"]
    : ["Profesional", "Servicio", "Horario", "Confirmar"];
  // Índice del paso actual dentro del set visible (en single, el paso 1 no existe).
  const current = single ? step - 2 : step - 1;

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

/* ---------- Paso 1: Profesional ---------- */
function ProfessionalStep({
  professionals,
  onPick,
}: {
  professionals: PublicProfessionalDto[];
  onPick: (p: PublicProfessionalDto) => void;
}) {
  return (
    <div>
      <h2 className="font-display text-lg font-semibold">¿Con quién te atendés?</h2>
      <div className="mt-4 space-y-3">
        {professionals.map((p) => (
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

/* ---------- Paso 2: Servicio (del profesional elegido) ---------- */
function ServiceStep({
  slug,
  membershipId,
  onPick,
}: {
  slug: string;
  membershipId: string;
  onPick: (s: Service) => void;
}) {
  const { data, isLoading, isError, refetch } = usePublicProfessional(slug, membershipId);
  const services = (data?.services ?? []).filter((s) => s.isActive);

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

  return (
    <div>
      <h2 className="font-display text-lg font-semibold">Elegí el servicio</h2>
      {data?.address && (
        <p className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="size-3.5 text-accent" />
          {data.displayName} · {data.address}
        </p>
      )}
      {services.length === 0 ? (
        <EmptyState
          className="mt-4"
          title="Sin servicios disponibles"
          message="Este profesional todavía no publicó servicios para reservar."
        />
      ) : (
        <div className="mt-4 space-y-3">
          {services.map((s) => {
            const summary = paymentSummary(s);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onPick(s)}
                className="group flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-accent focus-visible:border-accent"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{s.name}</p>
                  <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock3 className="size-3.5" />
                    {formatDuration(s.durationMinutes)}
                  </p>
                  {summary && (
                    <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-accent">
                      <Info className="size-3" />
                      {summary}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-display font-semibold tabular-nums">{formatMoney(s.priceCents)}</p>
                  <ArrowRight className="ml-auto mt-1 size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- Paso 3: Fecha y hora ---------- */
function SlotStep({
  slug,
  membershipId,
  service,
  professional,
  onPick,
}: {
  slug: string;
  membershipId: string;
  service: Service;
  professional: PublicProfessionalDto;
  onPick: (s: Slot) => void;
}) {
  // Próximos 14 días como opciones de fecha.
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

  const slotsParams = { serviceId: service.id, from: range.from, to: range.to };
  const { data: slots, isLoading, isError, refetch } = usePublicProfessionalSlots(
    slug,
    membershipId,
    slotsParams,
  );

  // Disponibilidad por día: señal confiable del back para deshabilitar/rotular cada día
  // (cerrado vs. bloqueo con motivo), en vez de inferirlo de la presencia de slots.
  const { data: availability } = usePublicProfessionalDayAvailability(slug, membershipId, slotsParams);

  // Indexada por fecha local YYYY-MM-DD para casar con el `date` del DTO (zona del comercio).
  const availByDate = useMemo(() => {
    const map = new Map<string, DayAvailabilityDto>();
    for (const a of availability ?? []) map.set(a.date, a);
    return map;
  }, [availability]);

  const dayAvail = (d: Date) => availByDate.get(localDateKey(d));
  // Reservable si el back lo dice; mientras todavía no llegó la disponibilidad, no bloqueamos.
  const isBookable = (d: Date) => {
    const a = dayAvail(d);
    return a ? a.bookable : true;
  };

  const daySlots = (slots ?? []).filter((s) => isSameDay(s.startAt, activeDay));

  // Si el día activo no es reservable, saltar al primer día disponible.
  useEffect(() => {
    if (availByDate.size === 0) return;
    if (isBookable(activeDay)) return;
    const firstOpen = days.find((d) => isBookable(d));
    if (firstOpen) setActiveDay(firstOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availByDate, activeDay, days]);

  return (
    <div>
      <h2 className="font-display text-lg font-semibold">Elegí día y hora</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {service.name} · {formatDuration(service.durationMinutes)} · con {professional.displayName}
      </p>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
        {days.map((d) => {
          const chip = formatDayChip(d);
          const active = isSameDay(d, activeDay);
          const avail = dayAvail(d);
          const blocked = !!avail && !avail.bookable;
          // Etiqueta corta según el motivo: time_off → su razón (o "Bloqueado"); resto → "Cerrado".
          const label = dayBlockLabel(avail);
          return (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => !blocked && setActiveDay(d)}
              disabled={blocked}
              aria-label={
                blocked ? `${chip.weekday} ${chip.day} — ${label}` : `${chip.weekday} ${chip.day}`
              }
              title={blocked && avail?.reason ? avail.reason : undefined}
              className={cn(
                "relative flex shrink-0 flex-col items-center rounded-xl border px-3.5 py-2.5 transition-colors",
                active && "border-accent bg-accent/10 text-accent",
                !active && blocked &&
                  "cursor-not-allowed border-destructive/25 bg-destructive/5 text-destructive/60",
                !active && !blocked && "border-border text-muted-foreground hover:border-accent/50",
              )}
            >
              <span className="text-[11px] uppercase">{chip.weekday}</span>
              <span className="font-display text-base font-semibold tabular-nums">{chip.day}</span>
              {blocked && (
                <span className="mt-0.5 max-w-[4.5rem] truncate text-[9px] font-medium uppercase tracking-wide">
                  {label}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        {isLoading && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded-lg" />
            ))}
          </div>
        )}
        {isError && <ErrorState message="No pudimos cargar los horarios." onRetry={() => refetch()} />}
        {!isLoading && !isError && daySlots.length === 0 && (() => {
          // Si el back marca el día como bloqueado/cerrado, mostramos el motivo en vez del genérico.
          const a = dayAvail(activeDay);
          const blocked = !!a && !a.bookable;
          return (
            <EmptyState
              icon={<CalendarX2 className="size-5" />}
              title={blocked ? dayBlockLabel(a) : "Sin horarios este día"}
              message={
                a?.status === DayAvailabilityStatus.time_off
                  ? "Ese día el profesional no atiende. Probá con otra fecha de la lista."
                  : "Probá con otra fecha de la lista."
              }
            />
          );
        })()}
        {!isLoading && !isError && daySlots.length > 0 && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {daySlots.map((slot) => (
              <button
                key={slot.startAt}
                type="button"
                onClick={() => onPick(slot)}
                className="rounded-lg border border-border py-2.5 font-display text-sm font-medium tabular-nums transition-colors hover:border-accent hover:bg-accent/10 hover:text-accent focus-visible:border-accent"
              >
                {formatTime(slot.startAt)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Paso 4: Confirmar ---------- */
function ConfirmStep({
  slug,
  professional,
  service,
  slot,
  onConfirmed,
}: {
  slug: string;
  professional: PublicProfessionalDto;
  service: Service;
  slot: Slot;
  onConfirmed: (provisional: boolean) => void;
}) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const options = getPaymentOptions(service);
  const hasNoPay = options.some((o) => o.choice === "none");
  const hasPaid = options.some((o) => o.requiresPayment);

  const book = useBookProfessional(slug, professional.membershipId);
  const bookWithDeposit = useBookProfessionalWithDeposit(slug, professional.membershipId);
  const submitting = book.isPending || bookWithDeposit.isPending;
  // El back rechaza con 400 los turnos demasiado próximos (anticipación mínima del profesional) o
  // ya tomados: el horario dejó de estar disponible. Otros fallos son errores técnicos genéricos.
  const bookError = (book.error ?? bookWithDeposit.error) as AxiosError | null;
  const failed = book.isError || bookWithDeposit.isError;
  const slotUnavailable = bookError?.response?.status === 400;

  const canSubmit = fullName.trim().length > 1 && phone.trim().length > 5;

  function submit(option: PayOption) {
    const base = {
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      serviceId: service.id,
      startAt: slot.startAt,
    };
    if (option.paymentOption) {
      bookWithDeposit.mutate(
        { ...base, method: "mercadopago", paymentOption: option.paymentOption },
        {
          onSuccess: (res) => {
            // Redirigimos a MercadoPago para abonar (salvo en mock, que confirma directo).
            if (!env.mockingEnabled && res?.mpInitPoint) {
              window.location.href = res.mpInitPoint;
              return;
            }
            onConfirmed(false);
          },
        },
      );
    } else {
      // Sin pago: el turno puede quedar provisional (lo decide el back).
      book.mutate(base, { onSuccess: (appt) => onConfirmed(!!appt?.isProvisional) });
    }
  }

  return (
    <div>
      <h2 className="font-display text-lg font-semibold">Confirmá tu turno</h2>

      <div className="mt-4 rounded-xl border border-border bg-card p-4">
        <Row label="Servicio" value={service.name} />
        <Row label="Profesional" value={professional.displayName} />
        {professional.address && <Row label="Dónde" value={professional.address} />}
        <Row label="Cuándo" value={`${formatDateLong(slot.startAt)} · ${formatTime(slot.startAt)}`} />
        <Row label="Precio" value={formatMoney(service.priceCents)} strong />
      </div>

      {hasPaid && hasNoPay && (
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
          />
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
          />
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
          />
        </div>
      </div>

      {failed && (
        <p className="mt-3 text-sm text-destructive">
          {slotUnavailable
            ? "Ese horario ya no está disponible para reservar. Volvé atrás y elegí otro."
            : "No pudimos confirmar el turno. Probá de nuevo."}
        </p>
      )}

      <div className="mt-6 space-y-2.5">
        {options.map((opt, i) => {
          const label =
            opt.choice === "deposit"
              ? `Pagar seña y reservar · ${formatMoney(opt.amountCents)}`
              : opt.choice === "full"
                ? `Pagar el total · ${formatMoney(opt.amountCents)}`
                : hasPaid
                  ? "Reservar sin pagar"
                  : "Confirmar turno";
          return (
            <Button
              key={opt.choice}
              className="w-full"
              size="lg"
              variant={i === 0 ? "default" : "outline"}
              disabled={!canSubmit || submitting}
              onClick={() => submit(opt)}
            >
              {submitting && i === 0 ? <Spinner /> : null}
              {label}
            </Button>
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
  onReset,
}: {
  page: ComercioPublicPageDto;
  sel: Selection;
  provisional: boolean;
  onReset: () => void;
}) {
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
      {sel.service && sel.professional && sel.slot && (
        <p className="mt-2 text-muted-foreground">
          {sel.service.name} con {sel.professional.displayName}
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
