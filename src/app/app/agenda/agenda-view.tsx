"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/state-views";
import { useListStaff } from "@/lib/api/generated/endpoints/professionals/professionals";
import { useAppointments } from "@/lib/api/appointments";
import { useServices } from "@/lib/api/catalog";
import { addDays, dayRange, weekRange, weekDays } from "@/lib/agenda";
import { formatDateLong, formatDayChip } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Staff } from "@/lib/api/generated/model/staff";
import type { Appointment } from "@/lib/api/generated/model/appointment";
import { DayGrid } from "./day-grid";
import { WeekGrid } from "./week-grid";
import { AppointmentDetail } from "./appointment-detail";
import { NewAppointmentDialog } from "./new-appointment-dialog";

type ViewMode = "dia" | "semana";

export function AgendaView() {
  const [view, setView] = useState<ViewMode>("dia");
  const [date, setDate] = useState<Date>(() => new Date());
  const [activeStaffId, setActiveStaffId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [creating, setCreating] = useState(false);

  const staffQuery = useListStaff();
  const servicesQuery = useServices();
  const staffList = (staffQuery.data ?? []).filter((s: Staff) => s.isActive);
  const services = servicesQuery.data ?? [];

  // En semana mostramos un staff; en día, todos (columnas) o el filtrado.
  const weekStaffId = activeStaffId ?? staffList[0]?.id ?? "";

  const range = view === "dia" ? dayRange(date) : weekRange(date);
  const apptQuery = useAppointments({
    ...range,
    staffId: view === "semana" ? weekStaffId : (activeStaffId ?? undefined),
  });
  const appointments = apptQuery.data ?? [];

  const title = useMemo(() => {
    if (view === "dia") return formatDateLong(date);
    const days = weekDays(date);
    const a = formatDayChip(days[0]);
    const b = formatDayChip(days[6]);
    return `Semana del ${a.day} al ${b.day}`;
  }, [view, date]);

  function move(dir: -1 | 1) {
    setDate((d) => addDays(d, view === "dia" ? dir : dir * 7));
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
            {view === "dia" && (
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
          <DayGrid
            date={date}
            staff={activeStaffId ? staffList.filter((s) => s.id === activeStaffId) : staffList}
            appointments={appointments}
            services={services}
            onSelect={setSelected}
          />
        ) : (
          <WeekGrid
            date={date}
            appointments={appointments}
            services={services}
            staffName={staffList.find((s) => s.id === weekStaffId)?.displayName ?? ""}
            onSelect={setSelected}
          />
        )}
      </div>

      {/* Panel de detalle */}
      {selected && (
        <AppointmentDetail
          appointment={selected}
          services={services}
          staffName={staffList.find((s) => s.id === selected.staffId)?.displayName ?? ""}
          onClose={() => setSelected(null)}
          onChanged={() => {
            apptQuery.refetch();
            setSelected(null);
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
  return (
    <div className="flex items-center rounded-lg border border-border p-0.5 text-sm font-medium">
      {(["dia", "semana"] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn(
            "rounded-md px-3 py-1.5 capitalize transition-colors",
            view === v ? "bg-accent/10 text-accent" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {v === "dia" ? "Día" : "Semana"}
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
