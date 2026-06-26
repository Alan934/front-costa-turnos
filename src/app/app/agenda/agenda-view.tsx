"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/state-views";
import { RefreshButton } from "@/components/refresh-button";
import { useProfessionalsListStaff } from "@/lib/api/generated/endpoints/professionals/professionals";
import { useAppointments } from "@/lib/api/appointments";
import { useServices } from "@/lib/api/catalog";
import { usePersonLookup } from "@/lib/api/clients";
import { useActiveComercio } from "@/components/comercio-context";
import { useComercioSchedule, useComercioTimeOff } from "@/lib/api/availability-comercio";
import { addDays, addMonths, dayRange, weekRange, monthGridRange, weekDays } from "@/lib/agenda";
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
  const [dayList, setDayList] = useState<Date | null>(null);

  const staffQuery = useProfessionalsListStaff();
  const servicesQuery = useServices();
  // Resuelve el personId de cada turno al nombre/contacto real del cliente (no el id).
  const lookupPerson = usePersonLookup();
  const { activeId } = useActiveComercio();
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
  const timeOff = timeOffQuery.data ?? [];

  // En semana mostramos un staff; en día, todos (columnas) o el filtrado.
  const weekStaffId = activeStaffId ?? staffList[0]?.id ?? "";

  const range =
    view === "dia" ? dayRange(date) : view === "semana" ? weekRange(date) : monthGridRange(date);
  const apptQuery = useAppointments({
    ...range,
    staffId: view === "semana" ? weekStaffId : (activeStaffId ?? undefined),
  });
  const appointments = apptQuery.data ?? [];

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
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Agenda</h1>
            <p className="text-sm capitalize text-muted-foreground">{title}</p>
          </div>
          <div className="flex items-center gap-2">
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
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="size-4" />
              <span className="hidden sm:inline">Nuevo turno</span>
            </Button>
          </div>
        </div>

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
          onClose={() => setCreating(false)}
          onCreated={() => {
            apptQuery.refetch();
            setCreating(false);
          }}
        />
      )}
    </div>
  );
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
    <div className="flex items-center rounded-lg border border-border p-0.5 text-sm font-medium">
      {(["dia", "semana", "mes"] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn(
            "rounded-md px-3 py-1.5 transition-colors",
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
