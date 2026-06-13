"use client";

import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/avatar";
import { ErrorState, EmptyState, SkeletonList } from "@/components/state-views";
import { useComercioMembers } from "@/lib/api/comercios";
import type { MembershipWithProfessional } from "@/mocks/contract-extensions";

const STATUS_META: Record<
  MembershipWithProfessional["status"],
  { label: string; variant: "success" | "warning" | "muted" }
> = {
  active: { label: "Activo", variant: "success" },
  invited: { label: "Invitado", variant: "warning" },
  inactive: { label: "Inactivo", variant: "muted" },
};

/** Roster del comercio: profesionales que trabajan en él. */
export function MembersSection({ comercioId }: { comercioId: string }) {
  const { data, isLoading, isError, refetch } = useComercioMembers(comercioId);

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-accent/10 text-accent">
          <Users className="size-4" />
        </span>
        <h2 className="font-display text-lg font-semibold tracking-tight">Equipo</h2>
      </div>

      {isLoading && <SkeletonList rows={2} />}
      {isError && <ErrorState message="No pudimos cargar el equipo." onRetry={() => refetch()} />}
      {data && data.length === 0 && (
        <EmptyState
          icon={<Users className="size-5" />}
          title="Todavía no hay profesionales"
          message="Invitá profesionales por email para que se sumen a este comercio."
        />
      )}
      {data && data.length > 0 && (
        <ul className="space-y-2.5">
          {data.map((m) => {
            const meta = STATUS_META[m.status];
            const label = m.professional?.fullName?.trim() || m.professional?.email || "Profesional";
            return (
              <li
                key={m.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"
              >
                <Avatar name={label} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{label}</p>
                  {m.professional?.email && m.professional?.fullName && (
                    <p className="truncate text-xs text-muted-foreground">{m.professional.email}</p>
                  )}
                </div>
                <Badge variant={meta.variant}>{meta.label}</Badge>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
