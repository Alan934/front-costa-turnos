import Link from "next/link";
import {
  Clock3,
  ArrowRight,
  MapPin,
  User,
  Store,
  CalendarCheck,
  CalendarClock,
  Wallet,
  Users,
  Check,
  QrCode,
  BellRing,
  Footprints,
  Calculator,
  BarChart3,
  Smartphone,
  Link2,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppointmentStatusBadge } from "@/components/appointment-status-badge";
import { AppointmentStatus } from "@/lib/api/generated/model/appointmentStatus";
import { env } from "@/lib/env";

/** Días de prueba gratis. Debe coincidir con SUBSCRIPTION_TRIAL_DAYS del back (default 15). */
const TRIAL_DAYS = 15;

/** Link a una página de reserva real para mostrar el producto (null => no se muestra). */
const demoHref = env.demoSlug ? `/r/${env.demoSlug}` : null;

const agenda = [
  { time: "10:00", name: "Sofía", svc: "Color + lavado", status: AppointmentStatus.in_progress, prov: false },
  { time: "11:30", name: "Martín", svc: "Kinesiología", status: AppointmentStatus.confirmed, prov: false },
  { time: "12:15", name: "Juan", svc: "Corte de pelo", status: AppointmentStatus.requested, prov: true },
  { time: "13:00", name: "Carla", svc: "Manicura", status: AppointmentStatus.done, prov: false },
];

// Para quién es: las dos formas de usar Costa Turnos.
const audiences = [
  {
    icon: User,
    tag: "Profesional",
    title: "Trabajás solo/a",
    desc: "Peluquero, barbero, kinesióloga, manicura, tatuador… Armás tu página de reservas en minutos y empezás a recibir turnos.",
    points: [
      "Tu propia página de reserva y QR",
      "Tus servicios, precios y horarios",
      "Turnos, orden de llegada o las dos cosas",
    ],
  },
  {
    icon: Store,
    tag: "Comercio",
    title: "Tenés un local con varios profesionales",
    desc: "Peluquería, barbería, centro de estética o consultorio. Sumás a tu equipo y el cliente elige con quién atenderse, o deja que le asignemos al que esté más libre.",
    points: [
      "Invitás a tu equipo por email",
      "Cada profesional con su agenda, servicios y sala",
      "Una sola página de reserva para todo el local",
    ],
  },
];

// Cómo funciona: el camino, contado simple.
const steps = [
  {
    n: "1",
    icon: CalendarCheck,
    title: "Creás tu cuenta",
    desc: "Cargás tus servicios, precios y los días y horarios en que atendés. Te lleva unos minutos.",
  },
  {
    n: "2",
    icon: Link2,
    title: "Compartís tu link y tu QR",
    desc: "Pasás tu página por WhatsApp o Instagram, e imprimís el QR para el local. El cliente reserva o se anota solo.",
  },
  {
    n: "3",
    icon: Clock3,
    title: "Atendés tranquilo/a",
    desc: "Ves los turnos del día, llamás al siguiente de la fila y al final cerrás la caja.",
  },
];

// Lo que hace por vos (solo lo que el producto hace hoy).
const features = [
  {
    icon: CalendarCheck,
    t: "Reserva online 24/7",
    b: "Tus clientes eligen servicio, profesional y horario desde el celu, a cualquier hora. Se terminan los mensajes para coordinar.",
  },
  {
    icon: Footprints,
    t: "Fila por orden de llegada",
    b: "Para los días o franjas sin turno: el cliente se anota con el QR del local y ve su lugar en la fila en vivo.",
  },
  {
    icon: Wallet,
    t: "Señas y pagos con MercadoPago",
    b: "Pedí una seña o el pago completo al reservar. La plata entra directo a tu cuenta de MercadoPago. También podés cobrar en efectivo.",
  },
  {
    icon: Calculator,
    t: "Cierre de caja",
    b: "Al final del día ves qué turnos quedan sin cerrar y quién te quedó debiendo.",
  },
  {
    icon: Users,
    t: "Clientes con su ficha",
    b: "Historial de turnos de cada cliente y una ficha con los datos que vos elijas guardar.",
  },
  {
    icon: BarChart3,
    t: "Métricas",
    b: "Turnos atendidos, ingresos, horarios pico y clientes que dejaron de venir. Y lo bajás a Excel.",
  },
  {
    icon: CalendarClock,
    t: "Horarios a tu medida",
    b: "Días, franjas, feriados y con cuánta anticipación se puede reservar. Nadie te toma un turno sobre la hora.",
  },
  {
    icon: Smartphone,
    t: "Tus clientes manejan sus turnos",
    b: "Desde “Mis turnos” ven sus reservas y pueden reprogramarlas solos, dentro de las reglas que pusiste.",
  },
  {
    icon: Store,
    t: "Equipo y varios locales",
    b: "Sumá a tu equipo y, si atendés en más de un lugar, manejá cada comercio desde la misma cuenta.",
  },
];

// Fila por orden de llegada: cómo lo vive el cliente.
const walkInPoints = [
  {
    icon: QrCode,
    t: "Escanea el QR del local",
    b: "Se anota en la fila con su nombre y teléfono, sin bajar ninguna app.",
  },
  {
    icon: Smartphone,
    t: "Ve su lugar en vivo",
    b: "Desde el celu sabe cuántos tiene adelante. Puede esperar afuera o ir a hacer otra cosa.",
  },
  {
    icon: BellRing,
    t: "Le avisamos cuando le toca",
    b: "Con una notificación en el celular. Y si querés, le escribís por WhatsApp con un toque.",
  },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-accent">
      {children}
    </p>
  );
}

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-8">
      {/* ---- Header ---- */}
      <header className="flex items-center justify-between gap-3 py-6">
        <Logo href="/" />
        <nav className="flex items-center gap-1.5 sm:gap-2">
          <ThemeToggle />
          {demoHref && (
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
              <Link href={demoHref}>Ver demo</Link>
            </Button>
          )}
          <Button size="sm" asChild>
            <Link href="/ingresar">Ingresar</Link>
          </Button>
        </nav>
      </header>

      <div className="h-px w-full bg-border" />

      {/* ---- Hero ---- */}
      <section className="grid items-center gap-14 py-16 lg:grid-cols-[1fr_0.85fr] lg:py-24">
        <div>
          <div className="animate-rise">
            <Eyebrow>Turnos online · Fila por orden de llegada · Cobros</Eyebrow>
          </div>
          <h1 className="animate-rise delay-1 mt-5 text-balance font-display text-5xl font-medium leading-[1.05] sm:text-6xl">
            Tus clientes reservan solos.{" "}
            <span className="text-muted-foreground">Vos atendés tranquilo.</span>
          </h1>
          <p className="animate-rise delay-2 mt-6 max-w-md text-pretty text-lg leading-relaxed text-muted-foreground">
            Una página de reservas, tu agenda, una fila virtual para los que llegan sin turno
            y las señas por MercadoPago. Todo en un solo lugar, sin coordinar turno por turno
            por WhatsApp.
          </p>
          <div className="animate-rise delay-3 mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Button size="lg" asChild>
              <Link href="/ingresar">
                Probar gratis {TRIAL_DAYS} días <ArrowRight className="size-4" />
              </Link>
            </Button>
            {demoHref && (
              <Button variant="link" size="lg" className="px-0" asChild>
                <Link href={demoHref}>Ver una página de reserva →</Link>
              </Button>
            )}
          </div>
          <p className="animate-rise delay-3 mt-4 text-sm text-muted-foreground">
            {TRIAL_DAYS} días gratis, sin cargar tarjeta.
          </p>
        </div>

        {/* Panel de agenda (demostración del producto) */}
        <div className="animate-rise delay-4 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <span className="font-display text-sm font-semibold">Hoy · Lucía</span>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-1.5 rounded-full bg-status-serving-foreground" />
              En vivo
            </span>
          </div>
          {agenda.map((r, i) => (
            <div
              key={r.time}
              className={`flex items-center gap-4 px-5 py-3.5 ${i > 0 ? "border-t border-border" : ""}`}
            >
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Clock3 className="size-3.5" />
                <span className="font-display text-[13px] tabular-nums">{r.time}</span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.name}</p>
                <p className="truncate text-xs text-muted-foreground">{r.svc}</p>
              </div>
              <AppointmentStatusBadge status={r.status} isProvisional={r.prov} />
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/40 px-5 py-3.5">
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Footprints className="size-4 text-accent" />
              3 esperando en la fila
            </span>
            <span className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium">
              Llamar al siguiente
            </span>
          </div>
        </div>
      </section>

      <div className="h-px w-full bg-border" />

      {/* ---- ¿Para quién es? ---- */}
      <section className="py-16 sm:py-20">
        <div className="max-w-2xl">
          <Eyebrow>¿Para quién es?</Eyebrow>
          <h2 className="mt-3 text-balance font-display text-3xl font-medium leading-tight sm:text-4xl">
            Da igual si trabajás solo/a o tenés un local.
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground">
            Costa Turnos se adapta a cómo trabajás. Empezá solo/a y sumá a tu equipo cuando
            quieras.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {audiences.map((a) => (
            <div key={a.tag} className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-7">
              <div className="flex items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted text-accent">
                  <a.icon className="size-5" />
                </span>
                <div>
                  <p className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-accent">
                    {a.tag}
                  </p>
                  <p className="font-display text-lg font-semibold leading-tight">{a.title}</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{a.desc}</p>
              <ul className="mt-5 space-y-2.5">
                {a.points.map((p) => (
                  <li key={p} className="flex items-start gap-2.5 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-accent" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <div className="h-px w-full bg-border" />

      {/* ---- Con turno o por orden de llegada ---- */}
      <section className="grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-[1fr_0.8fr]">
        <div>
          <Eyebrow>Con turno o por orden de llegada</Eyebrow>
          <h2 className="mt-3 text-balance font-display text-3xl font-medium leading-tight sm:text-4xl">
            Una fila virtual para los que llegan sin turno.
          </h2>
          <p className="mt-4 max-w-xl text-pretty text-muted-foreground">
            ¿Atendés por orden de llegada todo el día, algunos días o solo en ciertas franjas?
            Se combina con tus turnos: nadie se pisa y el local no se llena de gente esperando.
          </p>
          <ul className="mt-8 space-y-6">
            {walkInPoints.map((p) => (
              <li key={p.t} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-accent">
                  <p.icon className="size-5" />
                </span>
                <div>
                  <p className="font-display font-semibold">{p.t}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{p.b}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Lo que ve el cliente en su celular (demostración) */}
        <div className="mx-auto w-full max-w-xs rounded-[2rem] border border-border bg-card p-3 shadow-sm">
          <div className="rounded-[1.5rem] border border-border bg-background px-5 pb-6 pt-5">
            <p className="text-center text-xs text-muted-foreground">Sala de espera · Lucía</p>
            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">Tu lugar en la fila</p>
              <p className="mt-1 font-display text-6xl font-semibold tabular-nums text-accent">2°</p>
              <p className="mt-2 text-sm">Tenés 1 persona adelante</p>
            </div>
            <div className="mt-6 space-y-2">
              <div className="flex items-center gap-2.5 rounded-xl bg-status-serving px-3.5 py-2.5 text-sm text-status-serving-foreground">
                <span className="size-1.5 rounded-full bg-status-serving-foreground" />
                Atendiendo a Sofía
              </div>
              <div className="flex items-center gap-2.5 rounded-xl border border-border px-3.5 py-2.5 text-sm text-muted-foreground">
                <BellRing className="size-4 text-accent" />
                Te avisamos cuando te toque
              </div>
              <div className="flex items-center gap-2.5 rounded-xl border border-border px-3.5 py-2.5 text-sm text-muted-foreground">
                <MessageCircle className="size-4 text-accent" />
                El local también te puede escribir
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="h-px w-full bg-border" />

      {/* ---- ¿Cómo funciona? ---- */}
      <section className="py-16 sm:py-20">
        <div className="max-w-2xl">
          <Eyebrow>¿Cómo funciona?</Eyebrow>
          <h2 className="mt-3 text-balance font-display text-3xl font-medium leading-tight sm:text-4xl">
            Tres pasos y estás recibiendo clientes.
          </h2>
        </div>

        <ol className="mt-12 grid gap-8 md:grid-cols-3 md:gap-10">
          {steps.map((s) => (
            <li key={s.n}>
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-full bg-accent font-display text-sm font-semibold text-accent-foreground">
                  {s.n}
                </span>
                <s.icon className="size-5 text-muted-foreground" />
              </div>
              <p className="mt-4 font-display text-lg font-semibold">{s.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      <div className="h-px w-full bg-border" />

      {/* ---- Lo que hace por vos (features) ---- */}
      <section className="py-16 sm:py-20">
        <div className="max-w-2xl">
          <Eyebrow>Todo en un solo lugar</Eyebrow>
          <h2 className="mt-3 text-balance font-display text-3xl font-medium leading-tight sm:text-4xl">
            Lo que Costa Turnos hace por vos.
          </h2>
        </div>

        <div className="mt-12 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.t}>
              <span className="grid size-10 place-items-center rounded-xl bg-muted text-accent">
                <f.icon className="size-5" />
              </span>
              <p className="mt-4 font-display text-base font-semibold">{f.t}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- CTA final ---- */}
      <section className="my-8 overflow-hidden rounded-2xl border border-border bg-card px-6 py-12 text-center shadow-sm sm:px-12 sm:py-16">
        <h2 className="mx-auto max-w-xl text-balance font-display text-3xl font-medium leading-tight sm:text-4xl">
          Tu primera reserva online puede ser hoy.
        </h2>
        <p className="mx-auto mt-4 max-w-md text-pretty text-muted-foreground">
          Creá tu cuenta, cargá tus servicios y compartí tu link. Tenés {TRIAL_DAYS} días
          gratis para probarlo, sin cargar tarjeta.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Button size="lg" asChild>
            <Link href="/ingresar">
              Probar gratis <ArrowRight className="size-4" />
            </Link>
          </Button>
          {demoHref && (
            <Button variant="outline" size="lg" asChild>
              <Link href={demoHref}>Ver el demo</Link>
            </Button>
          )}
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          ¿Querés ver tus turnos como cliente?{" "}
          <Link href="/mis-turnos" className="font-medium text-foreground underline underline-offset-2">
            Mis turnos
          </Link>
        </p>
      </section>

      {/* ---- Footer ---- */}
      <footer className="flex flex-col items-center justify-between gap-3 border-t border-border py-8 text-center text-sm text-muted-foreground sm:flex-row sm:text-left">
        <p>© {new Date().getFullYear()} Costa Turnos · costaturnos.com</p>
        <p className="flex items-center gap-1.5">
          <MapPin className="size-4 text-accent" />
          Hecho en Costa de Araujo, Mendoza
        </p>
      </footer>
    </div>
  );
}
