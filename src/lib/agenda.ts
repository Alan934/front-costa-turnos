/**
 * Utilidades para la agenda del profesional: rangos de día/semana y posicionamiento
 * de turnos en una grilla horaria. Trabaja en hora local del navegador (suficiente para
 * la demo); el formateo visible usa los helpers es-AR de format.ts.
 */
import type { Appointment } from "@/lib/api/generated/model/appointment";
import { AppointmentStatus } from "@/lib/api/generated/model/appointmentStatus";
import type { ScheduleRule } from "@/lib/api/generated/model/scheduleRule";
import { ScheduleRuleKind } from "@/lib/api/generated/model/scheduleRuleKind";
import type { TimeOff } from "@/lib/api/generated/model/timeOff";

export const DAY_START_HOUR = 8;
export const DAY_END_HOUR = 20;
export const HOUR_PX = 64; // alto de una hora en la grilla

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Lunes de la semana de la fecha dada. */
export function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  const day = (x.getDay() + 6) % 7; // 0 = lunes
  return addDays(x, -day);
}

/** Los 7 días (lun-dom) de la semana de la fecha. */
export function weekDays(d: Date): Date[] {
  const monday = startOfWeek(d);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isToday(d: Date): boolean {
  return isSameLocalDay(d, new Date());
}

/** Rango ISO [from, to] que cubre el día. */
export function dayRange(d: Date): { from: string; to: string } {
  const from = startOfDay(d);
  const to = new Date(from);
  to.setHours(23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
}

/** Rango ISO de toda la semana. */
export function weekRange(d: Date): { from: string; to: string } {
  const from = startOfWeek(d);
  const to = addDays(from, 6);
  to.setHours(23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function startOfMonth(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}

export function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

/** Los 42 días (6 semanas, lun-dom) que cubren el mes en una grilla de calendario. */
export function monthGridDays(d: Date): Date[] {
  const gridStart = startOfWeek(startOfMonth(d));
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

/** Rango ISO que cubre toda la grilla del mes (incluye días de meses vecinos visibles). */
export function monthGridRange(d: Date): { from: string; to: string } {
  const days = monthGridDays(d);
  const to = new Date(days[41]);
  to.setHours(23, 59, 59, 999);
  return { from: days[0].toISOString(), to: to.toISOString() };
}

/** Clave local yyyy-mm-dd de una fecha. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Cuenta turnos por día (excluye cancelados: no ocupan agenda). */
export function countByDay(appts: Appointment[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const a of appts) {
    if (a.status === AppointmentStatus.cancelled) continue;
    const k = dayKey(new Date(a.startAt));
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

/** Nivel de carga 0..4 según la cantidad de turnos del día (para el "heatmap"). */
export function loadLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 4) return 2;
  if (count <= 7) return 3;
  return 4;
}

/**
 * Por qué el profesional no atiende un día.
 *  - `closed`: ese día de la semana no tiene franjas de trabajo cargadas (cerrado habitual).
 *  - `timeoff`: cae dentro de un bloqueo puntual (feriado, vacaciones, etc.) — trae el motivo.
 */
export interface DayOff {
  kind: "closed" | "timeoff";
  /** Texto a mostrar: motivo del bloqueo o "Cerrado". */
  reason: string;
}

/** Días de la semana (0=dom … 6=sáb) que NO tienen ninguna franja de trabajo. */
export function closedWeekdays(rules: ScheduleRule[]): Set<number> {
  const worked = new Set<number>();
  for (const r of rules) {
    if (r.kind === ScheduleRuleKind.work) worked.add(r.dayOfWeek);
  }
  const closed = new Set<number>();
  for (let d = 0; d < 7; d++) if (!worked.has(d)) closed.add(d);
  return closed;
}

/** Bloqueo (time-off) que cubre el día, si lo hay. */
export function timeOffForDay(day: Date, timeOff: TimeOff[]): TimeOff | undefined {
  const dayStart = startOfDay(day).getTime();
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;
  return timeOff.find((t) => {
    const from = new Date(t.startAt).getTime();
    const to = new Date(t.endAt).getTime();
    // Se solapa con el día si empieza antes del fin del día y termina después de su inicio.
    return from < dayEnd && to > dayStart;
  });
}

/**
 * Determina si el profesional no atiende ese día y por qué. El time-off (bloqueo puntual)
 * tiene prioridad sobre el cierre habitual: si justo cae en un día cerrado, igual mostramos
 * el motivo del bloqueo. Devuelve `null` cuando el día es laborable.
 */
export function dayOffStatus(
  day: Date,
  closed: Set<number>,
  timeOff: TimeOff[],
): DayOff | null {
  const block = timeOffForDay(day, timeOff);
  if (block) return { kind: "timeoff", reason: block.reason?.trim() || "Bloqueado" };
  if (closed.has(day.getDay())) return { kind: "closed", reason: "Cerrado" };
  return null;
}

export interface PositionedAppointment {
  appointment: Appointment;
  top: number;
  height: number;
}

/** Calcula top/height en px de un turno dentro de la grilla horaria. */
export function positionAppointment(a: Appointment): PositionedAppointment {
  const start = new Date(a.startAt);
  const end = new Date(a.endAt);
  const startMin = (start.getHours() - DAY_START_HOUR) * 60 + start.getMinutes();
  const durMin = Math.max(15, (end.getTime() - start.getTime()) / 60000);
  return {
    appointment: a,
    top: (startMin / 60) * HOUR_PX,
    height: (durMin / 60) * HOUR_PX,
  };
}

/** Horas a dibujar como líneas de la grilla. */
export function gridHours(): number[] {
  return Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, i) => DAY_START_HOUR + i);
}

/**
 * Nombre legible de la persona a partir del personId. El contrato no expone el nombre
 * en Appointment (ver API-GAPS §2c); derivamos uno legible para la demo (per_sofia →
 * "Sofía"). Cuando el back lo incluya, se usa el campo real.
 */
export function personDisplayName(personId: string): string {
  const raw = personId.replace(/^per_/, "").replace(/[_-]+/g, " ").trim();
  if (!raw) return "Cliente";
  return raw
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
