"use client";

import { useEffect, useState } from "react";
import { Building2, ChevronDown } from "lucide-react";
import { ErrorState, EmptyState, SkeletonList } from "@/components/state-views";
import { useMyComercios } from "@/lib/api/comercios";
import { titleCaseName } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Comercio } from "@/lib/api/generated/model/comercio";
import { ComercioDetails } from "./comercio-details";
import { MembersSection } from "./members-section";
import { InvitationsSection } from "./invitations-section";

/** Panel comercial: elige el comercio y muestra datos + roster + invitaciones. */
export function ComercioPanel() {
  const { data, isLoading, isError, refetch } = useMyComercios();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Selecciona el primer comercio en cuanto llegan (o cuando el actual deja de existir).
  useEffect(() => {
    if (!data) return;
    if (data.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) => (prev && data.some((c) => c.id === prev) ? prev : data[0].id));
  }, [data]);

  const selected = data?.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="mx-auto max-w-3xl px-5 py-6 sm:px-8">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Mi comercio</h1>
        <p className="text-sm text-muted-foreground">
          Gestioná los datos del local y el equipo de profesionales.
        </p>
      </div>

      <div className="mt-6 space-y-8">
        {isLoading && <SkeletonList rows={3} />}
        {isError && <ErrorState message="No pudimos cargar tus comercios." onRetry={() => refetch()} />}
        {data && data.length === 0 && (
          <EmptyState
            icon={<Building2 className="size-5" />}
            title="Todavía no tenés comercios"
            message="Un administrador de la plataforma crea tu comercio. Si creés que es un error, contactanos."
          />
        )}

        {selected && (
          <>
            {data && data.length > 1 && (
              <ComercioSwitcher list={data} selectedId={selected.id} onSelect={setSelectedId} />
            )}
            <ComercioDetails comercio={selected} />
            <MembersSection comercioId={selected.id} />
            <InvitationsSection comercioId={selected.id} />
          </>
        )}
      </div>
    </div>
  );
}

/** Selector de comercio (solo si el comercial administra más de uno). */
function ComercioSwitcher({
  list,
  selectedId,
  onSelect,
}: {
  list: Comercio[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="relative">
      <label htmlFor="comercio-switch" className="mb-1.5 block text-sm font-medium">
        Comercio
      </label>
      <div className="relative">
        <select
          id="comercio-switch"
          value={selectedId}
          onChange={(e) => onSelect(e.target.value)}
          className={cn(
            "h-10 w-full appearance-none rounded-lg border border-input bg-card pl-3 pr-9 text-sm outline-none",
            "focus:ring-2 focus:ring-ring",
          )}
        >
          {list.map((c) => (
            <option key={c.id} value={c.id}>
              {titleCaseName(c.name)}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      </div>
    </div>
  );
}
