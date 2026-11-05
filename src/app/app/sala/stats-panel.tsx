"use client";

import { useState } from "react";
import { BarChart3, ChevronDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useWaitingStats } from "@/lib/api/sala";
import { cn } from "@/lib/utils";

const RANGES = [
  { days: 7, label: "7 días" },
  { days: 30, label: "30 días" },
  { days: 90, label: "90 días" },
];

const hourLabel = (h: number) => `${String(h).padStart(2, "0")}h`;

/**
 * Estadísticas de la sala: cuánto espera la gente, cuánto tarda de verdad una atención, a qué
 * horas llega más gente y qué servicios pesan más. Está plegado por defecto: se consulta,
 * no se mira todos los días.
 */
export function StatsPanel({ staffId }: { staffId: string }) {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(30);
  const stats = useWaitingStats(staffId, days, open);
  const s = stats.data;
  const maxArrivals = Math.max(1, ...(s?.byHour.map((h) => h.arrivals) ?? [1]));

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <BarChart3 className="size-4 text-accent" />
        <span className="flex-1 font-display text-sm font-semibold">Estadísticas de la sala</span>
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t border-border px-4 pb-4 pt-3">
          <div className="mb-4 flex gap-1.5">
            {RANGES.map((r) => (
              <button
                key={r.days}
                type="button"
                onClick={() => setDays(r.days)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  r.days === days
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-muted-foreground hover:border-accent/50",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>

          {stats.isLoading && <Skeleton className="h-32 w-full rounded-xl" />}
          {stats.isError && (
            <p className="text-sm text-destructive">No pudimos cargar las estadísticas.</p>
          )}

          {s && s.servedCount === 0 && s.byHour.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Todavía no hay datos en este período. Aparecen a medida que atendés gente desde la sala.
            </p>
          )}

          {s && (s.servedCount > 0 || s.byHour.length > 0) && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Tile label="Atendidos" value={String(s.servedCount)} hint={`${s.walkInCount} sin turno`} />
                <Tile
                  label="Espera promedio"
                  value={`${s.avgWaitMinutes}′`}
                  hint={`máx. ${s.maxWaitMinutes}′`}
                />
                <Tile label="Atención promedio" value={`${s.avgServiceMinutes}′`} hint="tiempo real" />
                <Tile label="No vinieron" value={String(s.noShowCount)} />
              </div>

              {s.byHour.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Llegadas por hora
                    {s.peakHours.length > 0 && (
                      <span className="font-normal">
                        {" "}
                        · más movimiento a las {s.peakHours.map(hourLabel).join(", ")}
                      </span>
                    )}
                  </p>
                  <div className="flex h-28 items-end gap-1" role="img" aria-label="Llegadas por hora">
                    {s.byHour.map((h) => (
                      <div key={h.hour} className="flex flex-1 flex-col items-center justify-end gap-1">
                        <span className="text-[10px] tabular-nums text-muted-foreground">{h.arrivals}</span>
                        <div
                          className={cn(
                            "w-full rounded-t",
                            s.peakHours.includes(h.hour) ? "bg-accent" : "bg-accent/40",
                          )}
                          style={{ height: `${Math.max(6, (h.arrivals / maxArrivals) * 72)}px` }}
                        />
                        <span className="text-[10px] tabular-nums text-muted-foreground">{h.hour}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {s.byService.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Por servicio</p>
                  <ul className="space-y-1.5">
                    {s.byService.map((sv) => (
                      <li key={sv.serviceName} className="flex items-center gap-2 text-sm">
                        <span className="min-w-0 flex-1 truncate">{sv.serviceName}</span>
                        <span className="text-xs text-muted-foreground">
                          {sv.count} · ~{sv.avgServiceMinutes}′ c/u
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-muted/60 p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-display text-xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
