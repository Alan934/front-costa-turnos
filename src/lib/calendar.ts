/** Evento a agendar (un turno): fechas en ISO. */
export interface CalendarEvent {
  title: string;
  startAt: string;
  endAt: string;
  location?: string | null;
  description?: string | null;
}

/** "20261117T133000Z": formato UTC compacto que usan Google Calendar y los .ics. */
function stamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]|\.\d{3}/g, "");
}

/** Link que abre Google Calendar con el evento ya cargado. */
export function googleCalendarUrl(ev: CalendarEvent): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.title,
    dates: `${stamp(ev.startAt)}/${stamp(ev.endAt)}`,
  });
  if (ev.location) params.set("location", ev.location);
  if (ev.description) params.set("details", ev.description);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Escapa texto para un campo de iCalendar (RFC 5545). */
function icsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
}

/** Contenido de un archivo .ics (lo abren el calendario del iPhone, Outlook, etc.). */
export function buildIcs(ev: CalendarEvent): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Costa Turnos//Turno//ES",
    "BEGIN:VEVENT",
    `UID:${stamp(ev.startAt)}-${Math.random().toString(36).slice(2)}@costaturnos`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(ev.startAt)}`,
    `DTEND:${stamp(ev.endAt)}`,
    `SUMMARY:${icsText(ev.title)}`,
    ev.location ? `LOCATION:${icsText(ev.location)}` : null,
    ev.description ? `DESCRIPTION:${icsText(ev.description)}` : null,
    // Aviso del propio calendario 2 horas antes.
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsText(ev.title)}`,
    "TRIGGER:-PT2H",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.filter(Boolean).join("\r\n");
}

/** Descarga el evento como .ics. */
export function downloadIcs(ev: CalendarEvent, filename = "turno.ics") {
  const blob = new Blob([buildIcs(ev)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Link a Google Maps buscando una dirección. */
export function mapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}
