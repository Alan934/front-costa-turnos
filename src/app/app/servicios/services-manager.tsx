"use client";

import { useState } from "react";
import { Plus, Clock3, Pencil, Trash2, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ErrorState, EmptyState } from "@/components/state-views";
import { useActiveComercio } from "@/components/comercio-context";
import { useComercioServices, useDeactivateComercioService } from "@/lib/api/catalog";
import { paymentSummary } from "@/lib/deposit";
import { formatMoney, formatDuration } from "@/lib/format";
import type { Service } from "@/lib/api/generated/model/service";
import { ServiceFormDialog } from "./service-form-dialog";

export function ServicesManager() {
  const { active, activeId, loading: comercioLoading } = useActiveComercio();
  const { data, isLoading, isError, refetch } = useComercioServices(activeId ?? undefined);
  const deactivate = useDeactivateComercioService(activeId ?? "");
  const [editing, setEditing] = useState<Service | null>(null);
  const [creating, setCreating] = useState(false);

  const services = (data ?? []).filter((s) => s.isActive);
  // Mientras no haya comercio activo resuelto, mostramos skeletons (no listas vacías).
  const showLoading = comercioLoading || (!!activeId && isLoading);

  return (
    <div className="mx-auto max-w-3xl px-5 py-6 sm:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Servicios</h1>
          <p className="text-sm text-muted-foreground">
            Lo que ofrecés{active && !active.isPersonal ? ` en ${active.name}` : ""}, con precio y seña
          </p>
        </div>
        <Button size="sm" disabled={!activeId} onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          <span className="hidden sm:inline">Nuevo servicio</span>
        </Button>
      </div>

      <div className="mt-6">
        {showLoading && (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        )}
        {!showLoading && isError && (
          <ErrorState message="No pudimos cargar tus servicios." onRetry={() => refetch()} />
        )}
        {!showLoading && data && services.length === 0 && (
          <EmptyState
            icon={<Scissors className="size-5" />}
            title="Todavía no cargaste servicios"
            message="Agregá lo que ofrecés para que tus clientes puedan reservar."
            action={
              <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
                <Plus className="size-4" />
                Crear servicio
              </Button>
            }
          />
        )}
        {!showLoading && services.length > 0 && (
          <ul className="space-y-2.5">
            {services.map((s) => {
              const pay = paymentSummary(s);
              return (
                <li
                  key={s.id}
                  className="flex items-center gap-4 rounded-xl border border-border bg-card p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{s.name}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="size-3.5" />
                        {formatDuration(s.durationMinutes)}
                      </span>
                      {pay && <Badge variant="muted">{pay}</Badge>}
                    </p>
                  </div>
                  <span className="font-display font-semibold tabular-nums">
                    {formatMoney(s.priceCents)}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => setEditing(s)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Desactivar"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        if (confirm(`¿Desactivar "${s.name}"? Dejará de aparecer para reservar.`)) {
                          deactivate.mutate(s.id);
                        }
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {creating && activeId && (
        <ServiceFormDialog comercioId={activeId} onClose={() => setCreating(false)} />
      )}
      {editing && activeId && (
        <ServiceFormDialog comercioId={activeId} service={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
