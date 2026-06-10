"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Phone,
  Mail,
  Lock,
  Plus,
  Save,
  CalendarPlus,
  Archive,
  FileDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ErrorState, EmptyState } from "@/components/state-views";
import { ImageUpload } from "@/components/image-upload";
import {
  useClient,
  useClientNotes,
  useFichaFields,
  useAddClientNote,
  useUpdateFicha,
} from "@/lib/api/clients";
import { FichaFieldType } from "@/lib/api/generated/model/fichaFieldType";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FichaField } from "@/lib/api/generated/model/fichaField";

export function ClientDetail({ clientId }: { clientId: string }) {
  const client = useClient(clientId);

  return (
    <div className="mx-auto max-w-2xl px-5 py-6 sm:px-8">
      <Link
        href="/app/clientes"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Clientes
      </Link>

      {client.isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      )}
      {client.isError && (
        <ErrorState title="No encontramos al cliente" onRetry={() => client.refetch()} />
      )}

      {client.data && (
        <div className="space-y-7">
          {/* Header */}
          <div>
            <div className="flex items-start gap-3">
              <span className="grid size-14 shrink-0 place-items-center rounded-full bg-muted font-display text-xl font-semibold">
                {client.data.fullName.charAt(0)}
              </span>
              <div className="min-w-0 flex-1">
                <h1 className="font-display text-2xl font-semibold tracking-tight">
                  {client.data.fullName}
                </h1>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {client.data.phone && (
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="size-3.5" />
                      {client.data.phone}
                    </span>
                  )}
                  {client.data.email && (
                    <span className="inline-flex items-center gap-1.5">
                      <Mail className="size-3.5" />
                      {client.data.email}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {client.data.visitCount} visitas
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/app/agenda">
                  <CalendarPlus className="size-4" />
                  Nuevo turno
                </Link>
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <FileDown className="size-4" />
                Exportar ficha
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                disabled
                title="Próximamente"
              >
                <Archive className="size-4" />
                Archivar
              </Button>
            </div>
          </div>

          <Separator />

          {/* Ficha dinámica */}
          <FichaSection clientId={clientId} fichaValues={client.data.fichaValues} />

          <Separator />

          {/* Notas privadas */}
          <NotesSection clientId={clientId} />
        </div>
      )}
    </div>
  );
}

/* ---------- Ficha dinámica ---------- */
function FichaSection({
  clientId,
  fichaValues,
}: {
  clientId: string;
  fichaValues: Record<string, unknown>;
}) {
  const fields = useFichaFields();
  const update = useUpdateFicha(clientId);
  const [values, setValues] = useState<Record<string, unknown>>(fichaValues);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setValues(fichaValues);
    setDirty(false);
  }, [fichaValues]);

  function set(id: string, v: unknown) {
    setValues((prev) => ({ ...prev, [id]: v }));
    setDirty(true);
  }

  return (
    <section>
      <h2 className="mb-3 font-display text-sm font-semibold text-muted-foreground">
        Ficha del cliente
      </h2>
      {fields.isLoading ? (
        <Skeleton className="h-24 w-full rounded-xl" />
      ) : (fields.data ?? []).length === 0 ? (
        <EmptyState title="Sin campos de ficha" message="Configurá campos en ajustes." />
      ) : (
        <div className="space-y-4">
          {(fields.data ?? [])
            .slice()
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map((f) => (
              <FichaInput key={f.id} field={f} clientId={clientId} value={values[f.id]} onChange={(v) => set(f.id, v)} />
            ))}
          {dirty && (
            <Button size="sm" onClick={() => update.mutate(values, { onSuccess: () => setDirty(false) })} disabled={update.isPending}>
              {update.isPending ? <Spinner /> : <Save className="size-4" />}
              Guardar cambios
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

function FichaInput({
  field,
  clientId,
  value,
  onChange,
}: {
  field: FichaField;
  clientId: string;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const id = `ficha-${field.id}`;
  if (field.type === FichaFieldType.photo) {
    return (
      <div>
        <Label>{field.label}</Label>
        <ImageUpload
          className="mt-1.5"
          ownerType="client_ficha"
          ownerId={clientId}
          fileId={(value as string) || null}
          label="Subir foto"
          onUploaded={(file) => onChange(file.id)}
          onRemoved={() => onChange(null)}
        />
      </div>
    );
  }
  if (field.type === FichaFieldType.boolean) {
    return (
      <label className="flex items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          className="size-4 accent-[var(--color-accent)]"
        />
        {field.label}
      </label>
    );
  }
  if (field.type === FichaFieldType.select) {
    const choices = (field.options as { choices?: string[] } | null)?.choices ?? [];
    return (
      <div>
        <Label htmlFor={id}>{field.label}</Label>
        <select
          id={id}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1.5 h-10 w-full rounded-lg border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">—</option>
          {choices.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
    );
  }
  const inputType =
    field.type === FichaFieldType.number
      ? "number"
      : field.type === FichaFieldType.date
        ? "date"
        : "text";
  return (
    <div>
      <Label htmlFor={id}>{field.label}</Label>
      <Input
        id={id}
        type={inputType}
        className="mt-1.5"
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/* ---------- Notas privadas ---------- */
function NotesSection({ clientId }: { clientId: string }) {
  const notes = useClientNotes(clientId);
  const addNote = useAddClientNote(clientId);
  const [text, setText] = useState("");

  function add() {
    if (text.trim().length < 2) return;
    addNote.mutate(text.trim(), { onSuccess: () => setText("") });
  }

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <h2 className="font-display text-sm font-semibold text-muted-foreground">
          Notas privadas
        </h2>
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          <Lock className="size-3" />
          Solo vos
        </span>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        El cliente nunca ve estas notas. Usalas para recordar preferencias, alergias o lo
        que necesites.
      </p>

      {/* Agregar nota */}
      <div className="rounded-xl border border-border bg-card p-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribí una nota… (preferencias, alergias, observaciones)"
          rows={2}
          className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <div className="mt-2 flex justify-end">
          <Button size="sm" onClick={add} disabled={text.trim().length < 2 || addNote.isPending}>
            {addNote.isPending ? <Spinner /> : <Plus className="size-4" />}
            Agregar nota
          </Button>
        </div>
      </div>

      {/* Lista */}
      <div className="mt-4 space-y-2.5">
        {notes.isLoading && <Skeleton className="h-16 w-full rounded-xl" />}
        {notes.data && notes.data.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Sin notas todavía.
          </p>
        )}
        {(notes.data ?? []).map((n) => (
          <article
            key={n.id}
            className={cn(
              "rounded-xl border border-border bg-card p-3.5",
              n.body.includes("OJO") || n.body.toLowerCase().includes("alérg")
                ? "border-warning/40 bg-warning/5"
                : "",
            )}
          >
            <p className="text-sm">{n.body}</p>
            <p className="mt-1.5 text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
