"use client";

import { useState } from "react";
import { Mail, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { ErrorState, EmptyState, SkeletonList } from "@/components/state-views";
import {
  useComercioInvitations,
  useInviteToComercio,
  useCancelInvitation,
} from "@/lib/api/comercios";
import { formatDateShort } from "@/lib/format";
import { InvitationStatus } from "@/lib/api/generated/model/invitationStatus";
import type { AxiosError } from "axios";
import type { ComercioInvitation } from "@/lib/api/generated/model/comercioInvitation";

const STATUS_META: Record<
  InvitationStatus,
  { label: string; variant: "default" | "success" | "muted" | "warning" }
> = {
  pending: { label: "Pendiente", variant: "warning" },
  accepted: { label: "Aceptada", variant: "success" },
  expired: { label: "Expirada", variant: "muted" },
  cancelled: { label: "Cancelada", variant: "muted" },
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Invitaciones del comercio: invitar por email y cancelar las pendientes. */
export function InvitationsSection({ comercioId }: { comercioId: string }) {
  const list = useComercioInvitations(comercioId);
  const invite = useInviteToComercio(comercioId);
  const cancel = useCancelInvitation(comercioId);

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const canInvite = EMAIL_RE.test(email.trim()) && !invite.isPending;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    invite.mutate(email.trim(), {
      onSuccess: () => setEmail(""),
      onError: (err) => {
        const status = (err as AxiosError).response?.status;
        setError(
          status === 409
            ? "Ya hay una invitación activa para ese email."
            : status === 403
              ? "No tenés permisos para invitar en este comercio."
              : "No pudimos enviar la invitación. Probá de nuevo.",
        );
      },
    });
  }

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-accent/10 text-accent">
          <Mail className="size-4" />
        </span>
        <h2 className="font-display text-lg font-semibold tracking-tight">Invitaciones</h2>
      </div>

      <form onSubmit={submit} className="rounded-xl border border-border bg-card p-5">
        <label htmlFor="inv-email" className="mb-1.5 block text-sm font-medium">
          Invitar profesional por email
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="inv-email"
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(null); }}
            placeholder="profesional@email.com"
            autoComplete="off"
          />
          <Button type="submit" disabled={!canInvite} className="shrink-0">
            {invite.isPending ? <Spinner /> : <Plus className="size-4" />}
            Invitar
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Le enviamos un email con un enlace para que se sume al equipo.
        </p>
        {error && (
          <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
      </form>

      <div className="mt-4">
        {list.isLoading && <SkeletonList rows={2} />}
        {list.isError && (
          <ErrorState message="No pudimos cargar las invitaciones." onRetry={() => list.refetch()} />
        )}
        {list.data && list.data.length === 0 && (
          <EmptyState
            icon={<Mail className="size-5" />}
            title="Sin invitaciones"
            message="Cuando invites a alguien, vas a ver el estado de su invitación acá."
          />
        )}
        {list.data && list.data.length > 0 && (
          <ul className="space-y-2.5">
            {list.data.map((inv) => (
              <InvitationRow
                key={inv.id}
                invitation={inv}
                onCancel={() => cancel.mutate(inv.id)}
                cancelling={cancel.isPending && cancel.variables === inv.id}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function InvitationRow({
  invitation,
  onCancel,
  cancelling,
}: {
  invitation: ComercioInvitation;
  onCancel: () => void;
  cancelling: boolean;
}) {
  const meta = STATUS_META[invitation.status];
  const pending = invitation.status === InvitationStatus.pending;
  return (
    <li className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{invitation.email}</p>
        {pending && (
          <p className="truncate text-xs text-muted-foreground">
            Vence el {formatDateShort(invitation.expiresAt)}
          </p>
        )}
      </div>
      <Badge variant={meta.variant}>{meta.label}</Badge>
      {pending && (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Cancelar invitación"
          className="text-muted-foreground hover:text-destructive"
          disabled={cancelling}
          onClick={() => {
            if (confirm(`¿Cancelar la invitación a ${invitation.email}?`)) onCancel();
          }}
        >
          {cancelling ? <Spinner /> : <X className="size-4" />}
        </Button>
      )}
    </li>
  );
}
