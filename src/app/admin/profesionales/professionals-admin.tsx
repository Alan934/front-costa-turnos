"use client";

import { useState } from "react";
import {
  Plus,
  Search,
  Ban,
  CircleCheck,
  ExternalLink,
  Building2,
  MoreVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ErrorState, EmptyState } from "@/components/state-views";
import {
  useAdminProfessionals,
  useCreateProfessional,
  useToggleProfessionalBlock,
} from "@/lib/api/admin";
import { formatMoney, formatDateShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AdminProfessional } from "@/mocks/contract-extensions";

const SUB_LABELS: Record<
  AdminProfessional["subscriptionStatus"],
  { label: string; variant: "success" | "warning" | "muted" | "default" }
> = {
  trial: { label: "Prueba", variant: "default" },
  active: { label: "Al día", variant: "success" },
  past_due: { label: "Pago pendiente", variant: "warning" },
  grace: { label: "En gracia", variant: "warning" },
  blocked: { label: "Bloqueada", variant: "warning" },
  cancelled: { label: "Baja", variant: "muted" },
};

export function ProfessionalsAdmin() {
  const { data, isLoading, isError, refetch } = useAdminProfessionals();
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);

  const list = (data ?? []).filter(
    (p) =>
      p.businessName.toLowerCase().includes(q.toLowerCase()) ||
      p.ownerName.toLowerCase().includes(q.toLowerCase()) ||
      p.ownerEmail.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-4xl px-5 py-6 sm:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Profesionales</h1>
          <p className="text-sm text-muted-foreground">Negocios en la plataforma y su estado de pago</p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          <span className="hidden sm:inline">Nuevo profesional</span>
        </Button>
      </div>

      <div className="relative mt-5">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar negocio, dueño o email…" />
      </div>

      <div className="mt-5">
        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        )}
        {isError && <ErrorState message="No pudimos cargar los profesionales." onRetry={() => refetch()} />}
        {data && list.length === 0 && (
          <EmptyState
            icon={<Building2 className="size-5" />}
            title={q ? "Sin resultados" : "Todavía no hay profesionales"}
            message={q ? "Probá otra búsqueda." : "Creá el primero para empezar."}
          />
        )}
        {list.length > 0 && (
          <ul className="space-y-2.5">
            {list.map((p) => (
              <ProfessionalRow key={p.id} pro={p} />
            ))}
          </ul>
        )}
      </div>

      {creating && <NewProfessionalDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

function ProfessionalRow({ pro }: { pro: AdminProfessional }) {
  const toggle = useToggleProfessionalBlock();
  const [menu, setMenu] = useState(false);
  const blocked = pro.status === "blocked";
  const sub = SUB_LABELS[pro.subscriptionStatus];

  return (
    <li className={cn("rounded-xl border bg-card p-4", blocked ? "border-border opacity-70" : "border-border")}>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted font-display text-sm font-semibold">
          {pro.businessName.charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{pro.businessName}</p>
            {blocked ? (
              <Badge variant="muted">Bloqueado</Badge>
            ) : (
              <Badge variant={sub.variant === "muted" ? "muted" : sub.variant === "success" ? "success" : sub.variant === "warning" ? "warning" : "default"}>
                {sub.label}
              </Badge>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {pro.ownerName} · {pro.ownerEmail}
          </p>
          <p className="mt-1 flex flex-wrap gap-x-4 text-xs text-muted-foreground">
            <span>{formatMoney(pro.monthlyCents)}/mes</span>
            <span>{pro.appointmentsLast30} turnos (30d)</span>
            {pro.nextChargeAt && <span>Próx. cobro {formatDateShort(pro.nextChargeAt)}</span>}
          </p>
        </div>

        {/* Acciones */}
        <div className="relative">
          <Button variant="ghost" size="icon" aria-label="Acciones" onClick={() => setMenu((v) => !v)}>
            <MoreVertical className="size-4" />
          </Button>
          {menu && (
            <>
              <button type="button" className="fixed inset-0 z-10 cursor-default" aria-hidden onClick={() => setMenu(false)} />
              <div className="absolute right-0 top-10 z-20 w-44 overflow-hidden rounded-xl border border-border bg-popover py-1 shadow-lg">
                <a
                  href={`/r/${pro.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
                >
                  <ExternalLink className="size-4" />
                  Ver página pública
                </a>
                <button
                  type="button"
                  onClick={() => {
                    toggle.mutate({ id: pro.id, block: !blocked });
                    setMenu(false);
                  }}
                  disabled={toggle.isPending}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted",
                    blocked ? "text-success" : "text-destructive",
                  )}
                >
                  {toggle.isPending ? (
                    <Spinner />
                  ) : blocked ? (
                    <CircleCheck className="size-4" />
                  ) : (
                    <Ban className="size-4" />
                  )}
                  {blocked ? "Activar" : "Bloquear"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

function NewProfessionalDialog({ onClose }: { onClose: () => void }) {
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const create = useCreateProfessional();

  function submit() {
    create.mutate(
      { businessName: businessName.trim(), ownerName: ownerName.trim(), ownerEmail: ownerEmail.trim() },
      { onSuccess: onClose },
    );
  }

  const canSubmit = businessName.trim().length > 1 && ownerEmail.includes("@");

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo profesional</DialogTitle>
          <DialogDescription>
            Se crea la cuenta y se le envía un código para que la reclame y elija su contraseña.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3.5 px-6 pb-2">
          <div>
            <Label htmlFor="np-biz">Nombre del negocio</Label>
            <Input id="np-biz" className="mt-1.5" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Barbería Don Carlos" />
          </div>
          <div>
            <Label htmlFor="np-owner">Nombre del dueño</Label>
            <Input id="np-owner" className="mt-1.5" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Carlos Méndez" />
          </div>
          <div>
            <Label htmlFor="np-email">Email del dueño</Label>
            <Input id="np-email" type="email" className="mt-1.5" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="carlos@email.com" />
          </div>
        </div>
        <div className="p-6 pt-3">
          <Button className="w-full" disabled={!canSubmit || create.isPending} onClick={submit}>
            {create.isPending ? <Spinner /> : null}
            Crear y enviar invitación
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
