"use client";

import { useMemo, useState } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Mail, MessageCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { customInstance } from "@/lib/api/axios-instance";
import { useProfessionalsListStaff } from "@/lib/api/generated/endpoints/professionals/professionals";
import {
  getWaitlistListQueryKey,
  useWaitlistList,
  waitlistNotify,
} from "@/lib/api/generated/endpoints/waitlist/waitlist";
import { useServices } from "@/lib/api/catalog";
import { useProfessional } from "@/lib/api/professional";
import { PUBLIC_HOST } from "@/components/public-page-link";
import { formatTime, titleCaseName } from "@/lib/format";
import type { Slot } from "@/mocks/contract-extensions";
import type { Staff } from "@/lib/api/generated/model/staff";

/** Máximo de profesionales del equipo que se consultan (cada uno es un pedido). */
const MAX_STAFF = 4;

type Range = { from: string; to: string };
type DayGaps = { key: "hoy" | "mañana"; label: string; byStaff: { name: string; ranges: Range[] }[] };

/**
 * Une horarios libres consecutivos en tramos: 10:00, 10:30, 11:00 (de 30 min) → "10:00 a 11:30".
 * Dos horarios son consecutivos si el segundo empieza antes de que termine el primero.
 */
export function toRanges(starts: string[], durationMinutes: number): Range[] {
  const ms = durationMinutes * 60_000;
  const sorted = [...starts].sort((a, b) => +new Date(a) - +new Date(b));
  const ranges: { from: number; to: number }[] = [];
  for (const s of sorted) {
    const t = +new Date(s);
    const last = ranges[ranges.length - 1];
    if (last && t <= last.to) last.to = Math.max(last.to, t + ms);
    else ranges.push({ from: t, to: t + ms });
  }
  return ranges.map((r) => ({
    from: formatTime(new Date(r.from).toISOString()),
    to: formatTime(new Date(r.to).toISOString()),
  }));
}

function rangesText(ranges: Range[]): string {
  return ranges.map((r) => `${r.from} a ${r.to}`).join(", ");
}

/**
 * Huecos libres de hoy y mañana en el Inicio: los horarios que todavía se pueden reservar
 * (para el servicio más corto, que es el que más huecos encuentra), agrupados en tramos.
 * Con un toque: compartirlos por WhatsApp (a un contacto o a un grupo), copiarlos para un
 * estado o una historia, o avisarle a la lista de espera de ese día.
 */
export function FreeGapsCard() {
  const qc = useQueryClient();
  const pro = useProfessional();
  const staffQuery = useProfessionalsListStaff();
  const servicesQuery = useServices();
  const waitlist = useWaitlistList();

  const staff = (staffQuery.data ?? []).filter((s: Staff) => s.isActive).slice(0, MAX_STAFF);
  const service = [...(servicesQuery.data ?? [])]
    .filter((s) => s.isActive)
    .sort((a, b) => a.durationMinutes - b.durationMinutes)[0];

  const range = useMemo(() => {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    to.setHours(23, 59, 59, 999);
    return { from: from.toISOString(), to: to.toISOString() };
  }, []);

  const slotQueries = useQueries({
    queries: staff.map((s) => ({
      queryKey: ["free-gaps", s.id, service?.id, range.from],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        customInstance<Slot[]>({
          url: "/v1/availability/slots",
          method: "GET",
          params: { staffId: s.id, serviceId: service!.id, from: range.from, to: range.to },
          signal,
        }),
      enabled: !!service,
      staleTime: 60_000,
    })),
  });

  const days: DayGaps[] = useMemo(() => {
    if (!service) return [];
    const now = Date.now();
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const result: DayGaps[] = [];
    for (const [key, day] of [
      ["hoy", today],
      ["mañana", tomorrow],
    ] as const) {
      const byStaff = staff
        .map((s, i) => {
          const starts = (slotQueries[i]?.data ?? [])
            .map((slot) => slot.startAt)
            .filter((iso) => +new Date(iso) > now && new Date(iso).toDateString() === day.toDateString());
          return { name: titleCaseName(s.displayName), ranges: toRanges(starts, service.durationMinutes) };
        })
        .filter((g) => g.ranges.length > 0);
      if (byStaff.length > 0) result.push({ key, label: key === "hoy" ? "Hoy" : "Mañana", byStaff });
    }
    return result;
    // slotQueries cambia de identidad en cada render: se depende de sus datos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, staff.map((s) => s.id).join(), ...slotQueries.map((q) => q.dataUpdatedAt)]);

  // Lista de espera de hoy y mañana (con email: a esos se les puede avisar).
  const waiting = useMemo(() => {
    const ends = new Date();
    ends.setDate(ends.getDate() + 1);
    ends.setHours(23, 59, 59, 999);
    return (waitlist.data ?? []).filter(
      (w) => w.status === "waiting" && !!w.email && +new Date(w.desiredFrom) <= +ends,
    );
  }, [waitlist.data]);

  const [copied, setCopied] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [notified, setNotified] = useState<number | null>(null);

  if (!service || staff.length === 0 || days.length === 0) return null;

  const multiStaff = staff.length > 1;
  const bookUrl = pro.data?.slug ? `https://${PUBLIC_HOST}/r/${pro.data.slug}` : null;
  const shareText = [
    `¡Me quedaron turnos libres${pro.data?.businessName ? ` en ${pro.data.businessName}` : ""}!`,
    ...days.map(
      (d) =>
        `${d.label}: ` +
        d.byStaff
          .map((g) => (multiStaff ? `${g.name} ${rangesText(g.ranges)}` : rangesText(g.ranges)))
          .join(" · "),
    ),
    bookUrl ? `Reservá acá: ${bookUrl}` : "Escribime y te lo reservo.",
  ].join("\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin permiso de portapapeles: queda el botón de WhatsApp.
    }
  }

  async function notifyWaitlist() {
    setNotifying(true);
    let ok = 0;
    for (const w of waiting) {
      try {
        await waitlistNotify(w.id);
        ok += 1;
      } catch {
        // Si a uno no se le pudo avisar, se sigue con el resto.
      }
    }
    setNotifying(false);
    setNotified(ok);
    void qc.invalidateQueries({ queryKey: getWaitlistListQueryKey() });
  }

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-4">
      <h2 className="inline-flex items-center gap-2 font-display text-sm font-semibold">
        <Sparkles className="size-4 text-accent" />
        Huecos libres para llenar
      </h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Horarios que todavía se pueden reservar ({service.durationMinutes} min o más). Compartilos
        y llenalos.
      </p>
      <ul className="mt-3 space-y-1.5 text-sm">
        {days.map((d) => (
          <li key={d.key}>
            <span className="font-medium">{d.label}:</span>{" "}
            {d.byStaff.map((g, i) => (
              <span key={g.name}>
                {i > 0 && " · "}
                {multiStaff && <span className="text-muted-foreground">{g.name} </span>}
                <span className="tabular-nums">{rangesText(g.ranges)}</span>
              </span>
            ))}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" asChild>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle className="size-4" />
            Compartir por WhatsApp
          </a>
        </Button>
        <Button size="sm" variant="outline" onClick={copy}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Copiado" : "Copiar para un estado"}
        </Button>
        {waiting.length > 0 && notified === null && (
          <Button size="sm" variant="outline" onClick={notifyWaitlist} disabled={notifying}>
            {notifying ? <Spinner /> : <Mail className="size-4" />}
            Avisar a la lista de espera ({waiting.length})
          </Button>
        )}
      </div>
      {notified !== null && (
        <p className="mt-2 text-xs text-success">
          {notified === 0
            ? "No pudimos avisarle a nadie. Probá de nuevo desde Lista de espera."
            : `Listo: le mandamos un email a ${notified} ${notified === 1 ? "persona" : "personas"} de la lista de espera con el link para reservar.`}
        </p>
      )}
    </section>
  );
}
