import { http, HttpResponse, type RequestHandler } from "msw";
import { env } from "@/lib/env";
import { AppointmentStatus } from "@/lib/api/generated/model/appointmentStatus";
import {
  appointments,
  services,
  staff,
  professional,
  fichaFields,
  buildComercioPublicPage,
  buildProfessionalDetail,
  buildWaitingRoom,
  me,
  clientUser,
  adminUser,
  clients,
  clientNotes,
  scheduleRules,
  timeOffs,
  subscription,
  subscriptionPayments,
  payments,
  adminProfessionals,
  adminMetrics,
  SLUG,
  COMERCIO_ID,
  MEMBERSHIP_ID,
} from "./seed";
import { DepositMode } from "@/lib/api/generated/model/depositMode";
import { ScheduleRuleKind } from "@/lib/api/generated/model/scheduleRuleKind";
import { DayAvailabilityStatus } from "@/lib/api/generated/model/dayAvailabilityStatus";
import type { DayAvailabilityDto } from "@/lib/api/generated/model/dayAvailabilityDto";
import { SubscriptionStatus } from "@/lib/api/generated/model/subscriptionStatus";
import { PaymentStatus } from "@/lib/api/generated/model/paymentStatus";
import type { TimeOff } from "@/lib/api/generated/model/timeOff";
import type { Payment } from "@/lib/api/generated/model/payment";
import type { Slot, MeResponse, AccountRole } from "./contract-extensions";

/** Estado de conexión MercadoPago del profesional (mock en memoria). */
let mpConnected = false;

/**
 * Rutas servidas SIN prefijo de versión (igual que el backend / cliente generado).
 * El resto se sirve bajo `/v1`.
 */
const VERSION_NEUTRAL = [
  /^\/auth(\/|$)/,
  /^\/health(\/|$)/,
  /^\/r(\/|$)/,
  /^\/payments\/mp\/oauth/,
];

/**
 * Construye una URL absoluta contra la baseURL del API para que MSW intercepte, agregando
 * el prefijo `/v1` a las rutas versionadas (el contrato ya lo trae; acá lo replicamos).
 */
const url = (path: string) => {
  const versioned =
    path.startsWith("/") && !VERSION_NEUTRAL.some((re) => re.test(path)) ? `/v1${path}` : path;
  return new URL(versioned, env.apiUrl).toString();
};

/** "HH:MM" → minutos desde medianoche. */
function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** ¿El inicio del slot cae dentro de algún bloqueo (time-off) del staff? */
function isBlockedByTimeOff(staffId: string, start: Date): boolean {
  const t = start.getTime();
  return timeOffs.some(
    (to) =>
      to.staffId === staffId &&
      t >= new Date(to.startAt).getTime() &&
      t < new Date(to.endAt).getTime(),
  );
}

/** Bloqueo (time-off) que cubre el día calendario para ese staff, si lo hay (con su motivo). */
function timeOffForDay(staffId: string, day: Date): TimeOff | undefined {
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const start = dayStart.getTime();
  const end = start + 24 * 60 * 60 * 1000;
  return timeOffs.find((to) => {
    if (to.staffId !== staffId) return false;
    const from = new Date(to.startAt).getTime();
    const until = new Date(to.endAt).getTime();
    return from < end && until > start; // se solapa con el día
  });
}

/**
 * Genera slots disponibles para un rango [from, to], un staff y un servicio.
 * Respeta el horario semanal del staff (franjas `work` menos las pausas `break`) y los
 * bloqueos (`timeOffs`), igual que el backend: días/horas sin atención NO generan slots, así
 * la vista del cliente los muestra bloqueados. Deja algunos huecos ocupados para que se vea real.
 * Alineado al contrato: SlotsParams = { staffId, serviceId, from, to }.
 */
function generateSlots(params: {
  staffId?: string;
  serviceId?: string;
  from?: string;
  to?: string;
}): Slot[] {
  const svc = services.find((s) => s.id === params.serviceId);
  const duration = svc?.durationMinutes ?? 30;
  const fromDate = params.from ? new Date(params.from) : new Date();
  const toDate = params.to ? new Date(params.to) : new Date(fromDate);
  const targets = staff.filter(
    (s) => s.isActive && (!params.staffId || s.id === params.staffId),
  );

  const out: Slot[] = [];
  // Iterar día por día dentro del rango.
  const day = new Date(fromDate);
  day.setHours(0, 0, 0, 0);
  const lastDay = new Date(toDate);
  lastDay.setHours(0, 0, 0, 0);

  while (day <= lastDay) {
    const weekday = day.getDay(); // 0 = domingo
    for (const s of targets) {
      // Franjas de trabajo y pausas del staff para este día de la semana.
      const rules = scheduleRules.filter(
        (r) => r.staffId === s.id && r.dayOfWeek === weekday,
      );
      const works = rules.filter((r) => r.kind === ScheduleRuleKind.work);
      const breaks = rules.filter((r) => r.kind === ScheduleRuleKind.break);
      // Sin franja de trabajo ese día = cerrado: no generamos slots (cliente lo ve bloqueado).
      if (works.length === 0) continue;

      for (let h = 0; h < 24; h++) {
        for (const m of [0, 30]) {
          const slotMin = h * 60 + m;
          const inWork = works.some(
            (w) => slotMin >= timeToMinutes(w.startTime) && slotMin < timeToMinutes(w.endTime),
          );
          if (!inWork) continue;
          const inBreak = breaks.some(
            (b) => slotMin >= timeToMinutes(b.startTime) && slotMin < timeToMinutes(b.endTime),
          );
          if (inBreak) continue;

          const start = new Date(day);
          start.setHours(h, m, 0, 0);
          if (start < fromDate || start > toDate) continue;
          // Bloqueos puntuales (feriados, vacaciones, turno médico…).
          if (isBlockedByTimeOff(s.id, start)) continue;
          // ocupar algunos huecos de forma determinística
          const taken = (slotMin + (s.id === "staff_lucia" ? 0 : 90)) % 150 === 0;
          if (taken) continue;
          const end = new Date(start);
          end.setMinutes(end.getMinutes() + duration);
          out.push({
            startAt: start.toISOString(),
            endAt: end.toISOString(),
            staffId: s.id,
          });
        }
      }
    }
    day.setDate(day.getDate() + 1);
  }
  return out;
}

/**
 * Crea un turno desde el body de reserva, lo persiste en el estado en memoria y lo
 * devuelve. Si no se paga seña y el servicio es required/hybrid, queda provisional.
 */
function createBooking(
  body: Record<string, unknown>,
  opts: { provisional?: boolean } = {},
) {
  const serviceId = String(body.serviceId ?? services[0].id);
  const svc = services.find((s) => s.id === serviceId);
  const startAt = String(body.startAt ?? new Date().toISOString());
  const end = new Date(startAt);
  end.setMinutes(end.getMinutes() + (svc?.durationMinutes ?? 30));
  // Provisional si el servicio pide seña y no se abonó (book sin depósito).
  const provisional =
    opts.provisional ?? (!!svc && (svc.allowDeposit || svc.allowFullPayment));

  const appointment = {
    id: `apt_${Date.now()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    professionalId: professional.id,
    comercioId: COMERCIO_ID,
    membershipId: MEMBERSHIP_ID,
    staffId: String(body.staffId ?? staff[0].id),
    personId: "per_nuevo",
    serviceId,
    startAt,
    endAt: end.toISOString(),
    status: AppointmentStatus.requested,
    isProvisional: provisional,
    createdVia: "client_self" as const,
  };
  appointments.push(appointment);
  return appointment;
}

/**
 * Slots a partir de los query params de una request (sirve a las rutas con/sin membershipId).
 * `staffId` acota la disponibilidad a un staff puntual: en la reserva pública usamos el staff
 * representativo del comercio-de-uno para que su horario y bloqueos se reflejen como cierre de día.
 */
function slotsFromRequest(request: Request, staffId?: string) {
  const u = new URL(request.url);
  return generateSlots({
    staffId,
    serviceId: u.searchParams.get("serviceId") ?? undefined,
    from: u.searchParams.get("from") ?? undefined,
    to: u.searchParams.get("to") ?? undefined,
  });
}

/**
 * Staff que representa al comercio-de-uno en la reserva pública. El detalle público expone un
 * único "profesional" (la membresía), pero internamente hay varios staff con su propio horario;
 * elegimos uno para que sus franjas/bloqueos definan qué días puede reservar el cliente.
 */
const PUBLIC_BOOKING_STAFF_ID = "staff_lucia";

/**
 * Disponibilidad por día (DayAvailabilityDto[]) para el rango de la request, alineada al back:
 * por cada fecha devuelve `status` (closed/time_off/full/available), `bookable` y, en time_off,
 * el `reason` cargado por el profesional. Reusa la misma lógica de slots para decidir `bookable`.
 */
function dayAvailabilityFromRequest(request: Request, staffId: string): DayAvailabilityDto[] {
  const u = new URL(request.url);
  const serviceId = u.searchParams.get("serviceId") ?? undefined;
  const fromStr = u.searchParams.get("from");
  const toStr = u.searchParams.get("to");
  const fromDate = fromStr ? new Date(fromStr) : new Date();
  const toDate = toStr ? new Date(toStr) : new Date(fromDate);

  const out: DayAvailabilityDto[] = [];
  const day = new Date(fromDate);
  day.setHours(0, 0, 0, 0);
  const lastDay = new Date(toDate);
  lastDay.setHours(0, 0, 0, 0);

  while (day <= lastDay) {
    const date = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    const block = timeOffForDay(staffId, day);
    const works = scheduleRules.filter(
      (r) => r.staffId === staffId && r.dayOfWeek === day.getDay() && r.kind === ScheduleRuleKind.work,
    );
    // Slots libres de ESE día (acotamos el rango al día para no recorrer todo el período).
    const dayStart = new Date(day);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);
    const freeSlots = generateSlots({
      staffId,
      serviceId,
      from: dayStart.toISOString(),
      to: dayEnd.toISOString(),
    });

    let status: DayAvailabilityStatus;
    let reason: string | null = null;
    if (block) {
      status = DayAvailabilityStatus.time_off;
      reason = (block.reason as unknown as string) ?? null;
    } else if (works.length === 0) {
      status = DayAvailabilityStatus.closed;
    } else if (freeSlots.length === 0) {
      status = DayAvailabilityStatus.full;
    } else {
      status = DayAvailabilityStatus.available;
    }

    out.push({ date, status, reason, bookable: status === DayAvailabilityStatus.available });
    day.setDate(day.getDate() + 1);
  }
  return out;
}

/** Resultado de book-with-deposit: turno asegurado + pago + initPoint de MercadoPago. */
function bookWithDepositResult(body: Record<string, unknown>) {
  const appointment = createBooking(body, { provisional: false });
  const method = String(body.method ?? "mercadopago");
  const fullPayment = body.paymentOption === "full";
  const svc = services.find((s) => s.id === appointment.serviceId);
  const payment: Payment = {
    id: `pay_${Date.now()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    professionalId: professional.id,
    appointmentId: appointment.id as unknown as Payment["appointmentId"],
    personId: appointment.personId,
    type: fullPayment ? "service" : "deposit",
    amountCents: fullPayment ? (svc?.priceCents ?? 0) : (svc?.depositAmountCents ?? 0),
    method: method === "cash" ? "cash" : "mercadopago",
    status: PaymentStatus.pending,
    mercadopagoRef: null,
    paidAt: null,
  };
  payments.push(payment);
  return {
    appointment,
    payment,
    // Extensión del front: punto de pago directo para el cliente anónimo (ver API-GAPS).
    mpInitPoint:
      method === "mercadopago"
        ? `https://www.mercadopago.com.ar/checkout/dep-mock/${payment.id}`
        : null,
  };
}

/** Cambia el estado de un turno en memoria y lo devuelve (o 404). */
function transition(
  id: string,
  status: AppointmentStatus,
  opts: { actualStart?: boolean; clearProvisional?: boolean } = {},
) {
  const apt = appointments.find((a) => a.id === id);
  if (!apt) return new HttpResponse(null, { status: 404 });
  apt.status = status;
  apt.updatedAt = new Date().toISOString();
  if (opts.actualStart) apt.actualStartAt = new Date().toISOString();
  if (opts.clearProvisional) apt.isProvisional = false;
  return HttpResponse.json(apt);
}

/** Cliente registrado/reclamado en esta sesión (sobreescribe el de semilla). */
let registeredClient: MeResponse | null = null;

/** Genera métricas plausibles para el dashboard y la pantalla de métricas. */
function buildMetrics(range: "week" | "month") {
  const dayLabels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const rng = (seed: number) => {
    // pseudo-aleatorio determinístico
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };
  const attendanceByDay = Array.from({ length: range === "week" ? 7 : 8 }).map((_, i) => {
    const atendidos = 4 + Math.floor(rng(i + 1) * 9);
    return {
      label: range === "week" ? dayLabels[i] : `Sem ${i + 1}`,
      atendidos,
      cancelados: Math.floor(rng(i + 7) * 3),
      noShow: Math.floor(rng(i + 13) * 2),
    };
  });
  const peakHours = ["09", "10", "11", "12", "14", "15", "16", "17", "18"].map((h, i) => ({
    hour: `${h}h`,
    turnos: 1 + Math.floor(rng(i + 21) * 10),
  }));
  const incomeByDay = attendanceByDay.map((d, i) => ({
    label: d.label,
    cents: (d.atendidos * (8000 + Math.floor(rng(i + 31) * 12000))) * 100,
  }));
  const totalAppts = attendanceByDay.reduce((s, d) => s + d.atendidos, 0);
  const incomeCents = incomeByDay.reduce((s, d) => s + d.cents, 0);

  return {
    range,
    attendanceByDay,
    newVsReturning: { nuevos: Math.round(totalAppts * 0.35), recurrentes: Math.round(totalAppts * 0.65) },
    peakHours,
    incomeByDay,
    totals: {
      appointments: totalAppts,
      incomeCents,
      newClients: Math.round(totalAppts * 0.35),
      noShowRate: 0.06,
    },
    atRiskClients: [
      { id: "cli_die", fullName: "Diego Ruiz", lastVisitLabel: "hace 3 meses" },
      { id: "cli_juan", fullName: "Juan López", lastVisitLabel: "nunca volvió" },
    ],
  };
}

/** Turnos del cliente de demo (Sofía + los que reserve), enriquecidos para /mis-turnos. */
function buildMyAppointments() {
  const mine = appointments.filter(
    (a) => a.personId === "per_sofia" || a.personId === "per_nuevo",
  );
  return mine
    .map((a) => {
      const svc = services.find((s) => s.id === a.serviceId);
      const st = staff.find((s) => s.id === a.staffId);
      return {
        id: a.id,
        startAt: a.startAt,
        endAt: a.endAt,
        status: a.status,
        isProvisional: a.isProvisional,
        serviceName: svc?.name ?? "Servicio",
        priceCents: svc?.priceCents ?? 0,
        staffName: st?.displayName ?? "Profesional",
        serviceId: a.serviceId,
        membershipId: a.membershipId,
        professionalId: a.professionalId,
        business: {
          name: professional.businessName,
          slug: professional.slug,
          address: "Belgrano 245, Costa de Araujo, Mendoza",
          cancellationWindowHours: professional.cancellationWindowHours,
          rescheduleWindowHours: professional.rescheduleWindowHours,
        },
      };
    })
    .sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));
}

/** Devuelve tokens cuyo accessToken codifica el rol, para que /auth/me lo resuelva. */
function tokensFor(role: AccountRole) {
  return HttpResponse.json({
    accessToken: `mock.${role}.token`,
    refreshToken: "mock.refresh",
    expiresIn: "3600",
  });
}

/** Resuelve el usuario a partir del bearer token (rol codificado en el token mock). */
function sessionFromRequest(request: Request): MeResponse | null {
  const auth = request.headers.get("Authorization") ?? "";
  if (auth.includes("admin")) return adminUser;
  if (auth.includes("professional")) return me;
  if (auth.includes("client")) return registeredClient ?? clientUser;
  return null;
}

export const handlers: RequestHandler[] = [
  // ---- Auth ----
  http.get(url("/auth/me"), ({ request }) => {
    const session = sessionFromRequest(request);
    if (!session) return new HttpResponse(null, { status: 401 });
    return HttpResponse.json(session);
  }),
  http.post(url("/auth/login"), async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { email?: string };
    const email = body.email ?? "";
    // El email decide el perfil de demo.
    if (email.includes("admin")) return tokensFor("admin");
    const isPro = email.includes("peluqueria") || email.includes("lucia");
    return tokensFor(isPro ? "professional" : "client");
  }),
  http.post(url("/auth/register"), async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { email?: string; fullName?: string };
    registeredClient = { ...clientUser, email: body.email ?? clientUser.email, fullName: body.fullName ?? clientUser.fullName };
    return tokensFor("client");
  }),
  http.post(url("/auth/logout"), () => new HttpResponse(null, { status: 204 })),
  http.post(url("/auth/refresh"), () =>
    HttpResponse.json({ accessToken: "mock.client.token", refreshToken: "mock.refresh" }),
  ),
  // Google: en mocks devolvemos directamente la sesión (sin OAuth real).
  http.get(url("/auth/google"), () => tokensFor("client")),

  // Códigos por email (verificación / reclamo / reseteo): siempre OK en mocks.
  http.post(url("/auth/request-email-code"), () => HttpResponse.json({ ok: true })),
  http.post(url("/auth/verify-email"), () => HttpResponse.json({ ok: true })),
  http.post(url("/auth/request-password-reset"), () => HttpResponse.json({ ok: true })),
  http.post(url("/auth/reset-password"), () => HttpResponse.json({ ok: true })),
  http.post(url("/auth/request-claim-code"), () => HttpResponse.json({ ok: true })),
  // Reclamar cuenta: el código de demo es "123456".
  http.post(url("/auth/claim"), async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { code?: string; email?: string };
    if (body.code !== "123456") {
      return HttpResponse.json({ message: "Código inválido" }, { status: 400 });
    }
    registeredClient = { ...clientUser, email: body.email ?? clientUser.email };
    return tokensFor("client");
  }),

  // ---- Página pública de reserva por comercio (Fase 3) ----
  http.get(url("/r/:slug"), ({ params }) =>
    params.slug === SLUG
      ? HttpResponse.json(buildComercioPublicPage())
      : new HttpResponse(null, { status: 404 }),
  ),
  // Detalle de un profesional del comercio (servicios + ubicación).
  http.get(url("/r/:slug/professionals/:membershipId"), ({ params }) =>
    params.slug === SLUG
      ? HttpResponse.json(buildProfessionalDetail())
      : new HttpResponse(null, { status: 404 }),
  ),
  // Slots del profesional (rutas con :membershipId + las planas deprecated).
  http.get(url("/r/:slug/professionals/:membershipId/slots"), ({ request }) =>
    HttpResponse.json(slotsFromRequest(request, PUBLIC_BOOKING_STAFF_ID)),
  ),
  http.get(url("/r/:slug/slots"), ({ request }) =>
    HttpResponse.json(slotsFromRequest(request, PUBLIC_BOOKING_STAFF_ID)),
  ),
  // Disponibilidad por día (status + motivo) para el selector de fecha del cliente.
  http.get(url("/r/:slug/professionals/:membershipId/day-availability"), ({ request }) =>
    HttpResponse.json(dayAvailabilityFromRequest(request, PUBLIC_BOOKING_STAFF_ID)),
  ),
  http.get(url("/r/:slug/day-availability"), ({ request }) =>
    HttpResponse.json(dayAvailabilityFromRequest(request, PUBLIC_BOOKING_STAFF_ID)),
  ),
  // Reserva sin pago.
  http.post(url("/r/:slug/professionals/:membershipId/book"), async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return HttpResponse.json(createBooking(body), { status: 201 });
  }),
  http.post(url("/r/:slug/book"), async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return HttpResponse.json(createBooking(body), { status: 201 });
  }),
  // Reserva con seña/pago total.
  http.post(url("/r/:slug/professionals/:membershipId/book-with-deposit"), async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return HttpResponse.json(bookWithDepositResult(body));
  }),
  http.post(url("/r/:slug/book-with-deposit"), async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return HttpResponse.json(bookWithDepositResult(body));
  }),

  // ---- Disponibilidad (agenda — héroe 3) ----
  http.get(url("/availability/slots"), ({ request }) => {
    const u = new URL(request.url);
    return HttpResponse.json(
      generateSlots({
        staffId: u.searchParams.get("staffId") ?? undefined,
        serviceId: u.searchParams.get("serviceId") ?? undefined,
        from: u.searchParams.get("from") ?? undefined,
        to: u.searchParams.get("to") ?? undefined,
      }),
    );
  }),

  // ---- Sala de espera (héroe 2) ----
  http.get(url("/appointments/waiting-room/:staffId"), ({ params }) =>
    HttpResponse.json(buildWaitingRoom(String(params.staffId))),
  ),

  // Transiciones de estado del turno (mutan el estado en memoria).
  http.post(url("/appointments/:id/start"), ({ params }) =>
    transition(String(params.id), AppointmentStatus.in_progress, { actualStart: true }),
  ),
  http.post(url("/appointments/:id/complete"), ({ params }) =>
    transition(String(params.id), AppointmentStatus.done),
  ),
  http.post(url("/appointments/:id/no-show"), ({ params }) =>
    transition(String(params.id), AppointmentStatus.no_show),
  ),
  http.post(url("/appointments/:id/confirm"), ({ params }) =>
    transition(String(params.id), AppointmentStatus.confirmed, { clearProvisional: true }),
  ),
  http.post(url("/appointments/:id/cancel"), ({ params }) =>
    transition(String(params.id), AppointmentStatus.cancelled),
  ),

  // ---- Catálogo de servicios ----
  http.get(url("/services"), () => HttpResponse.json(services)),
  http.post(url("/services"), async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const svc = {
      id: `svc_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      professionalId: professional.id,
      membershipId: MEMBERSHIP_ID,
      name: String(body.name ?? "Servicio"),
      durationMinutes: Number(body.durationMinutes ?? 30),
      priceCents: Number(body.priceCents ?? 0),
      allowNoPayment: body.allowNoPayment !== false,
      allowDeposit: !!body.allowDeposit,
      allowFullPayment: !!body.allowFullPayment,
      depositAmountCents: (body.depositAmountCents as number) ?? null,
      isActive: true,
    };
    services.push(svc);
    return HttpResponse.json(svc, { status: 201 });
  }),
  http.get(url("/services/:id"), ({ params }) => {
    const svc = services.find((s) => s.id === params.id);
    return svc ? HttpResponse.json(svc) : new HttpResponse(null, { status: 404 });
  }),
  http.patch(url("/services/:id"), async ({ params, request }) => {
    const svc = services.find((s) => s.id === params.id);
    if (!svc) return new HttpResponse(null, { status: 404 });
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    Object.assign(svc, body, { updatedAt: new Date().toISOString() });
    return HttpResponse.json(svc);
  }),
  http.delete(url("/services/:id"), ({ params }) => {
    const svc = services.find((s) => s.id === params.id);
    if (!svc) return new HttpResponse(null, { status: 404 });
    svc.isActive = false;
    return HttpResponse.json(svc);
  }),

  // ---- Profesional / staff ----
  http.post(url("/professionals/onboard"), async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    Object.assign(professional, {
      businessName: String(body.businessName ?? professional.businessName),
      slug: String(body.slug ?? professional.slug),
      timezone: String(body.timezone ?? professional.timezone),
      updatedAt: new Date().toISOString(),
    });
    return HttpResponse.json(professional, { status: 201 });
  }),
  http.get(url("/professionals/me"), () => HttpResponse.json(professional)),
  http.patch(url("/professionals/me"), async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    Object.assign(professional, body, { updatedAt: new Date().toISOString() });
    return HttpResponse.json(professional);
  }),
  http.get(url("/professionals/staff"), () => HttpResponse.json(staff)),

  // ---- Horarios (availability) ----
  http.get(url("/availability/staff/:staffId/schedule"), ({ params }) =>
    HttpResponse.json(scheduleRules.filter((r) => r.staffId === params.staffId)),
  ),
  http.post(url("/availability/staff/:staffId/schedule"), async ({ params, request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const rule = {
      id: `sr_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      staffId: String(params.staffId),
      membershipId: MEMBERSHIP_ID,
      dayOfWeek: Number(body.dayOfWeek ?? 1),
      startTime: String(body.startTime ?? "09:00"),
      endTime: String(body.endTime ?? "18:00"),
      kind: (body.kind as ScheduleRuleKind) ?? ScheduleRuleKind.work,
      serviceIds: Array.isArray(body.serviceIds) ? (body.serviceIds as string[]) : [],
    };
    scheduleRules.push(rule);
    return HttpResponse.json(rule, { status: 201 });
  }),
  http.delete(url("/availability/staff/:staffId/schedule/:id"), ({ params }) => {
    const i = scheduleRules.findIndex((r) => r.id === params.id);
    if (i >= 0) scheduleRules.splice(i, 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get(url("/availability/staff/:staffId/time-off"), ({ params }) =>
    HttpResponse.json(timeOffs.filter((t) => t.staffId === params.staffId)),
  ),
  http.post(url("/availability/staff/:staffId/time-off"), async ({ params, request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const block = {
      id: `to_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      staffId: String(params.staffId),
      membershipId: MEMBERSHIP_ID,
      startAt: String(body.startAt ?? new Date().toISOString()),
      endAt: String(body.endAt ?? new Date().toISOString()),
      // reason está mal tipado en el contrato (objeto|null); guardamos string libre.
      reason: ((body.reason as string) ?? null) as unknown as TimeOff["reason"],
    };
    timeOffs.push(block);
    return HttpResponse.json(block, { status: 201 });
  }),
  http.delete(url("/availability/staff/:staffId/time-off/:id"), ({ params }) => {
    const i = timeOffs.findIndex((t) => t.id === params.id);
    if (i >= 0) timeOffs.splice(i, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  // ---- Suscripción ----
  http.get(url("/subscription"), () => HttpResponse.json(subscription)),
  http.get(url("/subscription/payments"), () => HttpResponse.json(subscriptionPayments)),
  http.post(url("/subscription/checkout"), () =>
    HttpResponse.json({ initPoint: "https://www.mercadopago.com.ar/checkout/sub-mock" }),
  ),

  // ---- Cobros (señas/turnos) ----
  http.get(url("/payments"), () => HttpResponse.json(payments)),
  http.post(url("/payments/:id/mark-paid"), ({ params }) => {
    const p = payments.find((x) => x.id === params.id);
    if (!p) return new HttpResponse(null, { status: 404 });
    p.status = PaymentStatus.paid;
    p.method = "cash";
    p.paidAt = new Date().toISOString();
    return HttpResponse.json(p);
  }),
  http.post(url("/payments/:id/mp-preference"), ({ params }) => {
    const p = payments.find((x) => x.id === params.id);
    if (!p) return new HttpResponse(null, { status: 404 });
    if (!mpConnected) {
      return HttpResponse.json(
        { message: "El profesional no conecto su cuenta de MercadoPago." },
        { status: 400 },
      );
    }
    return HttpResponse.json({
      preferenceId: `pref_${params.id}`,
      initPoint: `https://www.mercadopago.com.ar/checkout/pay-mock/${params.id}`,
    });
  }),

  // ---- Conexión MercadoPago (OAuth del profesional) ----
  http.get(url("/payments/mp/oauth/connect"), () => {
    // Simulamos que al pedir la URL ya quedó autorizado (al volver, status=connected).
    mpConnected = true;
    const origin =
      typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    return HttpResponse.json({ url: `${origin}/ajustes/pagos?mp=connected` });
  }),
  http.get(url("/payments/mp/oauth/status"), () =>
    HttpResponse.json({
      connected: mpConnected,
      mpUserId: mpConnected ? "MP-123456" : null,
      connectedAt: mpConnected ? new Date().toISOString() : null,
    }),
  ),
  http.delete(url("/payments/mp/oauth"), () => {
    mpConnected = false;
    return HttpResponse.json({ ok: true });
  }),

  // ---- Archivos (subida + URL firmada) ----
  http.post(url("/files"), ({ request }) => {
    const u = new URL(request.url);
    return HttpResponse.json(
      {
        id: `file_${Date.now()}`,
        createdAt: new Date().toISOString(),
        professionalId: professional.id,
        ownerType: u.searchParams.get("ownerType") ?? "generic",
        ownerId: u.searchParams.get("ownerId") ?? "",
        objectKey: `mock/${Date.now()}.webp`,
        mime: "image/webp",
        sizeBytes: "204800",
      },
      { status: 201 },
    );
  }),
  http.get(url("/files/:id/url"), ({ params }) => {
    // SVG data-URL: muestra algo sin depender de red en modo mock.
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><rect width='100%' height='100%' fill='%2316707A'/><text x='50%' y='52%' font-size='14' fill='white' text-anchor='middle' font-family='sans-serif'>archivo</text></svg>`;
    return HttpResponse.json({ url: `data:image/svg+xml;utf8,${svg}`, id: params.id });
  }),
  http.delete(url("/files/:id"), () => new HttpResponse(null, { status: 204 })),

  // ---- Métricas (agregadas — API-GAPS §2, mock) ----
  http.get(url("/metrics/overview"), ({ request }) => {
    const u = new URL(request.url);
    const range = u.searchParams.get("range") === "month" ? "month" : "week";
    return HttpResponse.json(buildMetrics(range));
  }),

  // ---- Admin de plataforma ----
  http.get(url("/admin/professionals"), ({ request }) => {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") ?? "").toLowerCase();
    const status = searchParams.get("status") ?? "all";
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const pageSize = Math.min(100, Number(searchParams.get("pageSize")) || 20);
    const filtered = adminProfessionals.filter((r) => {
      if (status === "active" && r.professional.deletedAt) return false;
      if (status === "deleted" && !r.professional.deletedAt) return false;
      if (!q) return true;
      return (
        r.professional.businessName.toLowerCase().includes(q) ||
        r.professional.slug.toLowerCase().includes(q)
      );
    });
    const start = (page - 1) * pageSize;
    return HttpResponse.json({
      total: filtered.length,
      page,
      pageSize,
      items: filtered.slice(start, start + pageSize),
    });
  }),
  http.post(url("/admin/professionals"), async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const id = `pro_${Date.now()}`;
    const nowIso = new Date().toISOString();
    const trialEnd = new Date(Date.now() + 15 * 86400000).toISOString();
    const row = {
      professional: {
        id,
        createdAt: nowIso,
        updatedAt: nowIso,
        accountId: `acc_${Date.now()}`,
        businessName: String(body.businessName ?? "Nuevo negocio"),
        slug: String(body.slug ?? `negocio-${Date.now()}`),
        timezone: "America/Argentina/Buenos_Aires",
        address: null,
        defaultDepositMode: DepositMode.hybrid,
        cancellationWindowHours: 24,
        rescheduleWindowHours: 24,
        publicPageSettings: {},
      },
      subscription: {
        id: `sub_${id}`,
        createdAt: nowIso,
        updatedAt: nowIso,
        professionalId: id,
        status: SubscriptionStatus.trial,
        trialEndsAt: trialEnd,
        currentPeriodStart: nowIso,
        currentPeriodEnd: trialEnd,
        graceEndsAt: null,
        amountCents: 1500000,
        mercadopagoPreapprovalId: null,
      },
    } as (typeof adminProfessionals)[number];
    adminProfessionals.unshift(row);
    return HttpResponse.json(row, { status: 201 });
  }),
  http.post(url("/admin/accounts/:accountId/block"), () => HttpResponse.json({ ok: true }, { status: 201 })),
  http.post(url("/admin/accounts/:accountId/activate"), () => HttpResponse.json({ ok: true }, { status: 201 })),
  http.post(url("/admin/clients"), async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return HttpResponse.json(
      { id: `cli_${Date.now()}`, fullName: String(body.fullName ?? "Cliente"), status: "active" },
      { status: 201 },
    );
  }),
  http.post(url("/admin/subscriptions/:professionalId/mark-cash-paid"), ({ params }) => {
    const row = adminProfessionals.find((r) => r.professional.id === params.professionalId);
    if (!row) return new HttpResponse(null, { status: 404 });
    const periodEnd = new Date(Date.now() + 30 * 86400000).toISOString();
    row.subscription.status = SubscriptionStatus.active;
    row.subscription.currentPeriodStart = new Date().toISOString();
    row.subscription.currentPeriodEnd = periodEnd;
    row.subscription.graceEndsAt = null;
    row.subscription.trialEndsAt = null;
    return HttpResponse.json(row.subscription, { status: 201 });
  }),
  // Borrado lógico restaurable de profesionales (mutan el deletedAt del seed).
  http.delete(url("/admin/professionals/:id"), ({ params }) => {
    const row = adminProfessionals.find((r) => r.professional.id === params.id);
    if (!row) return new HttpResponse(null, { status: 404 });
    row.professional.deletedAt = new Date().toISOString();
    return new HttpResponse(null, { status: 204 });
  }),
  http.post(url("/admin/professionals/:id/restore"), ({ params }) => {
    const row = adminProfessionals.find((r) => r.professional.id === params.id);
    if (!row) return new HttpResponse(null, { status: 404 });
    row.professional.deletedAt = null;
    return new HttpResponse(null, { status: 204 });
  }),
  // Listados de clientes/comercios globales: sin seed propio todavía → sobre vacío.
  http.get(url("/admin/clients"), ({ request }) => {
    const { searchParams } = new URL(request.url);
    return HttpResponse.json({
      total: 0,
      page: Math.max(1, Number(searchParams.get("page")) || 1),
      pageSize: Math.min(100, Number(searchParams.get("pageSize")) || 20),
      items: [],
    });
  }),
  http.delete(url("/admin/clients/:id"), () => new HttpResponse(null, { status: 204 })),
  http.post(url("/admin/clients/:id/restore"), () => new HttpResponse(null, { status: 204 })),
  http.get(url("/admin/comercios"), ({ request }) => {
    const { searchParams } = new URL(request.url);
    return HttpResponse.json({
      total: 0,
      page: Math.max(1, Number(searchParams.get("page")) || 1),
      pageSize: Math.min(100, Number(searchParams.get("pageSize")) || 20),
      items: [],
    });
  }),
  http.delete(url("/admin/comercios/:id"), () => new HttpResponse(null, { status: 204 })),
  http.post(url("/admin/comercios/:id/restore"), () => new HttpResponse(null, { status: 204 })),
  // Métricas de plataforma: el contrato no las expone (API-GAPS §2e), mock.
  http.get(url("/admin/metrics"), () => HttpResponse.json(adminMetrics)),

  // ---- Turnos ----
  http.get(url("/appointments"), ({ request }) => {
    const u = new URL(request.url);
    const staffId = u.searchParams.get("staffId");
    // from/to son una extensión del front (ver API-GAPS §2b).
    const from = u.searchParams.get("from");
    const to = u.searchParams.get("to");
    let list = appointments.slice();
    if (staffId) list = list.filter((a) => a.staffId === staffId);
    if (from) list = list.filter((a) => a.startAt >= from);
    if (to) list = list.filter((a) => a.startAt <= to);
    return HttpResponse.json(list);
  }),
  http.post(url("/appointments"), async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return HttpResponse.json(createBooking(body, { provisional: false }), { status: 201 });
  }),
  http.get(url("/appointments/:id"), ({ params }) => {
    const apt = appointments.find((a) => a.id === params.id);
    return apt ? HttpResponse.json(apt) : new HttpResponse(null, { status: 404 });
  }),

  // ---- Turnos del cliente (vista /mis-turnos, API-GAPS §2d) ----
  http.get(url("/me/appointments"), () => HttpResponse.json(buildMyAppointments())),
  http.post(url("/me/appointments/:id/cancel"), ({ params }) =>
    transition(String(params.id), AppointmentStatus.cancelled),
  ),
  http.post(url("/me/appointments/:id/reschedule"), async ({ params, request }) => {
    const apt = appointments.find((a) => a.id === String(params.id));
    if (!apt) return new HttpResponse(null, { status: 404 });
    const body = (await request.json().catch(() => ({}))) as { startAt?: string };
    if (!body.startAt) return new HttpResponse(null, { status: 400 });

    // Ventana de reprogramación: now > startAt - rescheduleWindowHours → 409.
    const deadline = +new Date(apt.startAt) - professional.rescheduleWindowHours * 3_600_000;
    if (Date.now() > deadline) {
      return HttpResponse.json(
        { statusCode: 409, message: "Fuera de la ventana de reprogramación." },
        { status: 409 },
      );
    }

    const durationMs = +new Date(apt.endAt) - +new Date(apt.startAt);
    apt.startAt = body.startAt;
    apt.endAt = new Date(+new Date(body.startAt) + durationMs).toISOString();
    apt.updatedAt = new Date().toISOString();
    return HttpResponse.json(apt);
  }),

  // ---- Ficha dinámica (campos) — antes que /clients/:id ----
  http.get(url("/clients/ficha-fields"), () => HttpResponse.json(fichaFields)),

  // ---- Clientes ----
  http.get(url("/clients"), ({ request }) => {
    const u = new URL(request.url);
    const q = (u.searchParams.get("q") ?? "").toLowerCase();
    let list = clients.slice();
    if (q) {
      list = list.filter(
        (c) =>
          (c.fullName ?? "").toLowerCase().includes(q) ||
          (c.email ?? "").toLowerCase().includes(q) ||
          (c.phone ?? "").includes(q),
      );
    }
    return HttpResponse.json(list);
  }),
  http.post(url("/clients"), async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const newClient = {
      id: `cli_${Date.now()}`,
      personId: `per_${Date.now()}`,
      fullName: String(body.fullName ?? "Cliente"),
      email: (body.email as string) || undefined,
      phone: (body.phone as string) || undefined,
      status: "active" as const,
      fichaValues: (body.fichaValues as Record<string, unknown>) ?? {},
      createdAt: new Date().toISOString(),
      visitCount: 0,
      lastVisitAt: null,
    };
    clients.unshift(newClient);
    return HttpResponse.json(newClient, { status: 201 });
  }),
  // Notas privadas (antes que /clients/:id)
  http.get(url("/clients/:id/notes"), ({ params }) =>
    HttpResponse.json(clientNotes[String(params.id)] ?? []),
  ),
  http.post(url("/clients/:id/notes"), async ({ params, request }) => {
    const id = String(params.id);
    const body = (await request.json().catch(() => ({}))) as { body?: string };
    const note = {
      id: `note_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      professionalClientId: id,
      authorStaffId: null,
      body: String(body.body ?? ""),
    };
    clientNotes[id] = [note, ...(clientNotes[id] ?? [])];
    return HttpResponse.json(note, { status: 201 });
  }),
  // Actualizar ficha del cliente
  http.patch(url("/clients/:id/ficha"), async ({ params, request }) => {
    const c = clients.find((x) => x.id === params.id);
    if (!c) return new HttpResponse(null, { status: 404 });
    const body = (await request.json().catch(() => ({}))) as { fichaValues?: Record<string, unknown> };
    c.fichaValues = { ...c.fichaValues, ...(body.fichaValues ?? {}) };
    return HttpResponse.json(c);
  }),
  // Detalle y archivar
  http.get(url("/clients/:id"), ({ params }) => {
    const c = clients.find((x) => x.id === params.id);
    return c ? HttpResponse.json(c) : new HttpResponse(null, { status: 404 });
  }),
  http.delete(url("/clients/:id"), ({ params }) => {
    const c = clients.find((x) => x.id === params.id);
    if (!c) return new HttpResponse(null, { status: 404 });
    c.status = "archived";
    return HttpResponse.json(c);
  }),
];
