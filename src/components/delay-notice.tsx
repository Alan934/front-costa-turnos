import { AlarmClock } from "lucide-react";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Por debajo de esto no se avisa: un atraso de uno o dos minutos es ruido, no información. */
export const MIN_DELAY_SHOWN_MINUTES = 5;

/**
 * Aviso de cuánto va atrasado el profesional (`delayMinutes` de la sala). Se muestra igual en la
 * pantalla del profesional, la del cliente y la cartelera, cambiando solo a quién le habla.
 * No renderiza nada si está al día (o casi).
 */
export function DelayNotice({
  minutes,
  audience,
  tv = false,
  className,
}: {
  minutes: number;
  /** `pro`: lo ve el profesional ("vas atrasado"). `client`: lo ve quien espera. */
  audience: "pro" | "client";
  tv?: boolean;
  className?: string;
}) {
  if (minutes < MIN_DELAY_SHOWN_MINUTES) return null;
  const amount = formatDuration(minutes);
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-2.5 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3",
        className,
      )}
    >
      <AlarmClock className={cn("mt-0.5 shrink-0 text-warning-foreground", tv ? "size-6" : "size-4")} />
      <div>
        <p className={cn("font-medium text-warning-foreground", tv ? "text-2xl" : "text-sm")}>
          {audience === "pro" ? `Venís ${amount} atrasado` : `Viene ${amount} atrasado`}
        </p>
        <p className={cn("text-muted-foreground", tv ? "text-xl" : "text-xs")}>
          {audience === "pro"
            ? "Los tiempos de espera de la fila ya lo tienen en cuenta."
            : "Puede que tu espera sea un poco más larga de lo habitual."}
        </p>
      </div>
    </div>
  );
}
