"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MapPin,
  Phone,
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
import { usePublicPage, usePublicSlots, useBookPublicWithDeposit } from "@/lib/api/public-booking";
import { useBook } from "@/lib/api/generated/endpoints/public-booking/public-booking";
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
import type { PublicPage, StaffPublic, Slot } from "@/mocks/contract-extensions";

type Step = 1 | 2 | 3 | 4;

interface Selection {
  service: Service | null;
  staff: StaffPublic | null;
  slot: Slot | null;
}

export function PublicBookingPage({ slug }: { slug: string }) {
  const { data, isLoading, isError, refetch } = usePublicPage(slug);

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

function BookingShell({ slug, page }: { slug: string; page: PublicPage }) {
  const [step, setStep] = useState<Step>(1);
  const [sel, setSel] = useState<Selection>({ service: null, staff: null, slot: null });
  const [confirmed, setConfirmed] = useState<{ provisional: boolean } | null>(null);

  const multiStaff = page.staff.length > 1;

  // Avanza saltando el paso de staff si hay uno solo.
  function pickService(service: Service) {
    if (multiStaff) {
      setSel({ service, staff: null, slot: null });
      setStep(2);
    } else {
      setSel({ service, staff: page.staff[0], slot: null });
      setStep(3);
    }
  }

  function pickStaff(staff: StaffPublic) {
    setSel((s) => ({ ...s, staff, slot: null }));
    setStep(3);
  }

  function pickSlot(slot: Slot) {
    setSel((s) => ({ ...s, slot }));
    setStep(4);
  }

  function back() {
    if (step === 4) setStep(3);
    else if (step === 3) setStep(multiStaff ? 2 : 1);
    else if (step === 2) setStep(1);
  }

  if (confirmed) {
    return (
      <Confirmation
        page={page}
        sel={sel}
        provisional={confirmed.provisional}
        onReset={() => {
          setConfirmed(null);
          setSel({ service: null, staff: null, slot: null });
          setStep(1);
        }}
      />
    );
  }

  // Negocio nuevo / sin agenda configurada: no se puede reservar todavía.
  if (page.services.length === 0 || page.staff.length === 0) {
    return (
      <div>
        <BusinessHeader page={page} />
        <div className="mt-6">
          <EmptyState
            icon={<CalendarX2 className="size-5" />}
            title="Todavía no se puede reservar"
            message="Este negocio aún está configurando su agenda. Volvé a intentar más tarde."
          />
          {process.env.NODE_ENV !== "production" && (
            <div className="mx-auto mt-4 max-w-md rounded-lg border border-dashed border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              <p className="font-medium">Diagnóstico (solo en dev):</p>
              <p>
                Servicios recibidos: <strong>{page.services.length}</strong> · Staff recibido:{" "}
                <strong>{page.staff.length}</strong>.
              </p>
              {page.staff.length === 0 && (
                <p className="mt-1">
                  Si el negocio ya tiene profesionales cargados, el backend{" "}
                  <strong>no está devolviendo <code>staff</code> en <code>GET /r/{`{slug}`}</code></strong>.
                  La reserva necesita el staff (para elegir profesional y calcular horarios). Revisá
                  la consola para ver la respuesta cruda.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <BusinessHeader page={page} />
      <Stepper step={step} multiStaff={multiStaff} />

      <div className="mt-6">
        {step > 1 && (
          <button
            type="button"
            onClick={back}
            className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
            Volver
          </button>
        )}

        {step === 1 && (
          <ServiceStep services={page.services} onPick={pickService} />
        )}
        {step === 2 && (
          <StaffStep staff={page.staff} onPick={pickStaff} />
        )}
        {step === 3 && sel.service && sel.staff && (
          <SlotStep
            slug={slug}
            service={sel.service}
            staff={sel.staff}
            onPick={pickSlot}
          />
        )}
        {step === 4 && sel.service && sel.staff && sel.slot && (
          <ConfirmStep
            slug={slug}
            service={sel.service}
            staff={sel.staff}
            slot={sel.slot}
            onConfirmed={(provisional) => setConfirmed({ provisional })}
          />
        )}
      </div>
    </div>
  );
}

/* ---------- Header del negocio ---------- */
function BusinessHeader({ page }: { page: PublicPage }) {
  const { professional } = page;
  const b = professional.branding;
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        {professional.businessName}
      </h1>
      {b.bio && <p className="mt-1.5 text-sm text-muted-foreground">{b.bio}</p>}
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
        {b.address && (
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-3.5 text-accent" />
            {b.address}
          </span>
        )}
        {b.phone && (
          <span className="inline-flex items-center gap-1.5">
            <Phone className="size-3.5 text-accent" />
            {b.phone}
          </span>
        )}
      </div>
    </div>
  );
}

/* ---------- Stepper ---------- */
function Stepper({ step, multiStaff }: { step: Step; multiStaff: boolean }) {
  const labels = multiStaff
    ? ["Servicio", "Profesional", "Horario", "Confirmar"]
    : ["Servicio", "Horario", "Confirmar"];
  // Índice del paso actual dentro del set visible.
  const current = multiStaff ? step - 1 : step === 1 ? 0 : step - 2;

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
            {i < labels.length - 1 && (
              <span className="h-px flex-1 bg-border" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ---------- Paso 1: Servicio ---------- */
function ServiceStep({
  services,
  onPick,
}: {
  services: Service[];
  onPick: (s: Service) => void;
}) {
  if (services.length === 0) {
    return (
      <EmptyState
        title="Sin servicios disponibles"
        message="Este negocio todavía no publicó servicios para reservar."
      />
    );
  }
  return (
    <div>
      <h2 className="font-display text-lg font-semibold">Elegí el servicio</h2>
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
                <p className="font-display font-semibold tabular-nums">
                  {formatMoney(s.priceCents)}
                </p>
                <ArrowRight className="ml-auto mt-1 size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Paso 2: Profesional ---------- */
function StaffStep({
  staff,
  onPick,
}: {
  staff: StaffPublic[];
  onPick: (s: StaffPublic) => void;
}) {
  return (
    <div>
      <h2 className="font-display text-lg font-semibold">¿Con quién te atendés?</h2>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {staff.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onPick(s)}
            className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-5 text-center transition-colors hover:border-accent focus-visible:border-accent"
          >
            <span className="grid size-12 place-items-center rounded-full bg-muted font-display text-lg font-semibold text-foreground">
              {s.displayName.charAt(0)}
            </span>
            <span className="text-sm font-medium">{s.displayName}</span>
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
  staff,
  onPick,
}: {
  slug: string;
  service: Service;
  staff: StaffPublic;
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

  // Una sola consulta para todo el rango: sirve para los horarios del día activo y
  // para saber qué días tienen atención (y marcar el resto como cerrado).
  const range = useMemo(() => {
    const from = new Date(days[0]);
    const to = new Date(days[days.length - 1]);
    to.setHours(23, 59, 59, 999);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [days]);

  const { data: slots, isLoading, isError, refetch } = usePublicSlots(slug, {
    staffId: staff.id,
    serviceId: service.id,
    from: range.from,
    to: range.to,
  });

  // Días (yyyy-MM-dd) que tienen al menos un slot.
  const daysWithSlots = useMemo(() => {
    const set = new Set<string>();
    for (const s of slots ?? []) {
      set.add(new Date(s.startAt).toDateString());
    }
    return set;
  }, [slots]);

  const dayHasSlots = (d: Date) => daysWithSlots.has(d.toDateString());
  const daySlots = (slots ?? []).filter((s) => isSameDay(s.startAt, activeDay));

  // Si el día activo no tiene atención, saltar al primer día disponible.
  useEffect(() => {
    if (daysWithSlots.size === 0) return;
    if (daysWithSlots.has(activeDay.toDateString())) return;
    const firstOpen = days.find((d) => daysWithSlots.has(d.toDateString()));
    if (firstOpen) setActiveDay(firstOpen);
  }, [daysWithSlots, activeDay, days]);

  return (
    <div>
      <h2 className="font-display text-lg font-semibold">Elegí día y hora</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {service.name} · {formatDuration(service.durationMinutes)}
        {staff && <> · con {staff.displayName}</>}
      </p>

      {/* Selector de día (scroll horizontal, mobile-first).
          Días sin atención: atenuados, en rojo suave y no seleccionables. */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
        {days.map((d) => {
          const chip = formatDayChip(d);
          const active = isSameDay(d, activeDay);
          // Solo marcamos "cerrado" una vez que tenemos datos del rango.
          const closed = !isLoading && !isError && !dayHasSlots(d);
          return (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => !closed && setActiveDay(d)}
              disabled={closed}
              aria-label={
                closed
                  ? `${chip.weekday} ${chip.day} — sin atención`
                  : `${chip.weekday} ${chip.day}`
              }
              className={cn(
                "relative flex shrink-0 flex-col items-center rounded-xl border px-3.5 py-2.5 transition-colors",
                active && "border-accent bg-accent/10 text-accent",
                !active && closed &&
                  "cursor-not-allowed border-destructive/25 bg-destructive/5 text-destructive/60",
                !active && !closed &&
                  "border-border text-muted-foreground hover:border-accent/50",
              )}
            >
              <span className="text-[11px] uppercase">{chip.weekday}</span>
              <span className="font-display text-base font-semibold tabular-nums">
                {chip.day}
              </span>
              {closed && (
                <span className="mt-0.5 text-[9px] font-medium uppercase tracking-wide">
                  Cerrado
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Horarios */}
      <div className="mt-4">
        {isLoading && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded-lg" />
            ))}
          </div>
        )}
        {isError && (
          <ErrorState
            message="No pudimos cargar los horarios."
            onRetry={() => refetch()}
          />
        )}
        {!isLoading && !isError && daySlots.length === 0 && (
          <EmptyState
            icon={<CalendarX2 className="size-5" />}
            title="Sin horarios este día"
            message="Probá con otra fecha de la lista."
          />
        )}
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
  service,
  staff,
  slot,
  onConfirmed,
}: {
  slug: string;
  service: Service;
  staff: StaffPublic;
  slot: Slot;
  onConfirmed: (provisional: boolean) => void;
}) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const options = getPaymentOptions(service);
  const hasNoPay = options.some((o) => o.choice === "none");
  const hasPaid = options.some((o) => o.requiresPayment);

  const book = useBook();
  const bookWithDeposit = useBookPublicWithDeposit(slug);
  const submitting = book.isPending || bookWithDeposit.isPending;
  const failed = book.isError || bookWithDeposit.isError;

  const canSubmit = fullName.trim().length > 1 && phone.trim().length > 5;

  function submit(option: PayOption) {
    const base = {
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      staffId: staff.id,
      serviceId: service.id,
      startAt: slot.startAt,
    };
    if (option.paymentOption) {
      bookWithDeposit.mutate(
        { ...base, method: "mercadopago", paymentOption: option.paymentOption },
        {
          onSuccess: (res) => {
            // El back devuelve el punto de pago de MercadoPago: redirigimos para abonar.
            // En modo mock no salimos a MP: confirmamos el turno asegurado directamente.
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
      book.mutate(
        { slug, data: base },
        { onSuccess: (appt) => onConfirmed(!!appt?.isProvisional) },
      );
    }
  }

  return (
    <div>
      <h2 className="font-display text-lg font-semibold">Confirmá tu turno</h2>

      {/* Resumen */}
      <div className="mt-4 rounded-xl border border-border bg-card p-4">
        <Row label="Servicio" value={service.name} />
        <Row label="Profesional" value={staff.displayName} />
        <Row label="Cuándo" value={`${formatDateLong(slot.startAt)} · ${formatTime(slot.startAt)}`} />
        <Row label="Precio" value={formatMoney(service.priceCents)} strong />
      </div>

      {/* Si hay pago opcional, aclaramos que sin pagar queda provisional. */}
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

      {/* Datos del cliente */}
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
          No pudimos confirmar el turno. Probá de nuevo.
        </p>
      )}

      {/* Acciones: solo las opciones de pago habilitadas por el profesional. */}
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
              // El primer botón (o el único) es el primario; el resto, secundario.
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
  page: PublicPage;
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
      {sel.service && sel.staff && sel.slot && (
        <p className="mt-2 text-muted-foreground">
          {sel.service.name} con {sel.staff.displayName}
          <br />
          {formatDateLong(sel.slot.startAt)} · {formatTime(sel.slot.startAt)}
        </p>
      )}
      {provisional && (
        <p className="mx-auto mt-4 max-w-sm rounded-xl border border-warning/40 bg-warning/10 p-3.5 text-sm text-warning-foreground">
          Recordá: sin seña tu turno es provisional y puede ser tomado por quien abone.
          Te enviamos los datos para asegurarlo.
        </p>
      )}
      <p className="mt-4 text-sm text-muted-foreground">
        Te avisaremos por WhatsApp. {page.professional.businessName} te espera.
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
