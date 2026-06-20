/**
 * Tipos PROVISIONALES para respuestas que el contrato (openapi.json) deja sin `schema`
 * (devuelven `void`). Ver API-GAPS.md §1. Cuando el backend tipe estos endpoints y
 * regeneremos el cliente, estos tipos deben desaparecer y reemplazarse por los del modelo.
 *
 * Se mantienen alineados a los nombres de campo que ya usa el contrato para los recursos
 * tipados (Service, Staff, ProfessionalPublicPageSettings, AppointmentStatus, etc.).
 */
import type { Service } from "@/lib/api/generated/model/service";
import type { ServiceCombinationRule } from "@/lib/api/generated/model/serviceCombinationRule";

/**
 * `ServiceCombinationRule` con los servicios embebidos. El endpoint público
 * (`/r/:slug/.../services/:id/combination-rules`) devuelve `targetService` cargado;
 * el endpoint del profesional (GET all) no. Se usa el tipo extendido solo donde corresponde.
 */
export interface ServiceCombinationRuleWithService extends ServiceCombinationRule {
  sourceService?: Service;
  targetService?: Service;
}
import type { DepositMode } from "@/lib/api/generated/model/depositMode";
import type { AppointmentStatus } from "@/lib/api/generated/model/appointmentStatus";
import type { Appointment } from "@/lib/api/generated/model/appointment";
import type { Payment } from "@/lib/api/generated/model/payment";
import type { Professional } from "@/lib/api/generated/model/professional";
import type { Subscription } from "@/lib/api/generated/model/subscription";

/** Marca de branding/configuración de la página pública (hoy `{ [k]: unknown }`). */
export interface PublicPageBranding {
  /** Acento de marca en hex, para el branding del profesional. */
  accentColor?: string;
  /** URL del logo/foto de portada. */
  coverImageUrl?: string;
  /** Id del archivo de logo subido a `/files`. */
  logoFileId?: string;
  /** Bio / descripción corta. */
  bio?: string;
  /** Dirección legible del local. */
  address?: string;
  /** Teléfono de contacto (WhatsApp). */
  phone?: string;
}

/** Staff tal como se expone públicamente (sin datos sensibles). */
export interface StaffPublic {
  id: string;
  displayName: string;
}

/** Respuesta esperada de `GET /r/{slug}` (API-GAPS §1). */
export interface PublicPage {
  professional: {
    id: string;
    businessName: string;
    slug: string;
    timezone: string;
    defaultDepositMode: DepositMode;
    cancellationWindowHours: number;
    branding: PublicPageBranding;
  };
  services: Service[];
  staff: StaffPublic[];
}

/** Un hueco disponible. Respuesta de `GET /r/{slug}/slots` y `GET /availability/slots`. */
export interface Slot {
  startAt: string;
  endAt: string;
  staffId: string;
}

/** Una persona en la sala de espera. Nunca exponer nombre completo en pantalla pública. */
export interface WaitingItem {
  appointmentId: string;
  /** Nombre de pila o número de turno para la pantalla pública. */
  displayName: string;
  /** Número de turno del día (para mostrar grande en la tablet del local). */
  ticketNumber: number;
  position: number;
  etaMinutes: number;
  status: AppointmentStatus;
  serviceName: string;
  startAt: string;
  /**
   * Turno sin seña que quedó provisional (solo cuando la membresía tiene
   * `allowProvisionalBookings`). NO se infiere del estado: el back lo computa.
   */
  isProvisional?: boolean;
}

/** Respuesta de `GET /appointments/waiting-room/{staffId}` (API-GAPS §1). */
export interface WaitingRoom {
  staffId: string;
  staffName: string;
  /** Turno que se está atendiendo ahora (si hay). */
  nowServing: WaitingItem | null;
  /** Cola en orden. */
  queue: WaitingItem[];
  updatedAt: string;
}

/** Respuesta de `POST /payments/{id}/mp-preference` (API-GAPS §1). */
export interface MpPreference {
  preferenceId?: string;
  initPoint: string;
}

/** Respuesta de `POST /subscription/checkout` (sin schema en el contrato). */
export interface CheckoutResponse {
  initPoint: string;
}

/** Respuesta de `GET /payments/mp/oauth/connect` (sin schema). */
export interface MpConnectResponse {
  url: string;
}

/** Respuesta de `GET /payments/mp/oauth/status` (sin schema). */
export interface MpOauthStatus {
  connected: boolean;
  mpUserId?: string | null;
  connectedAt?: string | null;
}

/** Respuesta de `GET /files/{id}/url` (sin schema). */
export interface SignedUrlResponse {
  url: string;
}

/**
 * Fila de `GET /admin/professionals` (sin schema): el contrato la describe como
 * "Array de { professional, subscription }". Incluye los soft-borrados: cada
 * `professional` trae `deletedAt` (null = activo, fecha ISO = eliminado).
 */
export interface AdminProfessionalRow {
  professional: Professional;
  subscription: Subscription;
}

/**
 * Respuesta de la reserva con seña (`POST /r/{slug}/book-with-deposit` y
 * `POST /appointments/with-deposit`). El back devuelve `{ appointment, payment, mpInitPoint }`:
 * cuando `method: "mercadopago"` y el pago queda pendiente, `mpInitPoint` trae la `init_point`
 * de la preferencia (creada con el token del profesional) para redirigir al checkout. Así el
 * cliente anónimo no necesita llamar al endpoint autenticado `/payments/{id}/mp-preference`.
 * (Se mantiene en contract-extensions porque el OpenAPI tipa la respuesta como `void`.)
 */
export interface BookWithDepositResult {
  appointment: Appointment;
  payment?: Payment;
  mpInitPoint?: string | null;
}

/** Roles del usuario autenticado (alineado a AppRole del contrato). */
export type AccountRole = "admin" | "professional" | "comercial" | "client";

/** Sesión normalizada del front a partir de `GET /auth/me` (AuthMeDto). */
export interface MeResponse {
  id: string;
  email: string;
  fullName: string;
  roles: AccountRole[];
  /** Si es profesional (trabajador), su tenant. */
  professionalId?: string | null;
  /** Comercios que administra como comercial (+ su comercio-de-uno). */
  comercioIds?: string[];
  /** Si el back lo informa: true/false. `undefined` = no sabemos (no mostramos aviso). */
  emailVerified?: boolean;
}

/** Membership con el comercio embebido (respuesta de `/comercios/memberships/mine`). */
export interface MembershipWithComercio {
  id: string;
  professionalId: string;
  comercioId: string;
  status: "invited" | "active" | "inactive";
  /** Ubicación propia del profesional en este comercio (Fase 3). null = usa la del comercio. */
  address?: string | null;
  /**
   * Anticipación mínima de reserva, en horas: un cliente solo puede reservar un turno que empiece
   * al menos estas horas en el futuro. 0 = sin restricción. La configura el profesional por comercio.
   */
  minBookingHours?: number;
  /**
   * Ventana máxima de reserva, en días: un cliente solo puede reservar un turno que empiece como
   * mucho estos días en el futuro (7 = una semana, 30 = un mes). 0 = sin límite. La configura el
   * profesional por comercio.
   */
  maxBookingDays?: number;
  /**
   * Si es true, un turno reservado sin seña queda provisional y puede ser desplazado por otro
   * cliente que pague la seña. false (default) = el turno sin seña queda firme. Por comercio.
   */
  allowProvisionalBookings?: boolean;
  comercio?: {
    id: string;
    name: string;
    slug: string;
    address?: string | null;
    isPersonal: boolean;
  };
}

/** Membership con el profesional embebido (respuesta del roster `/comercios/{id}/members`). */
export interface MembershipWithProfessional {
  id: string;
  professionalId: string;
  comercioId: string;
  status: "invited" | "active" | "inactive";
  professional?: {
    id: string;
    fullName?: string;
    email?: string;
  };
}

/**
 * Profesional visto desde el panel de admin de plataforma (API-GAPS §2e).
 * Cruza datos del negocio con el estado de su suscripción/pago.
 */
export interface AdminProfessional {
  id: string;
  businessName: string;
  slug: string;
  ownerName: string;
  ownerEmail: string;
  createdAt: string;
  /** Estado operativo en la plataforma. */
  status: "active" | "blocked";
  /** Estado de la suscripción (alineado a SubscriptionStatus del contrato). */
  subscriptionStatus: "trial" | "active" | "past_due" | "grace" | "blocked" | "cancelled";
  monthlyCents: number;
  nextChargeAt: string | null;
  appointmentsLast30: number;
}

/** Métricas de la plataforma (vista /admin/metricas, API-GAPS §2e). */
export interface AdminMetrics {
  totals: {
    activeProfessionals: number;
    mrrCents: number;
    newThisMonth: number;
    churnThisMonth: number;
  };
  /** Profesionales activos por mes. */
  activeByMonth: { label: string; activos: number }[];
  /** Ingresos (MRR) por mes en centavos. */
  mrrByMonth: { label: string; cents: number }[];
  /** Altas vs bajas por mes. */
  growthByMonth: { label: string; altas: number; bajas: number }[];
}

/** Eventos de Socket.IO para la sala de espera (API-GAPS §4). */
export interface WaitingRoomUpdateEvent {
  staffId: string;
  room: WaitingRoom;
}

/**
 * Métricas agregadas del negocio (vista /app/metricas y dashboard). El contrato no
 * expone métricas (ver API-GAPS §2); el back debería ofrecer algo como
 * `GET /metrics/overview?range=`. Provisional mockeado.
 */
export interface MetricsOverview {
  range: "week" | "month";
  /** Turnos atendidos por día (label es-AR + cantidad). */
  attendanceByDay: { label: string; atendidos: number; cancelados: number; noShow: number }[];
  /** Clientes nuevos vs recurrentes en el período. */
  newVsReturning: { nuevos: number; recurrentes: number };
  /** Distribución por hora del día (horarios pico). */
  peakHours: { hour: string; turnos: number }[];
  /** Ingresos por día (en centavos). */
  incomeByDay: { label: string; cents: number }[];
  /** KPIs de cabecera. */
  totals: {
    appointments: number;
    /** Ingresos efectivamente cobrados (solo pagos en estado pagado). */
    incomeCents: number;
    /** Efectivo pendiente de cobro (pending + pagarés). Opcional: backs anteriores no lo envían. */
    pendingCashCents?: number;
    newClients: number;
    noShowRate: number; // 0..1
  };
  /** Clientes que no vuelven hace tiempo (riesgo de baja). */
  atRiskClients: { id: string; fullName: string; lastVisitLabel: string }[];
}

/**
 * Cliente del profesional enriquecido con datos de la persona (nombre/contacto) para la
 * lista y la ficha. El contrato no los embebe en ProfessionalClient (ver API-GAPS §2c).
 */
export interface EnrichedClient {
  id: string;
  personId: string;
  /**
   * Datos de la persona. Hoy el backend NO los embebe en ProfessionalClient (ver
   * API-GAPS §2c / ENDPOINTS-PENDIENTES), por eso son opcionales: la UI tolera su ausencia.
   */
  fullName?: string;
  email?: string;
  phone?: string;
  status: "active" | "archived";
  /** valores de ficha indexados por ficha_field.id */
  fichaValues: Record<string, unknown>;
  createdAt?: string;
  /** Resumen para la lista (también de enriquecimiento; opcional). */
  visitCount?: number;
  lastVisitAt?: string | null;
}
