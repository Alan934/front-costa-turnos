import { http, HttpResponse, type RequestHandler } from "msw";
import { env } from "@/lib/env";
import { AppointmentStatus } from "@/lib/api/generated/model/appointmentStatus";
import {
  appointments,
  services,
  staff,
  professional,
  fichaFields,
  buildPublicPage,
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
} from "./seed";
import { DepositMode } from "@/lib/api/generated/model/depositMode";
import { ScheduleRuleKind } from "@/lib/api/generated/model/scheduleRuleKind";
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

/**
 * Genera slots disponibles para un rango [from, to], un staff y un servicio.
 * Respeta la duración del servicio y deja algunos huecos ocupados para que se vea real.
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
    if (weekday !== 0) {
      // cerrado los domingos
      for (const s of targets) {
        for (let h = 9; h < 18; h++) {
          for (const m of [0, 30]) {
            const start = new Date(day);
            start.setHours(h, m, 0, 0);
            if (start < fromDate || start > toDate) continue;
            // ocupar algunos huecos de forma determinística
            const taken = (h * 60 + m + (s.id === "staff_lucia" ? 0 : 90)) % 150 === 0;
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
    opts.provisional ?? (svc?.depositMode === "required" || svc?.depositMode === "hybrid");

  const appointment = {
    id: `apt_${Date.now()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    professionalId: professional.id,
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
        business: {
          name: professional.businessName,
          slug: professional.slug,
          address: "Belgrano 245, Costa de Araujo, Mendoza",
          cancellationWindowHours: professional.cancellationWindowHours,
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

  // ---- Página pública de reserva (héroe 1) ----
  http.get(url(`/r/${SLUG}`), () => HttpResponse.json(buildPublicPage())),
  http.get(url("/r/:slug"), ({ params }) =>
    params.slug === SLUG
      ? HttpResponse.json(buildPublicPage())
      : new HttpResponse(null, { status: 404 }),
  ),
  http.get(url("/r/:slug/slots"), ({ request }) => {
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
  http.post(url("/r/:slug/book"), async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return HttpResponse.json(createBooking(body), { status: 201 });
  }),
  http.post(url("/r/:slug/book-with-deposit"), async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const appointment = createBooking(body, { provisional: false });
    const method = String(body.method ?? "mercadopago");
    const svc = services.find((s) => s.id === appointment.serviceId);
    const payment: Payment = {
      id: `pay_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      professionalId: professional.id,
      appointmentId: appointment.id as unknown as Payment["appointmentId"],
      personId: appointment.personId,
      type: "deposit",
      amountCents: svc?.depositAmountCents ?? 0,
      method: method === "cash" ? "cash" : "mercadopago",
      status: PaymentStatus.pending,
      mercadopagoRef: null,
      paidAt: null,
    };
    payments.push(payment);
    return HttpResponse.json({
      appointment,
      payment,
      // Extensión del front: punto de pago directo para el cliente anónimo (ver API-GAPS).
      mpInitPoint:
        method === "mercadopago"
          ? `https://www.mercadopago.com.ar/checkout/dep-mock/${payment.id}`
          : null,
    });
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
      name: String(body.name ?? "Servicio"),
      durationMinutes: Number(body.durationMinutes ?? 30),
      priceCents: Number(body.priceCents ?? 0),
      depositMode: (body.depositMode as DepositMode) ?? DepositMode.none,
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
      dayOfWeek: Number(body.dayOfWeek ?? 1),
      startTime: String(body.startTime ?? "09:00"),
      endTime: String(body.endTime ?? "18:00"),
      kind: (body.kind as ScheduleRuleKind) ?? ScheduleRuleKind.work,
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
  http.get(url("/admin/professionals"), () => HttpResponse.json(adminProfessionals)),
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
          c.fullName.toLowerCase().includes(q) ||
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
