"use client";

import Link from "next/link";
import {
  PartyPopper,
  CheckCircle2,
  Circle,
  ArrowRight,
  Scissors,
  Users,
  Clock,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useServices } from "@/lib/api/catalog";
import { useProfessionalsListStaff } from "@/lib/api/generated/endpoints/professionals/professionals";
import { useAvailabilityListSchedule } from "@/lib/api/generated/endpoints/availability/availability";
import { useProfessional } from "@/lib/api/professional";
import { ScheduleRuleKind } from "@/lib/api/generated/model/scheduleRuleKind";
import { cn } from "@/lib/utils";

/**
 * Card de bienvenida que aparece en el dashboard cuando el profesional todavía
 * no terminó de configurar su página pública. Desaparece sola al completar todos
 * los pasos. Pensada para el primer acceso tras el registro.
 */
export function WelcomeSetup() {
  const pro = useProfessional();
  const services = useServices();
  const staff = useProfessionalsListStaff();

  const activeServices = (services.data ?? []).filter((s) => s.isActive);
  const activeStaff = (staff.data ?? []).filter((s) => s.isActive);
  const firstStaffId = activeStaff[0]?.id;

  const schedule = useAvailabilityListSchedule(firstStaffId ?? "", {
    query: { enabled: !!firstStaffId },
  });

  // Esperar a que las queries asienten para no parpadear al cargar la página.
  const settled = (q: { isSuccess: boolean; isError: boolean }) =>
    q.isSuccess || q.isError;
  const allSettled =
    settled(services) &&
    settled(staff) &&
    (!firstStaffId || settled(schedule));

  if (!allSettled) return null;

  const hasWork = (schedule.data ?? []).some(
    (r) => r.kind === ScheduleRuleKind.work,
  );

  const steps = [
    {
      done: activeServices.length > 0,
      icon: <Scissors className="size-4" />,
      label: "Cargá al menos un servicio",
      description: "Definí qué ofrecés, cuánto dura y qué precio tiene.",
      href: "/app/servicios",
      cta: "Ir a servicios",
    },
    {
      done: activeStaff.length > 0,
      icon: <Users className="size-4" />,
      label: "Sumá a quien atiende",
      description:
        "Podés ser vos, o agregar a los miembros de tu equipo (una silla, un box…).",
      href: "/app/horarios",
      cta: "Ir al equipo",
    },
    {
      done: activeStaff.length > 0 && hasWork,
      icon: <Clock className="size-4" />,
      label: "Configurá los horarios de atención",
      description: "Los días y el rango horario en que recibís reservas.",
      href: "/app/horarios",
      cta: "Ir a horarios",
    },
  ];

  if (steps.every((s) => s.done)) return null;

  const doneCount = steps.filter((s) => s.done).length;
  const slug = pro.data?.slug;

  return (
    <div className="mb-8 overflow-hidden rounded-2xl border border-accent/25 bg-card">
      {/* Encabezado */}
      <div className="flex items-start gap-4 border-b border-border p-5">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
          <PartyPopper className="size-6" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            ¡Tu cuenta está lista!
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Completá estos {steps.length} pasos para que tus clientes puedan
            reservar desde tu página pública.
          </p>
        </div>
        {doneCount > 0 && (
          <span className="ml-auto shrink-0 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">
            {doneCount}/{steps.length}
          </span>
        )}
      </div>

      {/* Lista de pasos */}
      <div className="divide-y divide-border">
        {steps.map((step) => (
          <div
            key={step.label}
            className={cn(
              "flex items-start gap-4 px-5 py-4 transition-colors",
              step.done && "opacity-60",
            )}
          >
            {/* Ícono de estado */}
            {step.done ? (
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
            ) : (
              <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground/50" />
            )}

            {/* Contenido */}
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-sm font-medium",
                  step.done && "line-through",
                )}
              >
                {step.label}
              </p>
              {!step.done && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {step.description}
                </p>
              )}
            </div>

            {/* CTA */}
            {!step.done && (
              <Button variant="outline" size="sm" asChild className="shrink-0">
                <Link href={step.href}>
                  {step.cta}
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* Pie: links de acceso rápido */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/30 px-5 py-3">
        <p className="text-xs text-muted-foreground">
          También podés usar el asistente de configuración guiado.
        </p>
        <div className="flex items-center gap-2">
          {slug && (
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/r/${slug}`} target="_blank">
                <ExternalLink className="size-3.5" />
                Ver mi página
              </Link>
            </Button>
          )}
          <Button size="sm" asChild>
            <Link href="/onboarding">
              Asistente de configuración
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
