/**
 * Formateo localizado a es-AR con zona horaria America/Argentina/Buenos_Aires.
 * Usar SIEMPRE estos helpers para plata y fechas; nunca toLocaleString suelto.
 */
import { formatInTimeZone } from "date-fns-tz";
import { es } from "date-fns/locale";

export const TIME_ZONE = "America/Argentina/Buenos_Aires";
export const LOCALE = "es-AR";

const currencyFormatter = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const currencyWithCentsFormatter = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formatea un monto en pesos argentinos.
 * Los montos del API vienen en centavos (enteros) salvo que se indique lo contrario.
 */
export function formatMoney(
  amountInCents: number | null | undefined,
  { fromCents = true, withCents = false }: { fromCents?: boolean; withCents?: boolean } = {},
): string {
  if (amountInCents == null) return "—";
  const value = fromCents ? amountInCents / 100 : amountInCents;
  return (withCents ? currencyWithCentsFormatter : currencyFormatter).format(value);
}

type DateInput = Date | string | number;

function toDate(input: DateInput): Date {
  return input instanceof Date ? input : new Date(input);
}

/** Fecha + hora: "vie. 7 jun., 14:30" */
export function formatDateTime(input: DateInput): string {
  return formatInTimeZone(toDate(input), TIME_ZONE, "EEE d MMM, HH:mm", { locale: es });
}

/** Solo fecha larga: "viernes 7 de junio de 2026" */
export function formatDateLong(input: DateInput): string {
  return formatInTimeZone(toDate(input), TIME_ZONE, "EEEE d 'de' MMMM 'de' yyyy", {
    locale: es,
  });
}

/** Solo fecha corta: "07/06/2026" */
export function formatDateShort(input: DateInput): string {
  return formatInTimeZone(toDate(input), TIME_ZONE, "dd/MM/yyyy", { locale: es });
}

/** Solo hora: "14:30" */
export function formatTime(input: DateInput): string {
  return formatInTimeZone(toDate(input), TIME_ZONE, "HH:mm", { locale: es });
}

/** Día de la semana capitalizado: "Viernes" */
export function formatWeekday(input: DateInput): string {
  const day = formatInTimeZone(toDate(input), TIME_ZONE, "EEEE", { locale: es });
  return day.charAt(0).toUpperCase() + day.slice(1);
}

/** Día corto para selector de fecha: "vie 7" (abreviado + número). */
export function formatDayChip(input: DateInput): { weekday: string; day: string } {
  const weekday = formatInTimeZone(toDate(input), TIME_ZONE, "EEE", { locale: es }).replace(
    ".",
    "",
  );
  const day = formatInTimeZone(toDate(input), TIME_ZONE, "d", { locale: es });
  return { weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1), day };
}

/** ¿Dos fechas caen en el mismo día calendario (en la TZ de AR)? */
export function isSameDay(a: DateInput, b: DateInput): boolean {
  return (
    formatInTimeZone(toDate(a), TIME_ZONE, "yyyy-MM-dd") ===
    formatInTimeZone(toDate(b), TIME_ZONE, "yyyy-MM-dd")
  );
}

/** Duración legible a partir de minutos: "1 h 30 min", "45 min". */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null || minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

/**
 * Tiempo relativo aproximado para ETA de sala de espera.
 * Devuelve cosas como "en 10 min", "ahora", "hace 5 min".
 */
export function formatRelativeMinutes(minutes: number): string {
  const rounded = Math.round(minutes);
  if (rounded === 0) return "ahora";
  if (rounded > 0) return `en ${rounded} min`;
  return `hace ${Math.abs(rounded)} min`;
}
