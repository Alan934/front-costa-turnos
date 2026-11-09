import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import type { MetricsPeriodDto } from "@/lib/api/generated/model/metricsPeriodDto";

/**
 * Textos de períodos y números para las pantallas de métricas (profesional y comercio), así
 * "Semana pasada", "Del 2 al 8 de noviembre" o "12%" se escriben igual en todos lados.
 */
export type MetricsRangeUi = "week" | "month";
type Range = MetricsRangeUi;

export function periodTitle(range: Range, offset: number): string {
  if (range === "week") return offset === 0 ? "Esta semana" : offset === 1 ? "Semana pasada" : `Hace ${offset} semanas`;
  return offset === 0 ? "Este mes" : offset === 1 ? "Mes pasado" : `Hace ${offset} meses`;
}

/** "Lunes 9 al domingo 15 de noviembre" / "Noviembre de 2026" (+ "hasta hoy" si está en curso). */
export function periodRangeLabel(period: MetricsPeriodDto, range: Range): string {
  const from = parseISO(period.from);
  const to = parseISO(period.to);
  let text: string;
  if (range === "month") {
    text = capitalize(format(from, "MMMM 'de' yyyy", { locale: es }));
  } else if (from.getMonth() === to.getMonth()) {
    text = `Del ${format(from, "d", { locale: es })} al ${format(to, "d 'de' MMMM", { locale: es })}`;
  } else {
    text = `Del ${format(from, "d 'de' MMMM", { locale: es })} al ${format(to, "d 'de' MMMM", { locale: es })}`;
  }
  return period.isCurrent ? `${text} · hasta hoy` : text;
}

export function periodPhrase(range: Range, offset: number, period: MetricsPeriodDto): string {
  if (range === "week") {
    if (offset === 0) return "esta semana";
    if (offset === 1) return "la semana pasada";
    return `en la semana del ${format(parseISO(period.from), "d 'de' MMMM", { locale: es })}`;
  }
  if (offset === 0) return "este mes";
  if (offset === 1) return "el mes pasado";
  return `en ${format(parseISO(period.from), "MMMM 'de' yyyy", { locale: es })}`;
}

export function pct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

