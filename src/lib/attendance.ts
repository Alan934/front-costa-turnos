/**
 * Modo de atención: con turno o por orden de llegada. Helpers para mostrar las franjas
 * por orden de llegada de forma corta y legible ("Lun, Mar, Mié 09:00–13:00").
 */
import type { WalkInWindowDto } from "@/lib/api/generated/model/walkInWindowDto";

const DAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DAY_LONG = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
/** Orden de lectura: la semana arranca el lunes. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export const dayShort = (d: number) => DAY_SHORT[d] ?? "";
export const dayLong = (d: number) => DAY_LONG[d] ?? "";

/**
 * Agrupa las franjas con el mismo horario y junta sus días: tres franjas "09:00–13:00" de
 * lunes, martes y miércoles pasan a "Lun, Mar, Mié 09:00–13:00". Devuelve una línea por horario.
 */
export function formatWalkInWindows(windows: WalkInWindowDto[]): string[] {
  const byRange = new Map<string, number[]>();
  for (const w of windows) {
    const key = `${w.startTime}–${w.endTime}`;
    const days = byRange.get(key) ?? [];
    if (!days.includes(w.dayOfWeek)) days.push(w.dayOfWeek);
    byRange.set(key, days);
  }
  return [...byRange.entries()]
    .map(([range, days]) => ({
      range,
      days: days.sort((a, b) => WEEK_ORDER.indexOf(a) - WEEK_ORDER.indexOf(b)),
    }))
    .sort((a, b) => WEEK_ORDER.indexOf(a.days[0]) - WEEK_ORDER.indexOf(b.days[0]))
    .map(({ range, days }) => `${days.map(dayShort).join(", ")} ${range}`);
}

/** "el sábado de 09:00 a 13:00" / "hoy de 14:00 a 18:00". */
export function describeWindow(w: WalkInWindowDto, todayDow: number): string {
  const when = w.dayOfWeek === todayDow ? "hoy" : `el ${dayLong(w.dayOfWeek)}`;
  return `${when} de ${w.startTime} a ${w.endTime}`;
}
