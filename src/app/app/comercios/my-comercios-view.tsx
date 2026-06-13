"use client";

import { Building2, MapPin, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ErrorState, EmptyState, SkeletonList } from "@/components/state-views";
import { useMyMemberships } from "@/lib/api/comercios";
import type { MembershipWithComercio } from "@/mocks/contract-extensions";

/** Etiqueta/variante de Badge según el estado de la membresía. */
const STATUS_META: Record<
  MembershipWithComercio["status"],
  { label: string; variant: "success" | "warning" | "muted" }
> = {
  active: { label: "Activo", variant: "success" },
  invited: { label: "Invitación pendiente", variant: "warning" },
  inactive: { label: "Inactivo", variant: "muted" },
};

export function MyComerciosView() {
  const { data, isLoading, isError, refetch } = useMyMemberships();

  return (
    <div className="mx-auto max-w-3xl px-5 py-6 sm:px-8">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Mis comercios</h1>
        <p className="text-sm text-muted-foreground">
          Los lugares donde trabajás. Cuando te inviten a un equipo, vas a verlo acá.
        </p>
      </div>

      <div className="mt-6">
        {isLoading && <SkeletonList rows={2} />}
        {isError && <ErrorState message="No pudimos cargar tus comercios." onRetry={() => refetch()} />}
        {data && data.length === 0 && (
          <EmptyState
            icon={<Building2 className="size-5" />}
            title="Todavía no formás parte de ningún equipo"
            message="Si un comercio te invita por email, vas a poder aceptar la invitación y aparecerá acá."
          />
        )}
        {data && data.length > 0 && (
          <ul className="space-y-2.5">
            {data.map((m) => {
              const meta = STATUS_META[m.status];
              const personal = m.comercio?.isPersonal;
              return (
                <li
                  key={m.id}
                  className="flex items-center gap-4 rounded-xl border border-border bg-card p-4"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
                    {personal ? <User className="size-5" /> : <Building2 className="size-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-medium">
                      <span className="truncate">{m.comercio?.name ?? "Comercio"}</span>
                      {personal && <Badge variant="muted">Tu negocio</Badge>}
                    </p>
                    {m.comercio?.address && (
                      <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <MapPin className="size-3.5 shrink-0" />
                        {m.comercio.address}
                      </p>
                    )}
                  </div>
                  <Badge variant={meta.variant}>{meta.label}</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        ¿Te llegó una invitación por email? Abrí el enlace del correo para sumarte al equipo.
      </p>
    </div>
  );
}
