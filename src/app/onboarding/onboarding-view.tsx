"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Store,
  Link2,
  Check,
  Plus,
  Scissors,
  Users,
  Clock,
  PartyPopper,
  Wallet,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/components/auth-provider";
import {
  useProfessionalsOnboard,
  useProfessionalsListStaff,
  useProfessionalsCreateStaff,
} from "@/lib/api/generated/endpoints/professionals/professionals";
import { availabilityCreateScheduleRule } from "@/lib/api/generated/endpoints/availability/availability";
import { useServices, useCreateService } from "@/lib/api/catalog";
import { useMpStatus } from "@/lib/api/billing";
import { ScheduleRuleKind } from "@/lib/api/generated/model/scheduleRuleKind";
import { paymentSummary } from "@/lib/deposit";
import { formatMoney, formatDuration, titleCaseName } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AxiosError } from "axios";
import type { Service } from "@/lib/api/generated/model/service";
import type { Staff } from "@/lib/api/generated/model/staff";

/** Convierte un nombre en un slug URL-safe (minúsculas, guiones, sin acentos). */
function toSlug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const TIMEZONES = [
  { value: "America/Argentina/Buenos_Aires", label: "Buenos Aires (centro/este)" },
  { value: "America/Argentina/Mendoza", label: "Mendoza" },
  { value: "America/Argentina/Cordoba", label: "Córdoba" },
  { value: "America/Argentina/Salta", label: "Salta / NOA" },
  { value: "America/Argentina/Tucuman", label: "Tucumán" },
  { value: "America/Argentina/Ushuaia", label: "Ushuaia / Sur" },
];

const STEPS = ["Negocio", "Servicios", "Equipo", "Horarios"] as const;
type Step = 1 | 2 | 3 | 4 | 5;

export function OnboardingView() {
  const router = useRouter();
  const { user } = useAuth();
  // Un profesional ya onboardeado no debería ver el asistente.
  // Si ya tiene negocio (register-professional creó el comercio-de-uno), arrancamos en
  // Servicios y saltamos el paso 1; si no, empezamos creando el negocio.
  const [hadTenant] = useState(() => !!user?.professionalId);
  const [step, setStep] = useState<Step>(hadTenant ? 2 : 1);

  return (
    <div className="min-h-dvh bg-background">
      <header className="mx-auto flex max-w-lg items-center justify-between px-5 py-5">
        <Logo size="sm" />
        <ThemeToggle />
      </header>

      <main className="mx-auto max-w-lg px-5 pb-16">
        {step <= 4 && <Stepper step={step} />}

        {step === 1 && <BusinessStep onDone={() => setStep(2)} />}
        {step === 2 && <ServicesStep onNext={() => setStep(3)} />}
        {step === 3 && <StaffStep onNext={() => setStep(4)} />}
        {step === 4 && <ScheduleStep onNext={() => setStep(5)} />}
        {step === 5 && <DoneStep onFinish={() => router.replace("/app")} />}
      </main>
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  return (
    <ol className="mb-7 flex items-center gap-2">
      {STEPS.map((label, i) => {
        const n = (i + 1) as Step;
        const state = n < step ? "done" : n === step ? "current" : "todo";
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold",
                state === "done" && "bg-accent text-accent-foreground",
                state === "current" && "border-2 border-accent text-accent",
                state === "todo" && "border border-border text-muted-foreground",
              )}
            >
              {state === "done" ? <Check className="size-3.5" /> : n}
            </span>
            <span className={cn("hidden text-xs font-medium sm:inline", state === "todo" ? "text-muted-foreground" : "text-foreground")}>
              {label}
            </span>
            {i < STEPS.length - 1 && <span className="h-px flex-1 bg-border" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

function StepHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <span className="grid size-11 place-items-center rounded-2xl bg-accent/10 text-accent">{icon}</span>
      <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

/* ---------- Paso 1: Negocio ---------- */
function BusinessStep({ onDone }: { onDone: () => void }) {
  const { refresh } = useAuth();
  const onboard = useProfessionalsOnboard();
  const [businessName, setBusinessName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [address, setAddress] = useState("");
  const [timezone, setTimezone] = useState(TIMEZONES[0].value);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slugTouched) setSlug(toSlug(businessName));
  }, [businessName, slugTouched]);

  const canSubmit = businessName.trim().length > 1 && slug.length > 1;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    onboard.mutate(
      { data: { businessName: businessName.trim(), slug, timezone, address: address.trim() || undefined } },
      {
        onSuccess: async () => {
          await refresh(); // toma el professionalId nuevo
          onDone();
        },
        onError: (err) => {
          const s = (err as AxiosError).response?.status;
          setError(
            s === 409 || s === 400
              ? "Ese enlace ya está en uso o los datos no son válidos. Probá con otro nombre/enlace."
              : "No pudimos crear tu negocio. Probá de nuevo.",
          );
        },
      },
    );
  }

  return (
    <>
      <StepHeader
        icon={<Store className="size-6" />}
        title="Configurá tu negocio"
        subtitle="Creamos tu agenda y tu página pública. Tenés 15 días de prueba gratis."
      />
      <form onSubmit={submit} className="space-y-5">
        <div>
          <Label htmlFor="biz">Nombre del negocio</Label>
          <Input id="biz" className="mt-1.5" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Ej: Peluquería del Pueblo" autoFocus required />
        </div>
        <div>
          <Label htmlFor="slug">Tu enlace público</Label>
          <div className="mt-1.5 flex items-center rounded-lg border border-input bg-card pl-3 focus-within:ring-2 focus-within:ring-ring">
            <Link2 className="size-4 shrink-0 text-muted-foreground" />
            <span className="select-none pl-2 text-sm text-muted-foreground">costaturnos.com.ar/r/</span>
            <input
              id="slug"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(toSlug(e.target.value));
              }}
              placeholder="mi-negocio"
              className="h-10 w-full bg-transparent pr-3 text-sm outline-none"
              required
            />
          </div>
        </div>
        <div>
          <Label htmlFor="addr">Dirección <span className="text-muted-foreground">(opcional)</span></Label>
          <Input id="addr" className="mt-1.5" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Belgrano 245, Costa de Araujo, Mendoza" />
        </div>
        <div>
          <Label htmlFor="tz">Zona horaria</Label>
          <select id="tz" aria-label="Zona horaria" value={timezone} onChange={(e) => setTimezone(e.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
          </select>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" size="lg" className="w-full" loading={onboard.isPending} disabled={!canSubmit}>
          {onboard.isPending ? "Creando tu negocio…" : "Continuar"}
        </Button>
      </form>
    </>
  );
}

/* ---------- Paso 2: Servicios ---------- */
function ServicesStep({ onNext }: { onNext: () => void }) {
  const list = useServices();
  const create = useCreateService();
  const services = (list.data ?? []).filter((s) => s.isActive);
  const mp = useMpStatus();
  const mpConnected = mp.data?.connected ?? false;

  const [name, setName] = useState("");
  const [duration, setDuration] = useState("30");
  const [price, setPrice] = useState("");
  const [allowNoPayment, setAllowNoPayment] = useState(true);
  const [allowDeposit, setAllowDeposit] = useState(false);
  const [allowFullPayment, setAllowFullPayment] = useState(false);
  // Efectivo: precio completo en persona, sin IVA y sin requerir MercadoPago.
  const [allowCash, setAllowCash] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");

  const anyOption = allowNoPayment || allowDeposit || allowFullPayment || allowCash;
  const wantPaid = allowDeposit || allowFullPayment;
  const canAdd =
    name.trim().length > 1 &&
    Number(duration) > 0 &&
    Number(price) >= 0 &&
    anyOption &&
    (!allowDeposit || Number(depositAmount) > 0);

  function add() {
    // Sin MP conectado, las opciones de cobro online no se persisten (el back las rechaza).
    // El profesional puede activarlas después desde Configuración → Cobros.
    const deposit = allowDeposit && mpConnected;
    const fullPayment = allowFullPayment && mpConnected;
    create.mutate(
      {
        name: name.trim(),
        durationMinutes: Number(duration),
        priceCents: Math.round(Number(price) * 100),
        allowNoPayment,
        allowDeposit: deposit,
        allowFullPayment: fullPayment,
        allowCash,
        depositAmountCents: deposit ? Math.round(Number(depositAmount) * 100) : undefined,
      },
      {
        onSuccess: () => {
          setName("");
          setPrice("");
          setDepositAmount("");
          setAllowNoPayment(true);
          setAllowDeposit(false);
          setAllowFullPayment(false);
          setAllowCash(false);
        },
      },
    );
  }

  return (
    <>
      <StepHeader
        icon={<Scissors className="size-6" />}
        title="Cargá tus servicios"
        subtitle="Lo que ofrecés y cuánto sale. Podés agregar más después."
      />

      {services.length > 0 && (
        <ul className="mb-5 space-y-2">
          {services.map((s: Service) => (
            <li key={s.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-3 text-sm">
              <div>
                <p className="font-medium">{titleCaseName(s.name)}</p>
                <p className="text-xs text-muted-foreground">{formatDuration(s.durationMinutes)} · {formatMoney(s.priceCents)}</p>
              </div>
              {paymentSummary(s) && <Badge variant="muted">{paymentSummary(s)}</Badge>}
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-3 rounded-2xl border border-dashed border-border p-4">
        <div>
          <Label htmlFor="svc-name">Servicio</Label>
          <Input id="svc-name" className="mt-1.5" value={name} onChange={(e) => setName(e.target.value)} placeholder="Corte de pelo" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="svc-dur">Duración (min)</Label>
            <Input id="svc-dur" type="number" min={5} step={5} className="mt-1.5" value={duration} onChange={(e) => setDuration(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="svc-price">Precio ($)</Label>
            <Input id="svc-price" type="number" min={0} className="mt-1.5" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="8000" />
          </div>
        </div>
        <div>
          <Label>Cómo se puede reservar</Label>
          <p className="mb-1.5 mt-0.5 text-xs text-muted-foreground">Marcá una o varias.</p>
          <div className="flex flex-wrap gap-2">
            <PayChip label="Sin pago" checked={allowNoPayment} onToggle={() => setAllowNoPayment((v) => !v)} />
            <PayChip label="Con seña" checked={allowDeposit} onToggle={() => setAllowDeposit((v) => !v)} />
            <PayChip label="Pago completo" checked={allowFullPayment} onToggle={() => setAllowFullPayment((v) => !v)} />
            <PayChip label="Efectivo" checked={allowCash} onToggle={() => setAllowCash((v) => !v)} />
          </div>
          {allowDeposit && (
            <div className="mt-2.5">
              <Label htmlFor="svc-depamt">Monto de la seña ($)</Label>
              <Input id="svc-depamt" type="number" min={0} className="mt-1.5" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="2000" />
            </div>
          )}
          {wantPaid && !mpConnected && (
            <div className="mt-2 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning-foreground">
              <Wallet className="mt-0.5 size-4 shrink-0" />
              <span>
                Para cobrar con seña o pago completo necesitás{" "}
                <strong>conectar MercadoPago</strong>. Podés hacerlo después del registro desde{" "}
                Configuración → Cobros, y activar estas opciones en el servicio.
              </span>
            </div>
          )}
        </div>
        <Button variant="outline" className="w-full" onClick={add} disabled={!canAdd} loading={create.isPending}>
          {!create.isPending && <Plus className="size-4" />}
          Agregar servicio
        </Button>
      </div>

      <StepNav
        onNext={onNext}
        nextLabel={services.length > 0 ? "Continuar" : "Lo hago después"}
        hint={services.length === 0 ? "Te conviene cargar al menos uno para poder recibir reservas." : undefined}
      />
    </>
  );
}

/* ---------- Paso 3: Quién atiende ---------- */
function StaffStep({ onNext }: { onNext: () => void }) {
  const { user } = useAuth();
  const list = useProfessionalsListStaff();
  const create = useProfessionalsCreateStaff();
  const staff = (list.data ?? []).filter((s: Staff) => s.isActive);
  const ownerFirst = (user?.fullName ?? "").trim().split(" ")[0];
  const [name, setName] = useState("");

  function addName(value: string) {
    const v = value.trim();
    if (v.length < 1) return;
    create.mutate(
      { data: { displayName: v } },
      { onSuccess: () => { setName(""); list.refetch(); } },
    );
  }

  return (
    <>
      <StepHeader
        icon={<Users className="size-6" />}
        title="¿Quién atiende?"
        subtitle="Si atendés vos solo/a, agregate. Y si trabajás con más gente (o tenés varias 'sillas'/boxes), sumalas también — cada una tiene su propia agenda."
      />

      {/* Lo ya agregado */}
      {staff.length > 0 && (
        <ul className="mb-5 space-y-2">
          {staff.map((s: Staff) => (
            <li key={s.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-sm">
              <span className="grid size-9 place-items-center rounded-full bg-accent/10 font-display text-sm font-semibold text-accent">
                {s.displayName.charAt(0).toUpperCase()}
              </span>
              <span className="font-medium">{titleCaseName(s.displayName)}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Atajo "soy yo" para el local de una sola persona */}
      {staff.length === 0 && ownerFirst && (
        <button
          type="button"
          onClick={() => addName(ownerFirst)}
          disabled={create.isPending}
          className="mb-3 flex w-full items-center gap-3 rounded-2xl border border-accent/40 bg-accent/5 p-3.5 text-left transition-colors hover:bg-accent/10 disabled:opacity-60"
        >
          <span className="grid size-10 place-items-center rounded-full bg-accent/15 font-display text-base font-semibold text-accent">
            {ownerFirst.charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">Atiendo yo — {ownerFirst}</span>
            <span className="block text-xs text-muted-foreground">Tocá para agregarte como quien atiende</span>
          </span>
          <Plus className="size-4 shrink-0 text-accent" />
        </button>
      )}

      {/* Sumar otra persona / silla (cualquiera puede agregar más) */}
      <div className="flex items-end gap-2 rounded-2xl border border-dashed border-border p-4">
        <div className="flex-1">
          <Label htmlFor="staff-name">{staff.length === 0 ? "...o agregá a alguien" : "Sumá a alguien más"}</Label>
          <Input
            id="staff-name"
            className="mt-1.5"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addName(name);
              }
            }}
            placeholder="Ej: Lucía, Tomás, Silla 1…"
          />
        </div>
        <Button variant="outline" onClick={() => addName(name)} disabled={name.trim().length < 1} loading={create.isPending}>
          {!create.isPending && <Plus className="size-4" />}
          Agregar
        </Button>
      </div>

      {staff.length >= 1 && (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          ¿Trabajás con más gente? Sumá a quien quieras acá arriba. Después podés darle a cada
          uno sus propios horarios desde <span className="font-medium text-foreground">Horarios</span>.
        </p>
      )}

      <StepNav
        onNext={onNext}
        nextLabel={staff.length > 0 ? "Continuar" : "Lo hago después"}
        hint={staff.length === 0 ? "Agregá al menos a vos para poder recibir reservas." : undefined}
      />
    </>
  );
}

/* ---------- Paso 4: Horarios ---------- */
const DAYS = [
  { n: 1, label: "Lun" },
  { n: 2, label: "Mar" },
  { n: 3, label: "Mié" },
  { n: 4, label: "Jue" },
  { n: 5, label: "Vie" },
  { n: 6, label: "Sáb" },
  { n: 0, label: "Dom" },
];

function ScheduleStep({ onNext }: { onNext: () => void }) {
  const list = useProfessionalsListStaff();
  const staff = (list.data ?? []).filter((s: Staff) => s.isActive);
  const [days, setDays] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]));
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("18:00");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(d: number) {
    setDays((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  }

  async function saveAndNext() {
    setError(null);
    if (staff.length === 0 || days.size === 0) {
      onNext();
      return;
    }
    setSaving(true);
    try {
      // Mismo horario para todo el equipo (lo pueden ajustar luego en Horarios).
      await Promise.all(
        staff.flatMap((s) =>
          [...days].map((d) =>
            availabilityCreateScheduleRule(s.id, {
              dayOfWeek: d,
              startTime: start,
              endTime: end,
              kind: ScheduleRuleKind.work,
            }),
          ),
        ),
      );
      onNext();
    } catch {
      setError("No pudimos guardar los horarios. Podés cargarlos después en Horarios.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <StepHeader
        icon={<Clock className="size-6" />}
        title="Tus horarios de atención"
        subtitle="Elegí los días y el rango horario. Se aplica a todo tu equipo (lo ajustás después)."
      />

      <div className="space-y-4">
        <div>
          <Label>Días que atendés</Label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {DAYS.map((d) => {
              const on = days.has(d.n);
              return (
                <button
                  key={d.n}
                  type="button"
                  onClick={() => toggle(d.n)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                    on ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:border-accent/50",
                  )}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="sch-start">Desde</Label>
            <Input id="sch-start" type="time" className="mt-1.5" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="sch-end">Hasta</Label>
            <Input id="sch-end" type="time" className="mt-1.5" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
        {staff.length === 0 && (
          <p className="rounded-lg border border-warning/40 bg-warning/10 p-2.5 text-xs text-warning-foreground">
            No tenés a nadie en el equipo todavía. Podés volver al paso anterior o cargar los horarios más tarde.
          </p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <div className="mt-7 space-y-2">
        <Button className="w-full" size="lg" onClick={saveAndNext} loading={saving}>
          {saving ? "Guardando…" : "Guardar y finalizar"}
        </Button>
        <button type="button" onClick={onNext} className="block w-full text-center text-sm text-muted-foreground hover:text-foreground">
          Lo hago después
        </button>
      </div>
    </>
  );
}

/* ---------- Paso 5: Listo ---------- */
function DoneStep({ onFinish }: { onFinish: () => void }) {
  return (
    <div className="py-6 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent/10 text-accent">
        <PartyPopper className="size-7" />
      </span>
      <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight">¡Tu negocio está listo!</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        Ya podés gestionar tus turnos. Cualquier cosa que falte, te la vamos recordando desde el panel.
      </p>
      <Button size="lg" className="mt-6 w-full" onClick={onFinish}>
        Ir a mi panel
      </Button>
    </div>
  );
}

/* ---------- Chip de forma de pago (toggle) ---------- */
function PayChip({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
        checked ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:border-accent/50",
      )}
    >
      {checked && <Check className="size-3.5" />}
      {label}
    </button>
  );
}

/* ---------- Navegación de paso (opcional / continuar) ---------- */
function StepNav({ onNext, nextLabel, hint }: { onNext: () => void; nextLabel: string; hint?: string }) {
  return (
    <div className="mt-7">
      {hint && <p className="mb-2 text-center text-xs text-muted-foreground">{hint}</p>}
      <Button className="w-full" size="lg" onClick={onNext}>
        {nextLabel}
      </Button>
    </div>
  );
}
