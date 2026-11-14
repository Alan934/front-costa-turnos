"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Search, UserPlus, X } from "lucide-react";
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
import { useClients } from "@/lib/api/clients";
import {
  getApiErrorMessage,
  getApiValidationMessages,
  matchFieldErrors,
} from "@/lib/api/error-message";
import { formatDateLong, formatDuration, formatMoney, formatTime, titleCaseName } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Staff } from "@/lib/api/generated/model/staff";
import type { Service } from "@/lib/api/generated/model/service";
import type { EnrichedClient, Slot } from "@/mocks/contract-extensions";

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
  date,
  staff,
  services,
  onClose,
  onCreated,
  initialClient,
  initialServiceId,
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
}) {
  const [serviceId, setServiceId] = useState(
    services.find((s) => s.id === initialServiceId)?.id ?? services[0]?.id ?? "",
  );
  const [staffId, setStaffId] = useState(staff[0]?.id ?? "");
  const service = services.find((s) => s.id === serviceId);

  // ---- Hora: horarios libres del día o uno tipeado a mano ----
  const [slotStart, setSlotStart] = useState<string | null>(null);
  const [manualTime, setManualTime] = useState(false);
  const [time, setTime] = useState("10:00");

  const dayRange = useMemo(() => {
    const from = new Date(date);
    from.setHours(0, 0, 0, 0);
    const to = new Date(date);
    to.setHours(23, 59, 59, 999);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [date]);

  const slots = useQuery({
    queryKey: ["agenda-free-slots", staffId, serviceId, dayRange.from],
    queryFn: ({ signal }) =>
      customInstance<Slot[]>({
        url: "/v1/availability/slots",
        method: "GET",
        params: { staffId, serviceId, from: dayRange.from, to: dayRange.to },
        signal,
      }),
    enabled: !!staffId && !!serviceId,
  });
  // No se ofrecen horarios que ya pasaron (si el turno es para hoy).
  const freeSlots = (slots.data ?? []).filter((s) => +new Date(s.startAt) > Date.now());
  const useManual = manualTime || slots.isError;

  const startAt = useMemo(() => {
    if (!useManual) return slotStart ? new Date(slotStart) : null;
    const [h, m] = time.split(":").map(Number);
    const d = new Date(date);
    d.setHours(h || 0, m || 0, 0, 0);
    return d;
  }, [useManual, slotStart, time, date]);

  function pickService(id: string) {
    setServiceId(id);
    setSlotStart(null); // los horarios libres dependen del servicio (por su duración)
  }

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
    mutationFn: () =>
      customInstance({
        url: "/v1/appointments",
        method: "POST",
        data: {
          ...(selected
            ? { personId: selected.personId }
            : {
                fullName: fullName.trim() || "Cliente sin nombre",
                phone: phone.trim() || undefined,
              }),
          staffId,
          serviceId,
          startAt: startAt!.toISOString(),
        },
      }),
    onSuccess: onCreated,
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
                  setSlotStart(null);
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

          {/* Hora */}
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor={useManual ? "na-time" : undefined}>
                Hora <span className="text-destructive">*</span>
              </Label>
              {!slots.isError && (
                <button
                  type="button"
                  onClick={() => setManualTime((v) => !v)}
                  className="text-xs font-medium text-accent hover:underline"
                >
                  {manualTime ? "Ver horarios libres" : "Otro horario"}
                </button>
              )}
            </div>

            {useManual ? (
              <>
                <Input
                  id="na-time"
                  type="time"
                  className={cn("mt-1.5", fieldErrors.startAt && "border-destructive")}
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Cargás la hora a mano. Si se pisa con otro turno, te avisamos al crear.
                </p>
              </>
            ) : slots.isLoading ? (
              <p className="mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner /> Buscando horarios libres…
              </p>
            ) : freeSlots.length === 0 ? (
              <p className="mt-1.5 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                No quedan horarios libres este día para ese servicio. Usá{" "}
                <button
                  type="button"
                  onClick={() => setManualTime(true)}
                  className="font-medium text-accent hover:underline"
                >
                  otro horario
                </button>{" "}
                para cargar uno a mano.
              </p>
            ) : (
              <div className="mt-1.5 flex max-h-40 flex-wrap gap-2 overflow-y-auto">
                {freeSlots.map((s) => (
                  <button
                    key={s.startAt}
                    type="button"
                    onClick={() => setSlotStart(s.startAt)}
                    aria-pressed={slotStart === s.startAt}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-sm font-medium tabular-nums transition-colors",
                      slotStart === s.startAt
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border hover:border-accent/50",
                    )}
                  >
                    {formatTime(s.startAt)}
                  </button>
                ))}
              </div>
            )}
            {fieldErrors.startAt && (
              <p className="mt-1 text-xs text-destructive">{fieldErrors.startAt}</p>
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
            Crear turno
            {startAt ? ` · ${formatTime(startAt.toISOString())}` : ""}
            {service ? ` · ${formatMoney(service.priceCents)}` : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
