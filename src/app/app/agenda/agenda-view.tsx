"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/state-views";
import { RefreshButton } from "@/components/refresh-button";
import { useProfessionalsListStaff } from "@/lib/api/generated/endpoints/professionals/professionals";
import { useAppointments, usePrefetchAppointments } from "@/lib/api/appointments";
import { useServices } from "@/lib/api/catalog";
import { usePersonLookup } from "@/lib/api/clients";
import { useActiveComercio } from "@/components/comercio-context";
import { useComercioSchedule, useComercioTimeOff } from "@/lib/api/availability-comercio";
import { useMembershipHolidays } from "@/lib/api/holidays";
import {
  addDays,
  addMonths,
  dayRange,
  holidaysAsTimeOff,
  weekRange,
  monthGridRange,
  weekDays,
} from "@/lib/agenda";
import { formatDateLong, formatDayChip, titleCaseName } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Staff } from "@/lib/api/generated/model/staff";
import type { Appointment } from "@/lib/api/generated/model/appointment";
import { DayList } from "./day-list";
import { WeekGrid } from "./week-grid";
import { MonthGrid } from "./month-grid";
import { DayAppointmentsDialog } from "./day-appointments-dialog";
import { AppointmentDetail } from "./appointment-detail";
import { NewAppointmentDialog } from "./new-appointment-dialog";

type ViewMode = "dia" | "semana" | "mes";

export function AgendaView() {
  const [view, setView] = useState<ViewMode>("dia");
  const [date, setDate] = useState<Date>(() => new Date());
  const [activeStaffId, setActiveStaffId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [creating, setCreating] = useState(false);
  // Al tocar un hueco libre: quién atiende y a qué hora ("HH:mm") se precargan en "Nuevo turno".
  const [preset, setPreset] = useState<{ staffId: string; time: string } | null>(null);
  const [dayList, setDayList] = useState<Date | null>(null);

  const staffQuery = useProfessionalsListStaff();
  const servicesQuery = useServices();
  // Resuelve el personId de cada turno al nombre/contacto real del cliente (no el id).
  const lookupPerson = usePersonLookup();
  const { activeId, active, options: comercios } = useActiveComercio();
  const multiComercio = comercios.length > 1;
  // Horario semanal y bloqueos del comercio activo: para marcar en el calendario los días
  // que el profesional no atiende y por qué (cerrado habitual / feriado / vacaciones).
  const scheduleQuery = useComercioSchedule(activeId ?? undefined);
  const timeOffQuery = useComercioTimeOff(activeId ?? undefined);
  // Normalizamos los nombres a mostrar (el back todavía no normaliza staff/servicios).
  // Son datos solo de lectura en la agenda: no alimentan ningún formulario de edición.
  const staffList = (staffQuery.data ?? [])
    .filter((s: Staff) => s.isActive)
    .map((s: Staff) => ({ ...s, displayName: titleCaseName(s.displayName) }));
  const services = (servicesQuery.data ?? []).map((s) => ({ ...s, name: titleCaseName(s.name) }));
  const scheduleRules = scheduleQuery.data ?? [];
  // Feriados en los que el profesional no trabaja: se suman a los bloqueos manuales como días
  // completos "Feriado" (el nombre del feriado va de motivo). Se trae el año visible con margen
  // (dic anterior – ene siguiente) para que la grilla mensual no quede corta en los bordes.
  const holidaysQuery = useMembershipHolidays(activeId ?? undefined, {
    from: `${date.getFullYear() - 1}-12-01`,
    to: `${date.getFullYear() + 1}-01-31`,
  });
  const manualTimeOff = timeOffQuery.data;
  const holidayData = holidaysQuery.data;
  const timeOff = useMemo(
    () => [...(manualTimeOff ?? []), ...holidaysAsTimeOff(holidayData ?? [])],
    [manualTimeOff, holidayData],
  );

  // En semana mostramos un staff; en día, todos (columnas) o el filtrado.
  const weekStaffId = activeStaffId ?? staffList[0]?.id ?? "";

  const range =
    view === "dia" ? dayRange(date) : view === "semana" ? weekRange(date) : monthGridRange(date);
  const apptQuery = useAppointments({
    ...range,
    staffId: view === "semana" ? weekStaffId : (activeStaffId ?? undefined),
  });
  // Con varios comercios, la agenda muestra el comercio activo (el selector del menú): así los
  // turnos coinciden con los horarios, días cerrados y bloqueos que se marcan, que son de ese comercio.
  const appointments = (apptQuery.data ?? []).filter(
    (a) => !multiComercio || !activeId || a.comercioId === activeId,
  );

  // Rango anterior y siguiente precargados: las flechas responden al instante.
  const staffParam = view === "semana" ? weekStaffId : (activeStaffId ?? undefined);
  const neighbor = (dir: -1 | 1) => {
    const d =
      view === "dia" ? addDays(date, dir) : view === "semana" ? addDays(date, dir * 7) : addMonths(date, dir);
    const r = view === "dia" ? dayRange(d) : view === "semana" ? weekRange(d) : monthGridRange(d);
    return { ...r, staffId: staffParam };
  };
  usePrefetchAppointments([neighbor(-1), neighbor(1)]);

  const title = useMemo(() => {
    if (view === "dia") return formatDateLong(date);
    if (view === "mes") return date.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
    const days = weekDays(date);
    const a = formatDayChip(days[0]);
    const b = formatDayChip(days[6]);
    return `Semana del ${a.day} al ${b.day}`;
  }, [view, date]);

  function move(dir: -1 | 1) {
    setDate((d) =>
      view === "dia" ? addDays(d, dir) : view === "semana" ? addDays(d, dir * 7) : addMonths(d, dir),
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Toolbar */}
      <div className="border-b border-border px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1 sm:flex-none">
            <h1 className="font-display text-2xl font-semibold tracking-tight">Agenda</h1>
            <p className="text-sm capitalize text-muted-foreground">{title}</p>
          </div>
          {/* Mobile: la acción principal va junto al título, siempre a la vista. */}
          <Button size="sm" className="shrink-0 sm:hidden" onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            Nuevo turno
          </Button>
          {/* Mobile: fila propia a todo el ancho (antes desbordaba y escondía "Nuevo turno"). */}
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
            <RefreshButton fetching={apptQuery.isFetching} onClick={() => apptQuery.refetch()} />
            <Button variant="outline" size="sm" onClick={() => setDate(new Date())}>
              Hoy
            </Button>
            <div className="flex items-center rounded-lg border border-border">
              <button
                type="button"
                aria-label="Anterior"
                onClick={() => move(-1)}
                className="grid size-9 place-items-center text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Siguiente"
                onClick={() => move(1)}
                className="grid size-9 place-items-center text-muted-foreground hover:text-foreground"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
            <ViewToggle view={view} onChange={setView} />
            <Button size="sm" className="hidden sm:inline-flex" onClick={() => setCreating(true)}>
              <Plus className="size-4" />
              Nuevo turno
            </Button>
          </div>
        </div>

        {multiComercio && active && (
          <p className="mt-2 text-xs text-muted-foreground">
            Turnos de <span className="font-medium text-foreground">{active.name}</span>. Para ver
            los de otro comercio, cambialo en el menú.
          </p>
        )}

        {/* Selector de staff */}
        {staffList.length > 1 && (
          <div className="mt-3 flex gap-2 overflow-x-auto">
            {view !== "semana" && (
              <StaffChip
                active={activeStaffId === null}
                onClick={() => setActiveStaffId(null)}
                label="Todos"
              />
            )}
            {staffList.map((s: Staff) => (
              <StaffChip
                key={s.id}
                active={
                  view === "semana" ? weekStaffId === s.id : activeStaffId === s.id
                }
                onClick={() => setActiveStaffId(s.id)}
                label={s.displayName}
              />
            ))}
          </div>
        )}
      </div>

      {/* Cuerpo */}
      <div className="flex-1 overflow-auto">
        {apptQuery.isLoading || staffQuery.isLoading ? (
          <div className="space-y-2 p-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : apptQuery.isError ? (
          <div className="p-6">
            <ErrorState
              message="No pudimos cargar la agenda."
              onRetry={() => apptQuery.refetch()}
            />
          </div>
        ) : view === "dia" ? (
          <DayList
            date={date}
            staff={activeStaffId ? staffList.filter((s) => s.id === activeStaffId) : staffList}
            appointments={appointments}
            services={services}
            scheduleRules={scheduleRules}
            timeOff={timeOff}
            lookupPerson={lookupPerson}
            onSelect={setSelected}
            onCreateAt={(staffId, start) => {
              setPreset({
                staffId,
                time: toHHmm(start),
              });
              setCreating(true);
            }}
          />
        ) : view === "semana" ? (
          <WeekGrid
            date={date}
            appointments={appointments}
            services={services}
            scheduleRules={scheduleRules}
            timeOff={timeOff}
            staffName={staffList.find((s) => s.id === weekStaffId)?.displayName ?? ""}
            lookupPerson={lookupPerson}
            onSelect={setSelected}
          />
        ) : (
          <MonthGrid
            date={date}
            appointments={appointments}
            scheduleRules={scheduleRules}
            timeOff={timeOff}
            onPickDay={(d) => {
              setDate(d);
              setView("dia");
            }}
            onOpenDay={(d) => setDayList(d)}
          />
        )}
      </div>

      {/* Panel de detalle */}
      {selected && (
        <AppointmentDetail
          appointment={selected}
          services={services}
          staffName={staffList.find((s) => s.id === selected.staffId)?.displayName ?? ""}
          person={lookupPerson(selected.personId, {
            name: selected.personName,
            phone: selected.personPhone,
            email: selected.personEmail,
          })}
          onClose={() => setSelected(null)}
          onChanged={() => {
            apptQuery.refetch();
            setSelected(null);
          }}
        />
      )}

      {/* Lista de turnos del día (doble click en el mes) */}
      {dayList && (
        <DayAppointmentsDialog
          date={dayList}
          appointments={appointments}
          services={services}
          lookupPerson={lookupPerson}
          onClose={() => setDayList(null)}
          onSelect={(a) => {
            setDayList(null);
            setSelected(a);
          }}
          onCreate={() => {
            setDate(dayList);
            setDayList(null);
            setCreating(true);
          }}
        />
      )}

      {/* Crear turno */}
      {creating && (
        <NewAppointmentDialog
          date={date}
          staff={staffList}
          services={services}
          initialStaffId={preset?.staffId}
          initialTime={preset?.time}
          onClose={() => {
            setCreating(false);
            setPreset(null);
          }}
          onCreated={() => {
            apptQuery.refetch();
            setCreating(false);
            setPreset(null);
          }}
        />
      )}
    </div>
  );
}

/** "09:05" en hora local. */
function toHHmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function ViewToggle({
  view,
  onChange,
}: {
  view: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  const labels: Record<ViewMode, string> = { dia: "Día", semana: "Semana", mes: "Mes" };
  return (
    <div className="flex min-w-[9.5rem] flex-1 items-center rounded-lg border border-border p-0.5 text-sm font-medium sm:flex-none">
      {(["dia", "semana", "mes"] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={view === v}
          className={cn(
            "flex-1 rounded-md px-2 py-1.5 transition-colors sm:flex-none sm:px-3",
            view === v ? "bg-accent/10 text-accent" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {labels[v]}
        </button>
      ))}
    </div>
  );
}

function StaffChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3.5 py-1 text-sm font-medium transition-colors",
        active
          ? "border-accent bg-accent/10 text-accent"
          : "border-border text-muted-foreground hover:border-accent/50",
      )}
    >
      {label}
    </button>
  );
}
