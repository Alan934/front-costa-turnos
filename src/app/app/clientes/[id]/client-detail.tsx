"use client";

import { useEffect, useMemo, useState } from "react";
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
  ArchiveRestore,
  FileDown,
  Repeat,
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
  useArchiveClient,
  useRestoreClient,
} from "@/lib/api/clients";
import { FichaFieldType } from "@/lib/api/generated/model/fichaFieldType";
import { useProfessionalsListStaff } from "@/lib/api/generated/endpoints/professionals/professionals";
import { useServices } from "@/lib/api/catalog";
import { formatDateShort, formatDateTime, formatTime, formatWeekday, titleCaseName } from "@/lib/format";
import { NewAppointmentDialog } from "@/app/app/agenda/new-appointment-dialog";
import type { Staff } from "@/lib/api/generated/model/staff";
import { cn } from "@/lib/utils";
import type { FichaField } from "@/lib/api/generated/model/fichaField";

/**
 * Archivar (con confirmación) o desarchivar. Archivar no borra nada: la ficha, las notas y el
 * historial quedan; solo sale de la lista y de la búsqueda al dar turno.
 */
function ArchiveButton({ clientId, archived }: { clientId: string; archived: boolean }) {
  const archive = useArchiveClient();
  const restore = useRestoreClient();
  const [confirming, setConfirming] = useState(false);
  const busy = archive.isPending || restore.isPending;

  if (archived) {
    return (
      <Button variant="outline" size="sm" onClick={() => restore.mutate(clientId)} disabled={busy}>
        {busy ? <Spinner /> : <ArchiveRestore className="size-4" />}
        Desarchivar
      </Button>
    );
  }
  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm">
        ¿Archivarlo?
        <Button
          size="sm"
          variant="outline"
          onClick={() => archive.mutate(clientId, { onSettled: () => setConfirming(false) })}
          disabled={busy}
        >
          {busy ? <Spinner /> : null}
          Sí, archivar
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
          No
        </Button>
      </span>
    );
  }
  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-muted-foreground"
      onClick={() => setConfirming(true)}
      title="Sale de tu lista de clientes. No se borra nada y lo podés desarchivar."
    >
      <Archive className="size-4" />
      Archivar
    </Button>
  );
}

/** Próximo día (desde mañana) que cae el mismo día de la semana que `from`. */
function nextSameWeekday(from: Date): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  while (d.getDay() !== from.getDay()) d.setDate(d.getDate() + 1);
  return d;
}

export function ClientDetail({ clientId }: { clientId: string }) {
  const client = useClient(clientId);
  const staffQuery = useProfessionalsListStaff();
  const servicesQuery = useServices();
  const staffList = (staffQuery.data ?? [])
    .filter((s: Staff) => s.isActive)
    .map((s: Staff) => ({ ...s, displayName: titleCaseName(s.displayName) }));
  const services = (servicesQuery.data ?? []).map((s) => ({ ...s, name: titleCaseName(s.name) }));
  // "Darle turno" (null) o "darle el mismo turno" (mismo servicio, día de la semana y hora).
  const [booking, setBooking] = useState<null | "new" | "same">(null);
  const [booked, setBooked] = useState(false);

  const last = client.data?.lastAppointmentAt ? new Date(client.data.lastAppointmentAt) : null;
  const lastService = services.find((s) => s.id === client.data?.lastServiceId);
  const sameDate = useMemo(() => (last ? nextSameWeekday(last) : null), [last?.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps
  const canBook = staffList.length > 0 && services.length > 0;

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
                {(client.data.fullName?.trim()?.charAt(0) ?? "?").toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <h1 className="font-display text-2xl font-semibold tracking-tight">
                  {client.data.fullName?.trim() || "Cliente sin nombre"}
                </h1>
                {client.data.status === "archived" && (
                  <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    <Archive className="size-3" />
                    Archivado: no aparece en tu lista ni al buscar para darle turno
                  </p>
                )}
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
                {client.data.visitCount != null && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {client.data.visitCount} {client.data.visitCount === 1 ? "visita" : "visitas"}
                  </p>
                )}
              </div>
            </div>
            {last && (
              <p className="mt-3 text-xs text-muted-foreground">
                Último turno: {formatWeekday(last).toLowerCase()} {formatDateShort(last)} a las{" "}
                {formatTime(last)}
                {lastService ? ` · ${lastService.name}` : ""}
                {client.data.nextAppointmentAt
                  ? ` · Próximo: ${formatDateShort(client.data.nextAppointmentAt)} a las ${formatTime(client.data.nextAppointmentAt)}`
                  : " · No tiene otro reservado"}
              </p>
            )}
            {booked && (
              <p className="mt-3 rounded-lg border border-success/40 bg-success/10 p-2.5 text-sm text-success">
                Listo: le diste turno. Lo ves en la agenda.
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {last && lastService && sameDate && (
                <Button
                  size="sm"
                  onClick={() => setBooking("same")}
                  disabled={!canBook}
                  title={`${lastService.name}, ${formatWeekday(last).toLowerCase()} a las ${formatTime(last)}`}
                >
                  <Repeat className="size-4" />
                  Darle el mismo turno
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBooking("new")}
                disabled={!canBook}
              >
                <CalendarPlus className="size-4" />
                Darle turno
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <FileDown className="size-4" />
                Exportar ficha
              </Button>
              <ArchiveButton clientId={clientId} archived={client.data.status === "archived"} />
            </div>
          </div>

          <Separator />

          {/* Ficha dinámica */}
          <FichaSection clientId={clientId} fichaValues={client.data.fichaValues ?? {}} />

          <Separator />

          {/* Notas privadas */}
          <NotesSection clientId={clientId} />
        </div>
      )}

      {booking && client.data && (
        <NewAppointmentDialog
          date={booking === "same" && sameDate ? sameDate : new Date()}
          staff={staffList}
          services={services}
          initialClient={{
            personId: client.data.personId,
            fullName: client.data.fullName,
            phone: client.data.phone,
          }}
          initialServiceId={client.data.lastServiceId}
          initialStaffId={booking === "same" ? client.data.lastStaffId : null}
          initialTime={booking === "same" && last ? formatTime(last) : null}
          onClose={() => setBooking(null)}
          onCreated={() => {
            setBooking(null);
            setBooked(true);
            void client.refetch();
          }}
        />
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
