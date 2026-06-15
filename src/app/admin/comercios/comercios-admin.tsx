"use client";

import { useEffect, useState } from "react";
import { Search, Store, Mail, Users, Trash2, RotateCcw, Plus } from "lucide-react";
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
  useAdminComercios,
  useCreateComercio,
  useDeleteComercio,
  useRestoreComercio,
} from "@/lib/api/admin";
import { formatDateShort, titleCaseName } from "@/lib/format";
import { toSlug } from "@/lib/slug";
import { cn } from "@/lib/utils";
import { Pager } from "../pager";
import { StatusTabs } from "../status-tabs";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import type { AdminComercioDto } from "@/lib/api/generated/model/adminComercioDto";
import type { ListStatusFilter } from "@/lib/api/generated/model/listStatusFilter";

const PAGE_SIZE = 20;

export function ComerciosAdmin() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<ListStatusFilter>("active");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const debouncedQ = useDebouncedValue(q.trim(), 300);

  const { data, isLoading, isFetching, isError, refetch } = useAdminComercios({
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
          <h1 className="font-display text-2xl font-semibold tracking-tight">Comercios</h1>
          <p className="text-sm text-muted-foreground">Comercios de la plataforma y sus integrantes</p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          <span className="hidden sm:inline">Nuevo comercio</span>
        </Button>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <StatusTabs value={status} onChange={setStatus} />
        <div className="relative sm:w-72">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre o slug…"
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
        {isError && <ErrorState message="No pudimos cargar los comercios." onRetry={() => refetch()} />}
        {data && items.length === 0 && (
          <EmptyState
            icon={<Store className="size-5" />}
            title={
              debouncedQ
                ? "Sin resultados"
                : status === "deleted"
                  ? "No hay comercios eliminados"
                  : "Todavía no hay comercios"
            }
            message={
              debouncedQ
                ? "Probá otra búsqueda."
                : status === "deleted"
                  ? "Cuando elimines un comercio, va a aparecer acá para que puedas restaurarlo."
                  : "Los comercios se crean desde el panel comercial."
            }
          />
        )}
        {items.length > 0 && (
          <>
            <ul className={cn("space-y-2.5", isFetching && "opacity-60")}>
              {items.map((row) => (
                <ComercioRow key={row.comercio.id} row={row} />
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

      {creating && <NewComercioDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

function ComercioRow({ row }: { row: AdminComercioDto }) {
  const { comercio } = row;
  const restore = useRestoreComercio();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isDeleted = Boolean(comercio.deletedAt);
  const name = titleCaseName(comercio.name) || comercio.name;

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
            {!isDeleted && comercio.isPersonal && <Badge variant="default">Personal</Badge>}
          </div>
          <p className="truncate text-xs text-muted-foreground">/{comercio.slug}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
            {row.ownerEmail && (
              <span className="inline-flex items-center gap-1">
                <Mail className="size-3" /> {row.ownerEmail}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Users className="size-3" /> {row.activeMembers}{" "}
              {row.activeMembers === 1 ? "integrante" : "integrantes"}
            </span>
            {isDeleted && comercio.deletedAt && (
              <span>Eliminado el {formatDateShort(comercio.deletedAt)}</span>
            )}
          </p>
        </div>

        {isDeleted ? (
          <Button
            variant="outline"
            size="sm"
            loading={restore.isPending}
            onClick={() => restore.mutate(comercio.id)}
          >
            <RotateCcw className="size-4" />
            <span className="hidden sm:inline">Restaurar</span>
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Eliminar comercio"
            className="text-destructive hover:bg-destructive/10"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>

      {confirmDelete && (
        <DeleteComercioDialog name={name} comercioId={comercio.id} onClose={() => setConfirmDelete(false)} />
      )}
    </li>
  );
}

function DeleteComercioDialog({
  name,
  comercioId,
  onClose,
}: {
  name: string;
  comercioId: string;
  onClose: () => void;
}) {
  const del = useDeleteComercio();
  const [error, setError] = useState(false);

  function submit() {
    setError(false);
    del.mutate(comercioId, {
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
            Esto eliminará el comercio y sus membresías, y bloqueará la cuenta comercial dueña.
            Los turnos y pagos pasados se conservan. Va a quedar como «Eliminado» y vas a poder
            restaurarlo cuando quieras.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p className="px-6 text-sm text-destructive">No pudimos eliminar el comercio. Probá de nuevo.</p>
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

function NewComercioDialog({ onClose }: { onClose: () => void }) {
  const [comercioName, setComercioName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const create = useCreateComercio();

  const effectiveSlug = slugTouched ? slug : toSlug(comercioName);
  const canSubmit =
    comercioName.trim().length > 1 &&
    effectiveSlug.length > 1 &&
    email.includes("@") &&
    password.length >= 8;

  function submit() {
    setError(null);
    create.mutate(
      {
        email: email.trim(),
        password,
        comercioName: comercioName.trim(),
        slug: effectiveSlug,
        address: address.trim() || undefined,
      },
      {
        onSuccess: onClose,
        onError: () => setError("No pudimos crear el comercio. ¿El email o el enlace ya existen?"),
      },
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo comercio</DialogTitle>
          <DialogDescription>
            Se crea la cuenta comercial (con email y contraseña) junto con su comercio. El dueño
            podrá ingresar con esas credenciales.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3.5 px-6 pb-2">
          <div>
            <Label htmlFor="ncom-name">Nombre del comercio</Label>
            <Input
              id="ncom-name"
              className="mt-1.5"
              value={comercioName}
              onChange={(e) => setComercioName(e.target.value)}
              placeholder="Peluquería Centro"
            />
          </div>
          <div>
            <Label htmlFor="ncom-slug">Enlace público</Label>
            <div className="mt-1.5 flex items-center rounded-lg border border-input bg-card pl-3 focus-within:ring-2 focus-within:ring-ring">
              <span className="select-none text-sm text-muted-foreground">/</span>
              <input
                id="ncom-slug"
                value={effectiveSlug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(toSlug(e.target.value));
                }}
                placeholder="peluqueria-centro"
                className="h-10 w-full bg-transparent px-2 text-sm outline-none"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="ncom-address">Dirección (opcional)</Label>
            <Input
              id="ncom-address"
              className="mt-1.5"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Av. Mitre 123"
            />
          </div>
          <div>
            <Label htmlFor="ncom-email">Email del dueño</Label>
            <Input
              id="ncom-email"
              type="email"
              className="mt-1.5"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="dueno@comercio.com"
            />
          </div>
          <div>
            <Label htmlFor="ncom-pass">Contraseña</Label>
            <Input
              id="ncom-pass"
              type="password"
              className="mt-1.5"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
            />
            {password.length > 0 && password.length < 8 && (
              <p className="mt-1 text-xs text-destructive">La contraseña debe tener al menos 8 caracteres.</p>
            )}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <div className="p-6 pt-3">
          <Button className="w-full" disabled={!canSubmit} loading={create.isPending} onClick={submit}>
            Crear comercio
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
