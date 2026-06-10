import Link from "next/link";
import { CalendarClock, Clock3, ArrowRight, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppointmentStatusBadge } from "@/components/appointment-status-badge";
import { AppointmentStatus } from "@/lib/api/generated/model/appointmentStatus";

const agenda = [
  { time: "10:00", name: "Sofía", svc: "Color + lavado", status: AppointmentStatus.in_progress, prov: false },
  { time: "11:30", name: "Martín", svc: "Kinesiología", status: AppointmentStatus.confirmed, prov: false },
  { time: "12:15", name: "Juan", svc: "Corte de pelo", status: AppointmentStatus.requested, prov: true },
  { time: "13:00", name: "Carla", svc: "Sesión con psicóloga", status: AppointmentStatus.done, prov: false },
];

const features = [
  { t: "Reserva online", b: "Tus clientes eligen servicio, profesional y horario desde el celu." },
  { t: "Sala de espera en vivo", b: "Una pantalla en tu local muestra la cola en tiempo real." },
  { t: "Recordatorios automáticos", b: "Menos ausencias: avisamos el turno por vos." },
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-6 sm:px-8">
      {/* ---- Header ---- */}
      <header className="flex items-center justify-between py-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl border border-border text-accent">
            <CalendarClock className="size-5" />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">
            Costa Turnos
          </span>
        </Link>
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
            Turnos · sin papel · sin WhatsApp
          </p>
          <h1 className="animate-rise delay-1 mt-5 text-balance font-display text-5xl font-medium leading-[1.05] sm:text-6xl">
            Los turnos de tu trabajo,{" "}
            <span className="text-muted-foreground">ordenados de una vez.</span>
          </h1>
          <p className="animate-rise delay-2 mt-6 max-w-md text-pretty text-lg leading-relaxed text-muted-foreground">
            Reservas online, recordatorios y una sala de espera en vivo. Una herramienta
            tranquila para que atiendas sin perder el hilo.
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

      {/* ---- Features ---- */}
      <section className="grid gap-10 py-14 md:grid-cols-3 md:gap-12">
        {features.map((f, i) => (
          <div key={f.t} className={`animate-rise ${["delay-4", "delay-5", "delay-6"][i]}`}>
            <div className="mb-3 h-px w-8 bg-accent" />
            <p className="font-display text-base font-semibold">{f.t}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.b}</p>
          </div>
        ))}
      </section>

      {/* ---- Footer ---- */}
      <footer className="flex flex-col items-center justify-between gap-3 border-t border-border py-8 text-sm text-muted-foreground sm:flex-row">
        <p>© {new Date().getFullYear()} Costa Turnos · costaturnos.com.ar</p>
        <p className="flex items-center gap-1.5">
          <MapPin className="size-4 text-accent" />
          Hecho en Costa de Araujo, Mendoza
        </p>
      </footer>
    </div>
  );
}
