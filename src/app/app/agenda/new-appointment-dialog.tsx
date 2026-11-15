"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CalendarX, Check, Search, UserPlus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { customInstance } from "@/lib/api/axios-instance";
import { appointmentsBookSeries } from "@/lib/api/generated/endpoints/appointments/appointments";
import type { BookSeriesResultDto } from "@/lib/api/generated/model/bookSeriesResultDto";
import { useClients } from "@/lib/api/clients";
import {
  getApiErrorMessage,
  getApiValidationMessages,
  matchFieldErrors,
} from "@/lib/api/error-message";
import {
  formatDateLong,
  formatDateShort,
  formatDuration,
  formatMoney,
  formatTime,
  formatWeekday,
  titleCaseName,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Staff } from "@/lib/api/generated/model/staff";
import type { Service } from "@/lib/api/generated/model/service";
import type { EnrichedClient } from "@/mocks/contract-extensions";
import {
  fromDateInputValue,
  TimeField,
  toDateInputValue,
  useTimeChoice,
} from "./time-picker";

/** Lo que hace falta de un cliente ya existente para cargarle el turno. */
export type ClientChoice = Pick<EnrichedClient, "personId" | "fullName" | "phone">;

/** Sin acentos ni mayúsculas, para buscar clientes por nombre. */
function norm(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Crea un turno desde la agenda (carga manual del profesional).
 *
 * - Cliente: se busca entre los que ya tiene (por nombre o teléfono) y el turno queda en SU
 *   ficha. Antes solo se tipeaba un nombre suelto y cada turno creaba un cliente nuevo
 *   duplicado. Si es alguien nuevo, se carga con nombre y teléfono (el teléfono es lo que
 *   permite reconocerlo la próxima vez).
 * - Hora: se elige entre los horarios libres de ese día para el servicio y quien atiende;
 *   "Otro horario" deja tipear uno a mano (sobreturno, fuera del horario habitual).
 */
export function NewAppointmentDialog({
  date: initialDate,
  staff,
  services,
  onClose,
  onCreated,
  initialClient,
  initialServiceId,
  initialStaffId,
  initialTime,
}: {
  date: Date;
  staff: Staff[];
  services: Service[];
  onClose: () => void;
  onCreated: () => void;
  /** Cliente ya elegido (por ejemplo, alguien de la lista de espera). */
  initialClient?: ClientChoice;
  /** Servicio preseleccionado, si existe entre `services`. */
  initialServiceId?: string | null;
  /** Quién atiende, preseleccionado si existe entre `staff`. */
  initialStaffId?: string | null;
  /** Hora preferida "HH:mm": se elige sola si ese día está libre ("darle el mismo turno"). */
  initialTime?: string | null;
}) {
  const [serviceId, setServiceId] = useState(
    services.find((s) => s.id === initialServiceId)?.id ?? services[0]?.id ?? "",
  );
  const [staffId, setStaffId] = useState(
    staff.find((s) => s.id === initialStaffId)?.id ?? staff[0]?.id ?? "",
  );
  // El día viene de la agenda, pero se puede cambiar acá mismo.
  const [date, setDate] = useState(initialDate);
  const service = services.find((s) => s.id === serviceId);

  // ---- Hora: horarios libres del día o uno tipeado a mano ----
  const timeChoice = useTimeChoice(date, staffId, serviceId, initialTime);

  function pickDate(value: string) {
    const d = fromDateInputValue(value);
    if (!d) return;
    setDate(d);
    timeChoice.reset();
  }
  const startAt = timeChoice.startAt;

  function pickService(id: string) {
    setServiceId(id);
    timeChoice.reset(); // los horarios libres dependen del servicio (por su duración)
  }

  // ---- Turno fijo: repetir cada N semanas ----
  const [everyWeeks, setEveryWeeks] = useState(0); // 0 = no se repite
  const [count, setCount] = useState("8");
  const repeatCount = Math.min(52, Math.max(2, Number(count) || 0));
  const lastDate =
    everyWeeks > 0 && startAt
      ? new Date(startAt.getTime() + (repeatCount - 1) * everyWeeks * 7 * 86_400_000)
      : null;
  // Resultado de un turno fijo con fechas que no se pudieron dar: se muestra antes de cerrar.
  const [seriesResult, setSeriesResult] = useState<BookSeriesResultDto | null>(null);

  // ---- Cliente: uno existente o uno nuevo ----
  const clients = useClients();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ClientChoice | null>(initialClient ?? null);
  const [isNew, setIsNew] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  const matches = useMemo(() => {
    const q = norm(query.trim());
    if (q.length < 2) return [];
    const digits = q.replace(/\D/g, "");
    return (clients.data ?? [])
      .filter((c) => c.status !== "archived")
      .filter(
        (c) =>
          norm(c.fullName ?? "").includes(q) ||
          (digits.length >= 3 && (c.phone ?? "").replace(/\D/g, "").includes(digits)),
      )
      .slice(0, 6);
  }, [clients.data, query]);

  function startNewClient() {
    setIsNew(true);
    // Si lo que buscó parece un teléfono va al teléfono; si no, es el nombre.
    const q = query.trim();
    if (/^[\d\s+()-]{6,}$/.test(q)) setPhone(q);
    else setFullName(q);
  }

  function clearClient() {
    setSelected(null);
    setIsNew(false);
    setFullName("");
    setPhone("");
  }

  const create = useMutation({
    mutationFn: async () => {
      const data = {
        ...(selected
          ? { personId: selected.personId }
          : {
              fullName: fullName.trim() || "Cliente sin nombre",
              phone: phone.trim() || undefined,
            }),
        staffId,
        serviceId,
        startAt: startAt!.toISOString(),
      };
      if (everyWeeks === 0) {
        await customInstance({ url: "/v1/appointments", method: "POST", data });
        return null;
      }
      return appointmentsBookSeries({ ...data, everyWeeks, count: repeatCount });
    },
    onSuccess: (series) => {
      // Turno fijo con fechas salteadas: se muestran cuáles antes de cerrar.
      if (series && series.skipped.length > 0) setSeriesResult(series);
      else onCreated();
    },
  });

  // Errores por campo (cuando es validación 400).
  const fieldErrors = create.isError
    ? matchFieldErrors(getApiValidationMessages(create.error), [
        "fullName",
        "phone",
        "email",
        "staffId",
        "serviceId",
        "startAt",
      ])
    : {};

  // El backend valida el teléfono según la provincia (no siempre 10 dígitos);
  // mostramos un mensaje neutral en vez del texto crudo que asume 10 dígitos.
  if (fieldErrors.phone) {
    fieldErrors.phone = "Revisá el número de teléfono.";
  }

  // Mensaje principal: si el único problema es el teléfono, usamos ese copy;
  // si no, mostramos el mensaje del backend.
  const errorMessage = !create.isError
    ? null
    : Object.keys(fieldErrors).length === 1 && fieldErrors.phone
      ? fieldErrors.phone
      : getApiErrorMessage(create.error);

  const canSubmit = !!serviceId && !!staffId && !!startAt;

  if (seriesResult) {
    return (
      <Dialog open onOpenChange={(o) => !o && onCreated()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {seriesResult.created.length === 1
                ? "Quedó 1 turno"
                : `Quedaron ${seriesResult.created.length} turnos`}
            </DialogTitle>
            <DialogDescription>
              {seriesResult.skipped.length === 1
                ? "Esta fecha no se pudo dar:"
                : `Estas ${seriesResult.skipped.length} fechas no se pudieron dar:`}
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 px-6">
            {seriesResult.skipped.map((s) => (
              <li
                key={s.startAt}
                className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm"
              >
                <CalendarX className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>
                  <span className="font-medium">
                    {formatWeekday(s.startAt)} {formatDateShort(s.startAt)} ·{" "}
                    {formatTime(s.startAt)}
                  </span>
                  <span className="block text-xs text-muted-foreground">{s.reason}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="px-6 text-xs text-muted-foreground">
            Si querés, dale esas fechas a otra hora con &quot;Nuevo turno&quot;.
          </p>
          <div className="p-6 pt-3">
            <Button className="w-full" onClick={onCreated}>
              Entendido
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo turno</DialogTitle>
          <DialogDescription className="capitalize">
            {formatDateLong(date)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 pb-2">
          {/* Cliente */}
          <div>
            <Label htmlFor={selected ? undefined : isNew ? "na-name" : "na-search"}>Cliente</Label>

            {selected ? (
              <div className="mt-1.5 flex items-center gap-3 rounded-lg border border-accent bg-accent/10 px-3 py-2">
                <Check className="size-4 shrink-0 text-accent" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {titleCaseName(selected.fullName ?? "") || "Cliente sin nombre"}
                  </p>
                  {selected.phone && (
                    <p className="truncate text-xs text-muted-foreground">{selected.phone}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={clearClient}
                  aria-label="Cambiar de cliente"
                  className="grid size-7 place-items-center rounded-md text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : isNew ? (
              <div className="mt-1.5 space-y-2 rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Cliente nuevo</p>
                  <button
                    type="button"
                    onClick={clearClient}
                    className="text-xs font-medium text-accent hover:underline"
                  >
                    Buscar uno existente
                  </button>
                </div>
                <Input
                  id="na-name"
                  className={cn(fieldErrors.fullName && "border-destructive")}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nombre y apellido"
                  autoFocus
                />
                <Input
                  id="na-phone"
                  aria-label="Teléfono"
                  className={cn(fieldErrors.phone && "border-destructive")}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Teléfono / WhatsApp"
                  inputMode="tel"
                />
                <p className="text-xs text-muted-foreground">
                  Con el teléfono lo vas a encontrar la próxima vez y no se duplica en tu lista de
                  clientes.
                </p>
              </div>
            ) : (
              <>
                <div className="relative mt-1.5">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="na-search"
                    className="pl-9"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscá por nombre o teléfono"
                    autoComplete="off"
                  />
                </div>
                {query.trim().length >= 2 && (
                  <ul className="mt-1.5 overflow-hidden rounded-lg border border-border">
                    {matches.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => setSelected(c)}
                          className="flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2 text-left text-sm hover:bg-accent/10"
                        >
                          <span className="truncate font-medium">
                            {titleCaseName(c.fullName ?? "") || "Cliente sin nombre"}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">{c.phone}</span>
                        </button>
                      </li>
                    ))}
                    <li>
                      <button
                        type="button"
                        onClick={startNewClient}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-accent hover:bg-accent/10"
                      >
                        <UserPlus className="size-4" />
                        {matches.length === 0
                          ? `No está en tu lista: cargar "${query.trim()}" como cliente nuevo`
                          : "Es otra persona: cargar cliente nuevo"}
                      </button>
                    </li>
                  </ul>
                )}
                {query.trim().length < 2 && (
                  <button
                    type="button"
                    onClick={startNewClient}
                    className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
                  >
                    <UserPlus className="size-3.5" />
                    Cargar cliente nuevo
                  </button>
                )}
              </>
            )}
            {fieldErrors.fullName && (
              <p className="mt-1 text-xs text-destructive">{fieldErrors.fullName}</p>
            )}
            {(fieldErrors.phone || fieldErrors.email) && (
              <p className="mt-1 text-xs text-destructive">
                {fieldErrors.phone ?? fieldErrors.email}
              </p>
            )}
          </div>

          {/* Servicio */}
          <div>
            <Label>
              Servicio <span className="text-destructive">*</span>
            </Label>
            <div className="mt-1.5 space-y-2">
              {services.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => pickService(s.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                    serviceId === s.id
                      ? "border-accent bg-accent/10"
                      : "border-border hover:border-accent/50",
                  )}
                >
                  <span>
                    {s.name}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {formatDuration(s.durationMinutes)}
                    </span>
                  </span>
                  <span className="font-medium tabular-nums">{formatMoney(s.priceCents)}</span>
                </button>
              ))}
            </div>
            {fieldErrors.serviceId && (
              <p className="mt-1 text-xs text-destructive">{fieldErrors.serviceId}</p>
            )}
          </div>

          {/* Quién atiende */}
          {staff.length > 1 && (
            <div>
              <Label htmlFor="na-staff">
                Profesional <span className="text-destructive">*</span>
              </Label>
              <select
                id="na-staff"
                value={staffId}
                onChange={(e) => {
                  setStaffId(e.target.value);
                  timeChoice.reset();
                }}
                className={cn(
                  "mt-1.5 h-10 w-full rounded-lg border bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  fieldErrors.staffId ? "border-destructive" : "border-input",
                )}
              >
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.displayName}
                  </option>
                ))}
              </select>
              {fieldErrors.staffId && (
                <p className="mt-1 text-xs text-destructive">{fieldErrors.staffId}</p>
              )}
            </div>
          )}

          {/* Día */}
          <div>
            <Label htmlFor="na-date">Día</Label>
            <Input
              id="na-date"
              type="date"
              className="mt-1.5"
              value={toDateInputValue(date)}
              onChange={(e) => pickDate(e.target.value)}
            />
          </div>

          {/* Hora */}
          <TimeField choice={timeChoice} inputId="na-time" error={fieldErrors.startAt} />
          {timeChoice.preferredMissing && !timeChoice.slotStart && !timeChoice.useManual && (
            <p className="-mt-2 text-xs text-muted-foreground">
              A las {initialTime} no está libre ese día: elegí otra hora u otro día.
            </p>
          )}

          {/* Turno fijo */}
          <div>
            <Label htmlFor="na-repeat">Repetir</Label>
            <select
              id="na-repeat"
              value={everyWeeks}
              onChange={(e) => setEveryWeeks(Number(e.target.value))}
              className="mt-1.5 h-10 w-full rounded-lg border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value={0}>No se repite</option>
              <option value={1}>Cada semana (turno fijo)</option>
              <option value={2}>Cada 2 semanas</option>
              <option value={3}>Cada 3 semanas</option>
              <option value={4}>Cada 4 semanas</option>
            </select>
            {everyWeeks > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <Label htmlFor="na-count" className="font-normal">
                  Cantidad de turnos
                </Label>
                <Input
                  id="na-count"
                  type="number"
                  inputMode="numeric"
                  min={2}
                  max={52}
                  className="h-9 w-20"
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                />
                {lastDate && (
                  <span className="text-xs text-muted-foreground">
                    El último, el {formatWeekday(lastDate).toLowerCase()}{" "}
                    {formatDateShort(lastDate)}
                  </span>
                )}
                <p className="w-full text-xs text-muted-foreground">
                  Si alguna fecha cae en un feriado, en tus vacaciones o ya tenés otro turno a esa
                  hora, esa se saltea y te avisamos cuál.
                </p>
              </div>
            )}
          </div>

          {errorMessage && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {errorMessage}
            </div>
          )}
        </div>

        <div className="p-6 pt-3">
          <Button
            className="w-full"
            disabled={!canSubmit || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? <Spinner /> : null}
            {everyWeeks > 0 ? `Crear ${repeatCount} turnos` : "Crear turno"}
            {startAt ? ` · ${formatTime(startAt.toISOString())}` : ""}
            {everyWeeks === 0 && service ? ` · ${formatMoney(service.priceCents)}` : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
