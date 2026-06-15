"use client";

import { useEffect, useState } from "react";
import { Search, Store, Mail, Users, Trash2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useAdminComercios, useDeleteComercio, useRestoreComercio } from "@/lib/api/admin";
import { formatDateShort, titleCaseName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Pager } from "../pager";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import type { AdminComercioDto } from "@/lib/api/generated/model/adminComercioDto";

const PAGE_SIZE = 20;

export function ComerciosAdmin() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const debouncedQ = useDebouncedValue(q.trim(), 300);

  const { data, isLoading, isFetching, isError, refetch } = useAdminComercios({
    q: debouncedQ || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  useEffect(() => {
    setPage(1);
  }, [debouncedQ]);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="mx-auto max-w-4xl px-5 py-6 sm:px-8">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Comercios</h1>
        <p className="text-sm text-muted-foreground">Comercios de la plataforma y sus integrantes</p>
      </div>

      <div className="relative mt-5">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre o slug…"
        />
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
            title={debouncedQ ? "Sin resultados" : "Todavía no hay comercios"}
            message={debouncedQ ? "Probá otra búsqueda." : "Los comercios se crean desde el panel comercial."}
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
