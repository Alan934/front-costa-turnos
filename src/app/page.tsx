import Link from "next/link";
import {
  Clock3,
  ArrowRight,
  MapPin,
  User,
  Store,
  CalendarCheck,
  MonitorSmartphone,
  BellRing,
  Wallet,
  Users,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppointmentStatusBadge } from "@/components/appointment-status-badge";
import { AppointmentStatus } from "@/lib/api/generated/model/appointmentStatus";

const agenda = [
  { time: "10:00", name: "Sofía", svc: "Color + lavado", status: AppointmentStatus.in_progress, prov: false },
  { time: "11:30", name: "Martín", svc: "Kinesiología", status: AppointmentStatus.confirmed, prov: false },
  { time: "12:15", name: "Juan", svc: "Corte de pelo", status: AppointmentStatus.requested, prov: true },
  { time: "13:00", name: "Carla", svc: "Sesión con psicóloga", status: AppointmentStatus.done, prov: false },
];

// Para quién es: las dos formas de usar Costa Turnos.
const audiences = [
  {
    icon: User,
    tag: "Profesional",
    title: "Trabajás solo/a",
    desc: "Peluquero, kinesiólogo, psicóloga, tatuador, manicura… Armás tu página de reservas en minutos y empezás a recibir turnos. Gratis para empezar.",
    points: ["Tu propia página de reserva", "Tus servicios, precios y horarios", "Agenda y sala de espera incluidas"],
  },
  {
    icon: Store,
    tag: "Comercio",
    title: "Tenés un local con varios profesionales",
    desc: "Peluquería, centro de estética, consultorio o taller. Sumás a tu equipo, cada uno con su agenda, y el cliente elige con quién atenderse.",
    points: ["Invitás a tu equipo por email", "Cada profesional con su agenda y servicios", "Una sola página para todo el local"],
  },
];

// Cómo funciona: el camino, contado simple.
const steps = [
  {
    n: "1",
    icon: CalendarCheck,
    title: "Creás tu cuenta",
    desc: "Cargás tus servicios, precios y los días que atendés. Listo en unos minutos.",
  },
  {
    n: "2",
    icon: MonitorSmartphone,
    title: "Compartís tu link",
    desc: "Pasás tu página de reserva por WhatsApp, Instagram o donde quieras. El cliente elige y reserva solo.",
  },
  {
    n: "3",
    icon: Clock3,
    title: "Atendés tranquilo/a",
    desc: "Ves todos tus turnos del día, llamás al siguiente y mostrás la cola en una pantalla del local.",
  },
];

// Lo que hace por vos.
const features = [
  {
    icon: CalendarCheck,
    t: "Reserva online 24/7",
    b: "Tus clientes eligen servicio, profesional y horario desde el celu, a cualquier hora. Vos no contestás más mensajes para coordinar.",
  },
  {
    icon: MonitorSmartphone,
    t: "Sala de espera en vivo",
    b: "Una pantalla en tu local muestra a quién atendés y quién sigue. Sin gritar nombres ni perder el orden.",
  },
  {
    icon: BellRing,
    t: "Recordatorios automáticos",
    b: "Avisamos el turno por vos. Menos ausencias y menos huecos en la agenda.",
  },
  {
    icon: Wallet,
    t: "Seña al reservar (opcional)",
    b: "Pedí una seña para confirmar el turno y cuidá tu agenda de los que no aparecen.",
  },
  {
    icon: Users,
    t: "Equipo y comercios",
    b: "¿Sos varios? Sumá a tu equipo y manejá todas las agendas desde un solo lugar.",
  },
  {
    icon: Clock3,
    t: "Anticipación mínima",
    b: "Decidís con cuánta anticipación se puede reservar, para que nadie te tome un turno sobre la hora.",
  },
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-6 sm:px-8">
      {/* ---- Header ---- */}
      <header className="flex items-center justify-between py-6">
        <Logo href="/" />
        <nav className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="sm" asChild>
            <Link href="/r/peluqueria-del-pueblo">Ver demo</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/ingresar">Ingresar</Link>
          </Button>
        </nav>
      </header>

      <div className="h-px w-full bg-border" />

      {/* ---- Hero ---- */}
      <section className="grid items-center gap-14 py-16 lg:grid-cols-[1fr_0.85fr] lg:py-24">
        <div>
          <p className="animate-rise font-display text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            Para profesionales y comercios con turnos
          </p>
          <h1 className="animate-rise delay-1 mt-5 text-balance font-display text-5xl font-medium leading-[1.05] sm:text-6xl">
            Tus clientes reservan solos.{" "}
            <span className="text-muted-foreground">Vos atendés tranquilo.</span>
          </h1>
          <p className="animate-rise delay-2 mt-6 max-w-md text-pretty text-lg leading-relaxed text-muted-foreground">
            Costa Turnos te da una página de reservas, una agenda clara y una sala de
            espera en vivo. Sin papel y sin coordinar turno por turno por WhatsApp.
          </p>
          <div className="animate-rise delay-3 mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Button size="lg" asChild>
              <Link href="/ingresar">
                Empezar gratis <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button variant="link" size="lg" className="px-0" asChild>
              <Link href="/r/peluqueria-del-pueblo">Ver una página de reserva →</Link>
            </Button>
          </div>
          <p className="animate-rise delay-3 mt-4 text-sm text-muted-foreground">
            Empezás gratis. Sin tarjeta para probar.
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
          <div className="border-t border-border px-5 py-4">
            <Button variant="outline" className="w-full">
              Llamar al siguiente
            </Button>
          </div>
        </div>
      </section>

      <div className="h-px w-full bg-border" />

      {/* ---- ¿Para quién es? ---- */}
      <section className="py-16 sm:py-20">
        <div className="max-w-2xl">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            ¿Para quién es?
          </p>
          <h2 className="mt-3 text-balance font-display text-3xl font-medium leading-tight sm:text-4xl">
            Da igual si trabajás solo/a o tenés un local.
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground">
            Costa Turnos se adapta a vos. Elegí cómo lo vas a usar y empezá: siempre
            podés sumar a tu equipo más adelante.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {audiences.map((a) => (
            <div
              key={a.tag}
              className="rounded-2xl border border-border bg-card p-7 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-xl bg-muted text-accent">
                  <a.icon className="size-5" />
                </span>
                <div>
                  <p className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-accent">
                    {a.tag}
                  </p>
                  <p className="font-display text-lg font-semibold leading-tight">
                    {a.title}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                {a.desc}
              </p>
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

      {/* ---- ¿Cómo funciona? ---- */}
      <section className="py-16 sm:py-20">
        <div className="max-w-2xl">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            ¿Cómo funciona?
          </p>
          <h2 className="mt-3 text-balance font-display text-3xl font-medium leading-tight sm:text-4xl">
            Tres pasos y estás recibiendo turnos.
          </h2>
        </div>

        <ol className="mt-12 grid gap-8 md:grid-cols-3 md:gap-10">
          {steps.map((s) => (
            <li key={s.n} className="relative">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-full bg-accent font-display text-sm font-semibold text-accent-foreground">
                  {s.n}
                </span>
                <s.icon className="size-5 text-muted-foreground" />
              </div>
              <p className="mt-4 font-display text-lg font-semibold">{s.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {s.desc}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <div className="h-px w-full bg-border" />

      {/* ---- Lo que hace por vos (features) ---- */}
      <section className="py-16 sm:py-20">
        <div className="max-w-2xl">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            Todo en un solo lugar
          </p>
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
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {f.b}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- CTA final ---- */}
      <section className="my-8 overflow-hidden rounded-2xl border border-border bg-card px-7 py-12 text-center shadow-sm sm:px-12 sm:py-16">
        <h2 className="mx-auto max-w-xl text-balance font-display text-3xl font-medium leading-tight sm:text-4xl">
          Tu primera reserva online puede ser hoy.
        </h2>
        <p className="mx-auto mt-4 max-w-md text-pretty text-muted-foreground">
          Creá tu cuenta gratis, cargá tus servicios y compartí tu link. Te lleva
          unos minutos.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Button size="lg" asChild>
            <Link href="/ingresar">
              Empezar gratis <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href="/r/peluqueria-del-pueblo">Ver el demo</Link>
          </Button>
        </div>
      </section>

      {/* ---- Footer ---- */}
      <footer className="flex flex-col items-center justify-between gap-3 border-t border-border py-8 text-sm text-muted-foreground sm:flex-row">
        <p>© {new Date().getFullYear()} Costa Turnos · costaturnos.com</p>
        <p className="flex items-center gap-1.5">
          <MapPin className="size-4 text-accent" />
          Hecho en Costa de Araujo, Mendoza
        </p>
      </footer>
    </div>
  );
}
