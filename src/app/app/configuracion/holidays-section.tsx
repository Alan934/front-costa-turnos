"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, ChevronUp, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useActiveComercio } from "@/components/comercio-context";
import { useMyMemberships, useUpdateMyMembership } from "@/lib/api/comercios";
import { useQueryClient } from "@tanstack/react-query";
import {
  HOLIDAYS_QUERY_KEY,
  useMembershipHolidays,
  useSetHolidayWorks,
} from "@/lib/api/holidays";
import type { MembershipHoliday } from "@/lib/api/holidays";
import { titleCaseName } from "@/lib/format";

/** YYYY-MM-DD en hora local del navegador. */
function isoDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function formatHolidayDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "long",
  });
}

/** Cuántos feriados próximos se muestran antes de "Ver más". */
const PREVIEW_COUNT = 3;

const KIND_LABEL: Record<string, string> = {
  puente: "Puente",
  nolaborable: "No laborable",
  trasladable: "Trasladable",
};

/**
 * Feriados nacionales del comercio activo.
 *
 * - **Ajuste general** (`membership.worksHolidays`): si trabajás los feriados o no. Se guarda con
 *   el botón. Si NO los trabajás, cada feriado bloquea la agenda (y los clientes no pueden reservar).
 * - **Excepciones**: aunque marques que no trabajás los feriados, podés elegir los feriados
 *   puntuales en los que sí atendés (y al revés). Cada cambio se guarda al instante.
 *
 * El listado se muestra sobre el ajuste general ya guardado; por eso queda deshabilitado mientras
 * haya un cambio del ajuste general sin guardar.
 */
export function HolidaysSection() {
  const { active, activeId } = useActiveComercio();
  const memberships = useMyMemberships();
  const membership = (memberships.data ?? []).find((m) => m.comercioId === active?.comercioId);

  if (memberships.isLoading) return <Skeleton className="h-40 w-full rounded-2xl" />;
  if (!membership || !activeId) return null;

  return (
    <HolidaysForm
      key={membership.id}
      comercioId={activeId}
      comercioName={membership.comercio?.name ? titleCaseName(membership.comercio.name) : null}
      savedWorksHolidays={membership.worksHolidays ?? true}
    />
  );
}

function HolidaysForm({
  comercioId,
  comercioName,
  savedWorksHolidays,
}: {
  comercioId: string;
  comercioName: string | null;
  savedWorksHolidays: boolean;
}) {
  const [works, setWorks] = useState(savedWorksHolidays);
  const [saved, setSaved] = useState(false);
  // Si el valor guardado cambia desde afuera (refetch), el formulario se realinea.
  useEffect(() => setWorks(savedWorksHolidays), [savedWorksHolidays]);

  const qc = useQueryClient();
  const update = useUpdateMyMembership(comercioId);
  const dirty = works !== savedWorksHolidays;

  const today = new Date();
  const oneYearAhead = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
  const holidays = useMembershipHolidays(comercioId, {
    from: isoDate(today),
    to: isoDate(oneYearAhead),
  });
  const setHolidayWorks = useSetHolidayWorks(comercioId, savedWorksHolidays);
  const [showAll, setShowAll] = useState(false);

  // Solo feriados de hoy en adelante (el back ya filtra por rango; esto es por las dudas).
  const todayIso = isoDate(today);
  const upcoming = (holidays.data ?? []).filter((h) => h.date >= todayIso);
  const visible = showAll ? upcoming : upcoming.slice(0, PREVIEW_COUNT);
  const hiddenCount = upcoming.length - PREVIEW_COUNT;

  function save() {
    update.mutate(
      { worksHolidays: works },
      {
        onSuccess: () => {
          // Cambia la decisión efectiva de cada feriado (y lo que marca la agenda).
          qc.invalidateQueries({ queryKey: [HOLIDAYS_QUERY_KEY, comercioId] });
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        },
      },
    );
  }

  return (
    <section>
      <h2 className="mb-3 font-display text-sm font-semibold text-muted-foreground">Feriados</h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Los feriados nacionales se cargan solos.
        {comercioName ? ` Esta configuración vale para ${comercioName}.` : ""} Si no los trabajás,
        cada feriado bloquea tu agenda y tus clientes no pueden reservar ese día.
      </p>

      <div className="space-y-4">
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={works}
            onChange={(e) => setWorks(e.target.checked)}
            className="mt-0.5 size-4 accent-[var(--color-accent)]"
          />
          <span className="text-sm">
            Trabajo los feriados
            <span className="block text-xs text-muted-foreground">
              {works
                ? "Tu agenda queda abierta en los feriados. Podés marcar abajo los feriados puntuales en los que no vas a atender."
                : "Aunque no trabajes los feriados, podés marcar abajo los feriados puntuales en los que sí vas a atender."}
            </span>
          </span>
        </label>

        <Button size="sm" onClick={save} disabled={update.isPending || !dirty}>
          {update.isPending ? (
            <Spinner />
          ) : saved ? (
            <Check className="size-4" />
          ) : (
            <Save className="size-4" />
          )}
          {saved ? "Guardado" : "Guardar"}
        </Button>

        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Próximos feriados</p>
          {dirty && (
            <p className="mb-2 text-xs text-muted-foreground">
              Guardá el cambio para poder editar feriados puntuales.
            </p>
          )}
          {holidays.isLoading && <Skeleton className="h-24 w-full rounded-xl" />}
          {holidays.isError && (
            <p className="text-xs text-destructive">No pudimos cargar los feriados.</p>
          )}
          {holidays.data && upcoming.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Todavía no hay feriados cargados. Se actualizan automáticamente cada mes.
            </p>
          )}
          {upcoming.length > 0 && (
            <ul className="divide-y divide-border rounded-xl border border-border bg-card">
              {visible.map((h) => (
                <HolidayRow
                  key={h.date}
                  holiday={h}
                  disabled={dirty || setHolidayWorks.isPending}
                  onChange={(w) => setHolidayWorks.mutate({ date: h.date, works: w })}
                />
              ))}
            </ul>
          )}
          {hiddenCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => setShowAll((v) => !v)}
            >
              {showAll ? (
                <>
                  <ChevronUp className="size-4" />
                  Ver menos
                </>
              ) : (
                <>
                  <ChevronDown className="size-4" />
                  Ver más ({hiddenCount})
                </>
              )}
            </Button>
          )}
          {setHolidayWorks.isError && (
            <p className="mt-2 text-xs text-destructive">
              No pudimos guardar el cambio. Probá de nuevo.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function HolidayRow({
  holiday,
  disabled,
  onChange,
}: {
  holiday: MembershipHoliday;
  disabled: boolean;
  onChange: (works: boolean) => void;
}) {
  const kind = KIND_LABEL[holiday.kind];
  return (
    <li className="flex items-center gap-3 px-3.5 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{holiday.name}</p>
        <p className="text-xs capitalize text-muted-foreground">{formatHolidayDate(holiday.date)}</p>
      </div>
      {kind && <Badge variant="muted">{kind}</Badge>}
      {holiday.overridden && <Badge variant="accent">Excepción</Badge>}
      <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={holiday.works}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="size-4 accent-[var(--color-accent)]"
        />
        Atiendo
      </label>
    </li>
  );
}
