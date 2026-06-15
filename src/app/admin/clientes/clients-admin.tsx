"use client";

import { useEffect, useState } from "react";
import { Search, Users, Mail, Phone, Trash2, RotateCcw, Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  useAdminClients,
  useAdminProfessionals,
  useCreateClient,
  useDeleteClient,
  useRestoreClient,
} from "@/lib/api/admin";
import { formatDateShort, titleCaseName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Pager } from "../pager";
import { StatusTabs } from "../status-tabs";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import type { AdminClientDto } from "@/lib/api/generated/model/adminClientDto";
import type { ListStatusFilter } from "@/lib/api/generated/model/listStatusFilter";

const PAGE_SIZE = 20;

export function ClientsAdmin() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<ListStatusFilter>("active");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const debouncedQ = useDebouncedValue(q.trim(), 300);

  const { data, isLoading, isFetching, isError, refetch } = useAdminClients({
    q: debouncedQ || undefined,
    status,
    page,
    pageSize: PAGE_SIZE,
  });

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, status]);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="mx-auto max-w-4xl px-5 py-6 sm:px-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            Todos los clientes de la plataforma y el profesional al que pertenecen
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          <span className="hidden sm:inline">Nuevo cliente</span>
        </Button>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <StatusTabs value={status} onChange={setStatus} />
        <div className="relative sm:w-80">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, email o teléfono…"
          />
        </div>
      </div>

      <div className="mt-5">
        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        )}
        {isError && <ErrorState message="No pudimos cargar los clientes." onRetry={() => refetch()} />}
        {data && items.length === 0 && (
          <EmptyState
            icon={<Users className="size-5" />}
            title={
              debouncedQ
                ? "Sin resultados"
                : status === "deleted"
                  ? "No hay clientes eliminados"
                  : "Todavía no hay clientes"
            }
            message={
              debouncedQ
                ? "Probá otra búsqueda."
                : status === "deleted"
                  ? "Cuando elimines un cliente, va a aparecer acá para que puedas restaurarlo."
                  : "Los clientes aparecen acá cuando los profesionales los cargan."
            }
          />
        )}
        {items.length > 0 && (
          <>
            <ul className={cn("space-y-2.5", isFetching && "opacity-60")}>
              {items.map((client) => (
                <ClientRow key={client.id} client={client} />
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

      {creating && <NewClientDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

function ClientRow({ client }: { client: AdminClientDto }) {
  const restore = useRestoreClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isDeleted = Boolean(client.deletedAt);
  const name = titleCaseName(client.fullName) || "Sin nombre";

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
            "grid size-10 shrink-0 place-items-center rounded-xl bg-muted font-display text-sm font-semibold uppercase",
            isDeleted && "opacity-50",
          )}
        >
          {name.charAt(0)}
        </span>
        <div className={cn("min-w-0 flex-1", isDeleted && "opacity-60")}>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{name}</p>
            {isDeleted && <Badge variant="muted">Eliminado</Badge>}
            {!isDeleted && client.status === "archived" && (
              <Badge variant="muted">Archivado</Badge>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            Cliente de {titleCaseName(client.professionalName) || "—"}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
            {client.email && (
              <span className="inline-flex items-center gap-1">
                <Mail className="size-3" /> {client.email}
              </span>
            )}
            {client.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="size-3" /> {client.phone}
              </span>
            )}
            {isDeleted && client.deletedAt && <span>Eliminado el {formatDateShort(client.deletedAt)}</span>}
          </p>
        </div>

        {isDeleted ? (
          <Button
            variant="outline"
            size="sm"
            loading={restore.isPending}
            onClick={() => restore.mutate(client.id)}
          >
            <RotateCcw className="size-4" />
            <span className="hidden sm:inline">Restaurar</span>
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Eliminar cliente"
            className="text-destructive hover:bg-destructive/10"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>

      {confirmDelete && (
        <DeleteClientDialog
          name={name}
          professionalName={titleCaseName(client.professionalName)}
          clientId={client.id}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </li>
  );
}

function DeleteClientDialog({
  name,
  professionalName,
  clientId,
  onClose,
}: {
  name: string;
  professionalName: string;
  clientId: string;
  onClose: () => void;
}) {
  const del = useDeleteClient();
  const [error, setError] = useState(false);

  function submit() {
    setError(false);
    del.mutate(clientId, {
      onSuccess: onClose,
      onError: () => setError(true),
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar {name}</DialogTitle>
          <DialogDescription>
            Se quitará a este cliente de {professionalName || "su profesional"}. Si la persona
            no es cliente de ningún otro profesional, también se elimina su perfil global. Sus
            turnos y pagos pasados se conservan, y vas a poder restaurarlo después.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p className="px-6 text-sm text-destructive">No pudimos eliminar el cliente. Probá de nuevo.</p>
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

function NewClientDialog({ onClose }: { onClose: () => void }) {
  const [professionalId, setProfessionalId] = useState("");
  const [professionalLabel, setProfessionalLabel] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const create = useCreateClient();

  // El teléfono es opcional, pero si se carga el back exige 10 dígitos.
  const phoneDigits = phone.replace(/\D/g, "");
  const phoneValid = phoneDigits.length === 0 || phoneDigits.length === 10;
  const canSubmit =
    professionalId.length > 0 && fullName.trim().length > 1 && phoneValid;

  function submit() {
    setError(null);
    create.mutate(
      {
        professionalId,
        fullName: fullName.trim(),
        email: email.trim() || undefined,
        phone: phoneDigits || undefined,
      },
      {
        onSuccess: onClose,
        onError: () => setError("No pudimos crear el cliente. Revisá los datos e intentá de nuevo."),
      },
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo cliente</DialogTitle>
          <DialogDescription>
            Creá un cliente y asignalo a un profesional de la plataforma.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3.5 px-6 pb-2">
          <div>
            <Label>Profesional</Label>
            <ProfessionalPicker
              selectedId={professionalId}
              selectedLabel={professionalLabel}
              onSelect={(id, label) => {
                setProfessionalId(id);
                setProfessionalLabel(label);
              }}
              onClear={() => {
                setProfessionalId("");
                setProfessionalLabel("");
              }}
            />
          </div>
          <div>
            <Label htmlFor="nc-name">Nombre completo</Label>
            <Input
              id="nc-name"
              className="mt-1.5"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Juana Pérez"
            />
          </div>
          <div>
            <Label htmlFor="nc-email">Email (opcional)</Label>
            <Input
              id="nc-email"
              type="email"
              className="mt-1.5"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="juana@email.com"
            />
          </div>
          <div>
            <Label htmlFor="nc-phone">Celular (opcional)</Label>
            <Input
              id="nc-phone"
              inputMode="numeric"
              className="mt-1.5"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="2612465120"
            />
            {!phoneValid && (
              <p className="mt-1 text-xs text-destructive">
                El celular debe tener 10 dígitos (característica + número, sin 0/15/+54).
              </p>
            )}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <div className="p-6 pt-3">
          <Button className="w-full" disabled={!canSubmit} loading={create.isPending} onClick={submit}>
            Crear cliente
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Selector de profesional con búsqueda server-side (para no bajar cientos de profesionales).
 * Una vez elegido, muestra el seleccionado con opción de cambiarlo.
 */
function ProfessionalPicker({
  selectedId,
  selectedLabel,
  onSelect,
  onClear,
}: {
  selectedId: string;
  selectedLabel: string;
  onSelect: (id: string, label: string) => void;
  onClear: () => void;
}) {
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q.trim(), 300);
  const { data, isFetching } = useAdminProfessionals({
    q: debouncedQ || undefined,
    status: "active",
    page: 1,
    pageSize: 8,
  });

  if (selectedId) {
    return (
      <div className="mt-1.5 flex items-center justify-between gap-2 rounded-lg border border-input bg-muted/40 px-3 py-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium">
          <Check className="size-4 text-success" />
          {selectedLabel}
        </span>
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          Cambiar
        </Button>
      </div>
    );
  }

  const items = data?.items ?? [];

  return (
    <div className="mt-1.5">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar profesional por negocio o slug…"
        />
      </div>
      <div className="mt-1.5 max-h-44 overflow-y-auto rounded-lg border border-border">
        {items.length === 0 ? (
          <p className="px-3 py-3 text-sm text-muted-foreground">
            {isFetching ? "Buscando…" : "Sin profesionales para esa búsqueda."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((row) => (
              <li key={row.professional.id}>
                <button
                  type="button"
                  onClick={() => onSelect(row.professional.id, row.professional.businessName)}
                  className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  <span className="font-medium">{row.professional.businessName}</span>
                  <span className="text-xs text-muted-foreground">/r/{row.professional.slug}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
