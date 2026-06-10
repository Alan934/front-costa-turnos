/**
 * Utilidades para la agenda del profesional: rangos de día/semana y posicionamiento
 * de turnos en una grilla horaria. Trabaja en hora local del navegador (suficiente para
 * la demo); el formateo visible usa los helpers es-AR de format.ts.
 */
import type { Appointment } from "@/lib/api/generated/model/appointment";

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
