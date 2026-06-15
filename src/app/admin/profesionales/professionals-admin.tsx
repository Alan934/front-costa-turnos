"use client";

import { useEffect, useState } from "react";
import { Search, Banknote, ExternalLink, Building2, MoreVertical, Check, Plus, Ban, CircleCheck, Trash2, RotateCcw } from "lucide-react";
import { Pager } from "../pager";
import { StatusTabs } from "../status-tabs";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import type { ListStatusFilter } from "@/lib/api/generated/model/listStatusFilter";
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
  useMarkCashPaid,
  useCreateProfessionalAccount,
  useBlockAccount,
  useActivateAccount,
  useDeleteProfessional,
  useRestoreProfessional,
} from "@/lib/api/admin";
import { SubscriptionStatus } from "@/lib/api/generated/model/subscriptionStatus";
import { subscriptionEndInfo } from "@/lib/subscription";
import { formatMoney, formatDateShort } from "@/lib/format";
import { toSlug } from "@/lib/slug";
import { cn } from "@/lib/utils";
import type { AdminProfessionalDto } from "@/lib/api/generated/model/adminProfessionalDto";

const SUB_LABELS: Record<SubscriptionStatus, { label: string; variant: "success" | "warning" | "muted" | "default" }> = {
  [SubscriptionStatus.trial]: { label: "Prueba", variant: "default" },
  [SubscriptionStatus.active]: { label: "Al día", variant: "success" },
  [SubscriptionStatus.past_due]: { label: "Pago pendiente", variant: "warning" },
  [SubscriptionStatus.grace]: { label: "En gracia", variant: "warning" },
  [SubscriptionStatus.blocked]: { label: "Bloqueada", variant: "warning" },
  [SubscriptionStatus.cancelled]: { label: "Baja", variant: "muted" },
};

const PAGE_SIZE = 20;

export function ProfessionalsAdmin() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<ListStatusFilter>("active");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const debouncedQ = useDebouncedValue(q.trim(), 300);

  const { data, isLoading, isFetching, isError, refetch } = useAdminProfessionals({
    q: debouncedQ || undefined,
    status,
    page,
    pageSize: PAGE_SIZE,
  });

  // Al cambiar la búsqueda o la pestaña, volvemos a la primera página.
  useEffect(() => {
    setPage(1);
  }, [debouncedQ, status]);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="mx-auto max-w-4xl px-5 py-6 sm:px-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Profesionales</h1>
          <p className="text-sm text-muted-foreground">Negocios en la plataforma y su estado de pago</p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          <span className="hidden sm:inline">Nuevo profesional</span>
        </Button>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <StatusTabs value={status} onChange={setStatus} />
        <div className="relative sm:w-72">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar negocio o slug…" />
        </div>
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
        {data && items.length === 0 && (
          <EmptyState
            icon={<Building2 className="size-5" />}
            title={
              debouncedQ
                ? "Sin resultados"
                : status === "deleted"
                  ? "No hay profesionales eliminados"
                  : "Todavía no hay profesionales"
            }
            message={
              debouncedQ
                ? "Probá otra búsqueda."
                : status === "deleted"
                  ? "Cuando elimines un profesional, va a aparecer acá para que puedas restaurarlo."
                  : "Los profesionales se registran solos desde la web."
            }
          />
        )}
        {items.length > 0 && (
          <>
            <ul className={cn("space-y-2.5", isFetching && "opacity-60")}>
              {items.map((row) => (
                <ProfessionalRow key={row.professional.id} row={row} />
              ))}
            </ul>
            <Pager
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              busy={isFetching}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      {creating && <NewProfessionalDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

function ProfessionalRow({ row }: { row: AdminProfessionalDto }) {
  const { professional: pro, subscription: sub } = row;
  const markCash = useMarkCashPaid();
  const block = useBlockAccount();
  const activate = useActivateAccount();
  const restore = useRestoreProfessional();
  const [menu, setMenu] = useState(false);
  const [paid, setPaid] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const meta = sub ? SUB_LABELS[sub.status] : null;
  const isDeleted = Boolean(pro.deletedAt);
  const busy =
    markCash.isPending || block.isPending || activate.isPending || restore.isPending;

  function registerCash() {
    markCash.mutate(pro.id, {
      onSuccess: () => {
        setPaid(true);
        setMenu(false);
        setTimeout(() => setPaid(false), 2500);
      },
    });
  }

  return (
    <li
      className={cn(
        "rounded-xl border border-border bg-card p-4",
        isDeleted && "border-dashed bg-muted/30",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-xl bg-muted font-display text-sm font-semibold",
            isDeleted && "opacity-50",
          )}
        >
          {pro.businessName.charAt(0)}
        </span>
        <div className={cn("min-w-0 flex-1", isDeleted && "opacity-60")}>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{pro.businessName}</p>
            {isDeleted ? (
              <Badge variant="muted">Eliminado</Badge>
            ) : meta ? (
              <Badge variant={meta.variant}>{meta.label}</Badge>
            ) : (
              <Badge variant="muted">Sin suscripción</Badge>
            )}
            {paid && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                <Check className="size-3.5" /> Pago registrado
              </span>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">/r/{pro.slug}</p>
          <p className="mt-1 flex flex-wrap gap-x-4 text-xs text-muted-foreground">
            {isDeleted ? (
              pro.deletedAt && <span>Eliminado el {formatDateShort(pro.deletedAt)}</span>
            ) : sub ? (
              <>
                <span>{formatMoney(sub.amountCents)}/mes</span>
                {(() => {
                  const end = subscriptionEndInfo(sub);
                  return end.date ? <span>{end.label} {formatDateShort(end.date)}</span> : null;
                })()}
              </>
            ) : null}
          </p>
        </div>

        {isDeleted ? (
          <Button
            variant="outline"
            size="sm"
            loading={restore.isPending}
            onClick={() => restore.mutate(pro.id)}
          >
            <RotateCcw className="size-4" />
            <span className="hidden sm:inline">Restaurar</span>
          </Button>
        ) : (
          <div className="relative">
            <Button variant="ghost" size="icon" aria-label="Acciones" onClick={() => setMenu((v) => !v)}>
              <MoreVertical className="size-4" />
            </Button>
            {menu && (
              <>
                <button type="button" aria-label="Cerrar menú" className="fixed inset-0 z-10 cursor-default" onClick={() => setMenu(false)} />
                <div className="absolute right-0 top-10 z-20 w-56 overflow-hidden rounded-xl border border-border bg-popover py-1 shadow-lg">
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
                    onClick={registerCash}
                    disabled={busy}
                    className={cn("flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted")}
                  >
                    {markCash.isPending ? <Spinner /> : <Banknote className="size-4" />}
                    Registré pago en efectivo
                  </button>
                  <button
                    type="button"
                    onClick={() => activate.mutate(pro.accountId, { onSuccess: () => setMenu(false) })}
                    disabled={busy}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-success hover:bg-muted"
                  >
                    {activate.isPending ? <Spinner /> : <CircleCheck className="size-4" />}
                    Activar cuenta
                  </button>
                  <button
                    type="button"
                    onClick={() => block.mutate(pro.accountId, { onSuccess: () => setMenu(false) })}
                    disabled={busy}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-muted"
                  >
                    {block.isPending ? <Spinner /> : <Ban className="size-4" />}
                    Bloquear cuenta
                  </button>
                  <div className="my-1 border-t border-border" />
                  <button
                    type="button"
                    onClick={() => {
                      setMenu(false);
                      setConfirmDelete(true);
                    }}
                    disabled={busy}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-muted"
                  >
                    <Trash2 className="size-4" />
                    Eliminar profesional
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {confirmDelete && (
        <DeleteProfessionalDialog
          businessName={pro.businessName}
          professionalId={pro.id}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </li>
  );
}

function DeleteProfessionalDialog({
  businessName,
  professionalId,
  onClose,
}: {
  businessName: string;
  professionalId: string;
  onClose: () => void;
}) {
  const del = useDeleteProfessional();
  const [error, setError] = useState(false);

  function submit() {
    setError(false);
    del.mutate(professionalId, {
      onSuccess: onClose,
      onError: () => setError(true),
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar {businessName}</DialogTitle>
          <DialogDescription>
            Esto eliminará al profesional, su agenda, y bloqueará su acceso a la plataforma.
            Sus turnos y pagos pasados se conservan. Va a quedar en la lista como «Eliminado»
            y vas a poder restaurarlo cuando quieras.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p className="px-6 text-sm text-destructive">No pudimos eliminar el profesional. Probá de nuevo.</p>
        )}
        <div className="flex gap-2 p-6 pt-3">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={del.isPending}>
            Cancelar
          </Button>
          <Button variant="destructive" className="flex-1" loading={del.isPending} onClick={submit}>
            Eliminar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NewProfessionalDialog({ onClose }: { onClose: () => void }) {
  const [businessName, setBusinessName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const create = useCreateProfessionalAccount();

  const effectiveSlug = slugTouched ? slug : toSlug(businessName);
  const canSubmit = businessName.trim().length > 1 && effectiveSlug.length > 1 && email.includes("@");

  function submit() {
    setError(null);
    create.mutate(
      { email: email.trim(), businessName: businessName.trim(), slug: effectiveSlug },
      {
        onSuccess: onClose,
        onError: () => setError("No pudimos crear el profesional. ¿El email o el enlace ya existen?"),
      },
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo profesional</DialogTitle>
          <DialogDescription>
            Se crea la cuenta + el negocio con prueba gratis y se le envía un email para que
            active su cuenta y elija su contraseña.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3.5 px-6 pb-2">
          <div>
            <Label htmlFor="np-biz">Nombre del negocio</Label>
            <Input
              id="np-biz"
              className="mt-1.5"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Barbería Don Carlos"
            />
          </div>
          <div>
            <Label htmlFor="np-slug">Enlace público</Label>
            <div className="mt-1.5 flex items-center rounded-lg border border-input bg-card pl-3 focus-within:ring-2 focus-within:ring-ring">
              <span className="select-none text-sm text-muted-foreground">/r/</span>
              <input
                id="np-slug"
                value={effectiveSlug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(toSlug(e.target.value));
                }}
                placeholder="barberia-don-carlos"
                className="h-10 w-full bg-transparent px-2 text-sm outline-none"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="np-email">Email del dueño</Label>
            <Input
              id="np-email"
              type="email"
              className="mt-1.5"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="carlos@email.com"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <div className="p-6 pt-3">
          <Button className="w-full" disabled={!canSubmit} loading={create.isPending} onClick={submit}>
            Crear y enviar activación
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
