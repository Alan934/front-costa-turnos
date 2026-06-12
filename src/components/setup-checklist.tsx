"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Circle } from "lucide-react";
import { useServices } from "@/lib/api/catalog";
import { useListStaff } from "@/lib/api/generated/endpoints/professionals/professionals";
import { useListSchedule } from "@/lib/api/generated/endpoints/availability/availability";
import { ScheduleRuleKind } from "@/lib/api/generated/model/scheduleRuleKind";

/**
 * Aviso de "tu negocio todavía no está listo". Aparece en todo el panel (va en el AppShell)
 * hasta que el profesional tenga lo mínimo para recibir reservas: un servicio, alguien en el
 * equipo y horarios cargados. Se oculta solo cuando está todo hecho.
 */
export function SetupChecklist() {
  const services = useServices();
  const staff = useListStaff();

  const activeServices = (services.data ?? []).filter((s) => s.isActive);
  const activeStaff = (staff.data ?? []).filter((s) => s.isActive);
  const firstStaffId = activeStaff[0]?.id;

  // Solo consultamos el horario del primer miembro del equipo (si hay).
  const schedule = useListSchedule(firstStaffId ?? "", {
    query: { enabled: !!firstStaffId },
  });

  // Esperamos a que las consultas "asienten" (éxito o error) para no parpadear, pero NO
  // exigimos éxito: si alguna falla, mostramos el paso como pendiente igual (en vez de
  // ocultar el aviso y dejar al profesional sin saber qué le falta).
  const settled = (q: { isSuccess: boolean; isError: boolean }) => q.isSuccess || q.isError;
  const evaluated =
    settled(services) && settled(staff) && (!firstStaffId || settled(schedule));
  if (!evaluated) return null;

  const hasWork = (schedule.data ?? []).some((r) => r.kind === ScheduleRuleKind.work);

  const steps = [
    {
      done: activeServices.length > 0,
      label: "Cargá al menos un servicio",
      href: "/app/servicios",
    },
    {
      done: activeStaff.length > 0,
      label: "Sumá a tu equipo (un profesional o una silla/box)",
      href: "/app/horarios",
    },
    {
      done: activeStaff.length > 0 && hasWork,
      label: "Definí tus horarios de atención",
      href: "/app/horarios",
    },
  ];

  if (steps.every((s) => s.done)) return null;

  return (
    <div className="border-b border-warning/45 bg-warning/10 px-5 py-3 text-warning-foreground sm:px-8">
      <div className="mx-auto flex max-w-5xl items-start gap-2.5">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Tu negocio todavía no está listo para recibir reservas.</p>
          <p className="text-xs opacity-90">Completá estos pasos para que tus clientes puedan reservar:</p>
          <ul className="mt-2 space-y-1.5">
            {steps.map((s) => (
              <li key={s.label} className="flex items-center gap-2 text-sm">
                {s.done ? (
                  <CheckCircle2 className="size-4 shrink-0 text-success" />
                ) : (
                  <Circle className="size-4 shrink-0 opacity-50" />
                )}
                {s.done ? (
                  <span className="opacity-70 line-through">{s.label}</span>
                ) : (
                  <Link href={s.href} className="font-medium underline underline-offset-2">
                    {s.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
