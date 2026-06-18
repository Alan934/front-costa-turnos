/**
 * Datos semilla para MSW. Un caso realista: una peluquería/barbería de pueblo de costa.
 * Todo en memoria; los handlers mutan estas estructuras durante la sesión.
 *
 * Montos en centavos (priceCents/depositAmountCents) para alinear con el contrato.
 */
import type { Service } from "@/lib/api/generated/model/service";
import type { Staff } from "@/lib/api/generated/model/staff";
import type { Professional } from "@/lib/api/generated/model/professional";
import type { Appointment } from "@/lib/api/generated/model/appointment";
import type { FichaField } from "@/lib/api/generated/model/fichaField";
import { DepositMode } from "@/lib/api/generated/model/depositMode";
import { AppointmentStatus } from "@/lib/api/generated/model/appointmentStatus";
import { CreatedVia } from "@/lib/api/generated/model/createdVia";
import type { ClientNote } from "@/lib/api/generated/model/clientNote";
import type { ScheduleRule } from "@/lib/api/generated/model/scheduleRule";
import type { TimeOff } from "@/lib/api/generated/model/timeOff";
import type { Subscription } from "@/lib/api/generated/model/subscription";
import type { SubscriptionPayment } from "@/lib/api/generated/model/subscriptionPayment";
import type { Payment } from "@/lib/api/generated/model/payment";
import { ScheduleRuleKind } from "@/lib/api/generated/model/scheduleRuleKind";
import { SubscriptionStatus } from "@/lib/api/generated/model/subscriptionStatus";
import { PaymentType } from "@/lib/api/generated/model/paymentType";
import { PaymentMethod } from "@/lib/api/generated/model/paymentMethod";
import { PaymentStatus } from "@/lib/api/generated/model/paymentStatus";
import { SubscriptionPaymentStatus } from "@/lib/api/generated/model/subscriptionPaymentStatus";
import type {
  WaitingRoom,
  WaitingItem,
  MeResponse,
  EnrichedClient,
} from "./contract-extensions";
import type { ComercioPublicPageDto } from "@/lib/api/generated/model/comercioPublicPageDto";
import type { PublicProfessionalDetailDto } from "@/lib/api/generated/model/publicProfessionalDetailDto";
import type { PublicServiceDto } from "@/lib/api/generated/model/publicServiceDto";

const now = new Date();
const iso = (d: Date) => d.toISOString();
const at = (hours: number, minutes = 0, dayOffset = 0) => {
  const d = new Date(now);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hours, minutes, 0, 0);
  return d;
};

export const PROFESSIONAL_ID = "pro_pueblo";
export const SLUG = "peluqueria-del-pueblo";
// Fase 2: el comercio-de-uno del profesional demo y su membresía en él. Los servicios/horarios/
// turnos del seed cuelgan de esta membresía (modelo por-comercio).
export const COMERCIO_ID = "com_pueblo";
export const MEMBERSHIP_ID = "mem_pueblo_self";

export const professional: Professional = {
  id: PROFESSIONAL_ID,
  createdAt: iso(at(9, 0, -120)),
  updatedAt: iso(now),
  accountId: "acc_owner",
  businessName: "Peluquería del Pueblo",
  slug: SLUG,
  timezone: "America/Argentina/Buenos_Aires",
  defaultDepositMode: DepositMode.hybrid,
  cancellationWindowHours: 24,
  rescheduleWindowHours: 8,
  publicPageSettings: {
    accentColor: "#16707A",
    bio: "Cortes, color y barbería en Costa de Araujo. Atendemos con turno.",
    address: "Belgrano 245, Costa de Araujo, Mendoza",
    phone: "+54 9 261 555-0245",
  },
};

export const staff: Staff[] = [
  {
    id: "staff_lucia",
    createdAt: iso(at(9, 0, -120)),
    updatedAt: iso(now),
    professionalId: PROFESSIONAL_ID,
    // El contrato tipa Staff.accountId como objeto|null (ver API-GAPS §1); usamos null.
    accountId: null,
    displayName: "Lucía",
    isActive: true,
  },
  {
    id: "staff_tomas",
    createdAt: iso(at(9, 0, -90)),
    updatedAt: iso(now),
    professionalId: PROFESSIONAL_ID,
    accountId: null,
    displayName: "Tomás",
    isActive: true,
  },
];

export const services: Service[] = [
  {
    id: "svc_corte",
    createdAt: iso(at(9, 0, -120)),
    updatedAt: iso(now),
    professionalId: PROFESSIONAL_ID,
    comercioId: COMERCIO_ID,
    membershipId: MEMBERSHIP_ID,
    name: "Corte de pelo",
    durationMinutes: 30,
    priceCents: 800000,
    allowNoPayment: true,
    allowDeposit: false,
    allowFullPayment: false,
    depositAmountCents: null,
    capacity: 1,
    isActive: true,
  },
  {
    id: "svc_corte_barba",
    createdAt: iso(at(9, 0, -120)),
    updatedAt: iso(now),
    professionalId: PROFESSIONAL_ID,
    comercioId: COMERCIO_ID,
    membershipId: MEMBERSHIP_ID,
    name: "Corte + barba",
    durationMinutes: 45,
    priceCents: 1200000,
    allowNoPayment: true,
    allowDeposit: true,
    allowFullPayment: true,
    depositAmountCents: 400000,
    capacity: 1,
    isActive: true,
  },
  {
    id: "svc_color",
    createdAt: iso(at(9, 0, -120)),
    updatedAt: iso(now),
    professionalId: PROFESSIONAL_ID,
    comercioId: COMERCIO_ID,
    membershipId: MEMBERSHIP_ID,
    name: "Color + lavado",
    durationMinutes: 90,
    priceCents: 2500000,
    allowNoPayment: false,
    allowDeposit: true,
    allowFullPayment: true,
    depositAmountCents: 1000000,
    capacity: 1,
    isActive: true,
  },
];

// Fase 3: la página pública es por COMERCIO. El seed demo es un comercio-de-uno (un solo
// profesional), así que `isPersonal: true` y un único item en `professionals`.
const DEMO_ADDRESS = "Belgrano 245, Costa de Araujo, Mendoza";

export function buildComercioPublicPage(): ComercioPublicPageDto & { mpConnected: boolean } {
  return {
    comercioId: COMERCIO_ID,
    name: professional.businessName,
    slug: professional.slug,
    timezone: professional.timezone,
    address: DEMO_ADDRESS,
    isPersonal: true,
    // El back incluye este campo para que la página pública sepa si puede ofrecer pagos online.
    mpConnected: !!professional.mpUserId,
    settings: {
      accentColor: "#16707A",
      bio: "Cortes, color y barbería en Costa de Araujo. Atendemos con turno.",
      phone: "+54 9 261 555-0245",
    },
    professionals: [
      {
        membershipId: MEMBERSHIP_ID,
        professionalId: professional.id,
        displayName: professional.businessName,
        address: DEMO_ADDRESS,
      },
    ],
  };
}

/** Detalle de un profesional del comercio (servicios activos + ubicación). */
export function buildProfessionalDetail(): PublicProfessionalDetailDto {
  return {
    membershipId: MEMBERSHIP_ID,
    professionalId: professional.id,
    displayName: professional.businessName,
    address: DEMO_ADDRESS,
    bio: "Cortes, color y barbería en Costa de Araujo. Atendemos con turno.",
    phone: "+54 9 261 555-0245",
    timezone: professional.timezone,
    services: services.filter((s) => s.isActive),
  };
}

/** Catálogo de servicios del comercio para la reserva pública (GET /r/:slug/services). */
export function buildPublicServices(): PublicServiceDto[] {
  return services
    .filter((s) => s.isActive)
    .map((s) => ({
      serviceId: s.id,
      name: s.name,
      durationMinutes: s.durationMinutes,
      priceCents: s.priceCents,
      allowDeposit: s.allowDeposit,
      allowFullPayment: s.allowFullPayment,
      allowNoPayment: s.allowNoPayment,
      depositAmountCents: s.depositAmountCents ?? null,
      professionals: [
        {
          membershipId: MEMBERSHIP_ID,
          professionalId: professional.id,
          displayName: professional.businessName,
          address: DEMO_ADDRESS,
        },
      ],
    }));
}

export const fichaFields: FichaField[] = [
  {
    id: "ff_alergias",
    createdAt: iso(now),
    updatedAt: iso(now),
    professionalId: PROFESSIONAL_ID,
    label: "Alergias / sensibilidad",
    type: "text",
    isRequired: false,
    isVisibleToClient: true,
    displayOrder: 1,
  },
  {
    id: "ff_tipo_pelo",
    createdAt: iso(now),
    updatedAt: iso(now),
    professionalId: PROFESSIONAL_ID,
    label: "Tipo de pelo",
    type: "select",
    options: { choices: ["Lacio", "Ondulado", "Rizado"] },
    isRequired: false,
    isVisibleToClient: true,
    displayOrder: 2,
  },
  {
    id: "ff_foto_referencia",
    createdAt: iso(now),
    updatedAt: iso(now),
    professionalId: PROFESSIONAL_ID,
    label: "Foto de referencia",
    type: "photo",
    isRequired: false,
    isVisibleToClient: false,
    displayOrder: 3,
  },
];

/** Nombres de pila por personId (para la sala de espera; nunca nombre completo en público). */
export const personFirstNames: Record<string, string> = {
  per_sofia: "Sofía",
  per_martin: "Martín",
  per_juan: "Juan",
  per_lucas: "Lucas",
  per_caro: "Carolina",
  per_die: "Diego",
  per_flor: "Florencia",
};

export const appointments: Appointment[] = [
  {
    id: "apt_1",
    createdAt: iso(at(8, 0)),
    updatedAt: iso(now),
    professionalId: PROFESSIONAL_ID,
    comercioId: COMERCIO_ID,
    membershipId: MEMBERSHIP_ID,
    staffId: "staff_lucia",
    personId: "per_sofia",
    serviceId: "svc_color",
    startAt: iso(at(10, 0)),
    endAt: iso(at(11, 30)),
    status: AppointmentStatus.in_progress,
    isProvisional: false,
    actualStartAt: iso(at(10, 5)),
    createdVia: CreatedVia.client_self,
  },
  {
    id: "apt_2",
    createdAt: iso(at(8, 30)),
    updatedAt: iso(now),
    professionalId: PROFESSIONAL_ID,
    comercioId: COMERCIO_ID,
    membershipId: MEMBERSHIP_ID,
    staffId: "staff_lucia",
    personId: "per_martin",
    serviceId: "svc_corte_barba",
    startAt: iso(at(11, 30)),
    endAt: iso(at(12, 15)),
    status: AppointmentStatus.confirmed,
    isProvisional: false,
    createdVia: CreatedVia.client_self,
  },
  {
    id: "apt_3",
    createdAt: iso(at(9, 0)),
    updatedAt: iso(now),
    professionalId: PROFESSIONAL_ID,
    comercioId: COMERCIO_ID,
    membershipId: MEMBERSHIP_ID,
    staffId: "staff_lucia",
    personId: "per_juan",
    serviceId: "svc_corte",
    startAt: iso(at(12, 15)),
    endAt: iso(at(12, 45)),
    status: AppointmentStatus.requested,
    isProvisional: true,
    createdVia: CreatedVia.client_self,
  },
  // Turno futuro de Sofía DENTRO de la ventana de reprogramación (now + 3 h, ventana 8 h):
  // en /mis-turnos el botón "Reprogramar" aparece deshabilitado.
  {
    id: "apt_sofia_soon",
    createdAt: iso(at(8, 0)),
    updatedAt: iso(now),
    professionalId: PROFESSIONAL_ID,
    comercioId: COMERCIO_ID,
    membershipId: MEMBERSHIP_ID,
    staffId: "staff_lucia",
    personId: "per_sofia",
    serviceId: "svc_corte",
    startAt: iso(new Date(now.getTime() + 3 * 3_600_000)),
    endAt: iso(new Date(now.getTime() + 3 * 3_600_000 + 30 * 60_000)),
    status: AppointmentStatus.confirmed,
    isProvisional: false,
    createdVia: CreatedVia.client_self,
  },
  // Turno futuro de Sofía FUERA de la ventana (pasado mañana): "Reprogramar" habilitado.
  {
    id: "apt_sofia_far",
    createdAt: iso(at(8, 0)),
    updatedAt: iso(now),
    professionalId: PROFESSIONAL_ID,
    comercioId: COMERCIO_ID,
    membershipId: MEMBERSHIP_ID,
    staffId: "staff_lucia",
    personId: "per_sofia",
    serviceId: "svc_color",
    startAt: iso(at(15, 0, 2)),
    endAt: iso(at(16, 30, 2)),
    status: AppointmentStatus.confirmed,
    isProvisional: false,
    createdVia: CreatedVia.client_self,
  },
];

/**
 * Puebla la semana con turnos variados (otros días y el staff Tomás) para que la agenda
 * se vea realista. Determinístico a partir de la fecha actual.
 */
(function seedWeek() {
  const names = Object.keys(personFirstNames);
  const svcIds = services.map((s) => s.id);
  const statuses = [
    AppointmentStatus.confirmed,
    AppointmentStatus.confirmed,
    AppointmentStatus.requested,
    AppointmentStatus.done,
  ];
  let n = 0;
  // de -1 (ayer) a +5 días
  for (let offset = -1; offset <= 5; offset++) {
    for (const staffId of ["staff_lucia", "staff_tomas"]) {
      // 2-3 turnos por día y staff en horas distintas
      const hours = staffId === "staff_lucia" ? [9, 14, 16] : [10, 15];
      for (const h of hours) {
        // saltear el día de hoy en Lucía para no chocar con los apt_1..3 ya definidos
        if (offset === 0 && staffId === "staff_lucia") continue;
        const svc = services.find((s) => s.id === svcIds[n % svcIds.length])!;
        const start = at(h, (n % 2) * 30, offset);
        const end = new Date(start);
        end.setMinutes(end.getMinutes() + svc.durationMinutes);
        const status =
          offset < 0 ? AppointmentStatus.done : statuses[n % statuses.length];
        appointments.push({
          id: `apt_w${n}`,
          createdAt: iso(at(8, 0, offset - 1)),
          updatedAt: iso(now),
          professionalId: PROFESSIONAL_ID,
          comercioId: COMERCIO_ID,
          membershipId: MEMBERSHIP_ID,
          staffId,
          personId: names[n % names.length],
          serviceId: svc.id,
          startAt: iso(start),
          endAt: end.toISOString(),
          status,
          isProvisional:
            status === AppointmentStatus.requested && (svc.allowDeposit || svc.allowFullPayment),
          createdVia: n % 2 === 0 ? CreatedVia.client_self : CreatedVia.professional,
        });
        n++;
      }
    }
  }
})();


export function buildWaitingRoom(staffId: string): WaitingRoom {
  const staffMember = staff.find((s) => s.id === staffId);
  const activeStatuses: AppointmentStatus[] = [
    AppointmentStatus.requested,
    AppointmentStatus.confirmed,
    AppointmentStatus.in_progress,
  ];
  const rows = appointments
    .filter((a) => a.staffId === staffId && activeStatuses.includes(a.status))
    .sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));

  const serving = rows.find((a) => a.status === AppointmentStatus.in_progress) ?? null;
  const queue = rows.filter((a) => a.status !== AppointmentStatus.in_progress);

  const toItem = (a: Appointment, idx: number): WaitingItem => ({
    appointmentId: a.id,
    displayName: personFirstNames[a.personId] ?? "Cliente",
    ticketNumber: idx + 1,
    position: idx,
    etaMinutes: idx * 30,
    status: a.status,
    serviceName: services.find((s) => s.id === a.serviceId)?.name ?? "Servicio",
    startAt: a.startAt,
  });

  return {
    staffId,
    staffName: staffMember?.displayName ?? "Staff",
    nowServing: serving ? toItem(serving, 0) : null,
    queue: queue.map((a, i) => toItem(a, i + 1)),
    updatedAt: iso(new Date()),
  };
}

/** Usuario profesional (dueña del tenant). */
export const me: MeResponse = {
  id: "acc_owner",
  email: "lucia@peluqueriadelpueblo.com.ar",
  fullName: "Lucía Fernández",
  roles: ["professional"],
  professionalId: PROFESSIONAL_ID,
};

/** Usuario cliente de ejemplo (puede tener turnos con varios profesionales). */
export const clientUser: MeResponse = {
  id: "acc_cliente",
  email: "sofia@gmail.com",
  fullName: "Sofía Pérez",
  roles: ["client"],
  professionalId: null,
};

/** Usuario admin de la plataforma. */
export const adminUser: MeResponse = {
  id: "acc_admin",
  email: "admin@costaturnos.com.ar",
  fullName: "Admin Costa Turnos",
  roles: ["admin"],
  professionalId: null,
};

/** Profesionales de la plataforma (vista de admin). Forma real: { professional, subscription }. */
function adminRow(args: {
  id: string;
  businessName: string;
  slug: string;
  accountId: string;
  createdDayOffset: number;
  status: SubscriptionStatus;
  periodEndOffset: number;
  trialEndOffset?: number;
  graceEndOffset?: number;
}): import("./contract-extensions").AdminProfessionalRow {
  const pro: Professional = {
    id: args.id,
    createdAt: iso(at(9, 0, args.createdDayOffset)),
    updatedAt: iso(now),
    accountId: args.accountId,
    businessName: args.businessName,
    slug: args.slug,
    timezone: "America/Argentina/Buenos_Aires",
    defaultDepositMode: DepositMode.hybrid,
    cancellationWindowHours: 24,
    rescheduleWindowHours: 24,
    publicPageSettings: {},
  };
  const sub: Subscription = {
    id: `sub_${args.id}`,
    createdAt: iso(at(9, 0, args.createdDayOffset)),
    updatedAt: iso(now),
    professionalId: args.id,
    status: args.status,
    trialEndsAt: args.trialEndOffset != null ? iso(at(0, 0, args.trialEndOffset)) : null,
    currentPeriodStart: iso(at(0, 0, args.periodEndOffset - 30)),
    currentPeriodEnd: iso(at(0, 0, args.periodEndOffset)),
    graceEndsAt: args.graceEndOffset != null ? iso(at(0, 0, args.graceEndOffset)) : null,
    amountCents: 1500000,
    mercadopagoPreapprovalId: null,
  };
  return { professional: pro, subscription: sub };
}

export const adminProfessionals: import("./contract-extensions").AdminProfessionalRow[] = [
  adminRow({ id: PROFESSIONAL_ID, businessName: "Peluquería del Pueblo", slug: SLUG, accountId: "acc_owner", createdDayOffset: -120, status: SubscriptionStatus.active, periodEndOffset: 20 }),
  adminRow({ id: "pro_2", businessName: "Barbería Don Carlos", slug: "barberia-don-carlos", accountId: "acc_2", createdDayOffset: -200, status: SubscriptionStatus.active, periodEndOffset: 12 }),
  adminRow({ id: "pro_3", businessName: "Estudio de Uñas Bril", slug: "estudio-bril", accountId: "acc_3", createdDayOffset: -10, status: SubscriptionStatus.trial, periodEndOffset: 5, trialEndOffset: 5 }),
  adminRow({ id: "pro_4", businessName: "Kinesiología Vértice", slug: "kine-vertice", accountId: "acc_4", createdDayOffset: -300, status: SubscriptionStatus.grace, periodEndOffset: -3, graceEndOffset: 1 }),
  adminRow({ id: "pro_5", businessName: "Spa Serena", slug: "spa-serena", accountId: "acc_5", createdDayOffset: -400, status: SubscriptionStatus.cancelled, periodEndOffset: -40 }),
];

/** Métricas de plataforma (vista admin). */
export const adminMetrics: import("./contract-extensions").AdminMetrics = {
  totals: {
    activeProfessionals: 4,
    mrrCents: 6000000,
    newThisMonth: 2,
    churnThisMonth: 1,
  },
  activeByMonth: [
    { label: "Ene", activos: 1 },
    { label: "Feb", activos: 1 },
    { label: "Mar", activos: 2 },
    { label: "Abr", activos: 3 },
    { label: "May", activos: 3 },
    { label: "Jun", activos: 4 },
  ],
  mrrByMonth: [
    { label: "Ene", cents: 1500000 },
    { label: "Feb", cents: 1500000 },
    { label: "Mar", cents: 3000000 },
    { label: "Abr", cents: 4500000 },
    { label: "May", cents: 4500000 },
    { label: "Jun", cents: 6000000 },
  ],
  growthByMonth: [
    { label: "Ene", altas: 1, bajas: 0 },
    { label: "Feb", altas: 0, bajas: 0 },
    { label: "Mar", altas: 1, bajas: 0 },
    { label: "Abr", altas: 1, bajas: 0 },
    { label: "May", altas: 1, bajas: 1 },
    { label: "Jun", altas: 2, bajas: 1 },
  ],
};

/** Clientes del profesional (enriquecidos para la lista/ficha — ver API-GAPS §2c). */
export const clients: EnrichedClient[] = [
  {
    id: "cli_sofia",
    personId: "per_sofia",
    fullName: "Sofía Pérez",
    email: "sofia@gmail.com",
    phone: "+54 9 261 555-1001",
    status: "active",
    fichaValues: { ff_alergias: "Ninguna", ff_tipo_pelo: "Ondulado" },
    createdAt: iso(at(9, 0, -90)),
    visitCount: 8,
    lastVisitAt: iso(at(10, 0, -7)),
  },
  {
    id: "cli_martin",
    personId: "per_martin",
    fullName: "Martín Gómez",
    email: "martin.gomez@gmail.com",
    phone: "+54 9 261 555-1002",
    status: "active",
    fichaValues: { ff_tipo_pelo: "Lacio" },
    createdAt: iso(at(9, 0, -60)),
    visitCount: 3,
    lastVisitAt: iso(at(11, 30, -14)),
  },
  {
    id: "cli_caro",
    personId: "per_caro",
    fullName: "Carolina Díaz",
    email: "caro.diaz@hotmail.com",
    phone: "+54 9 261 555-1003",
    status: "active",
    fichaValues: { ff_alergias: "Tintura con amoníaco", ff_tipo_pelo: "Rizado" },
    createdAt: iso(at(9, 0, -30)),
    visitCount: 1,
    lastVisitAt: iso(at(14, 0, -30)),
  },
  {
    id: "cli_juan",
    personId: "per_juan",
    fullName: "Juan López",
    phone: "+54 9 261 555-1004",
    status: "active",
    fichaValues: {},
    createdAt: iso(at(9, 0, -10)),
    visitCount: 0,
    lastVisitAt: null,
  },
  {
    id: "cli_die",
    personId: "per_die",
    fullName: "Diego Ruiz",
    email: "diego.ruiz@gmail.com",
    status: "archived",
    fichaValues: {},
    createdAt: iso(at(9, 0, -120)),
    visitCount: 5,
    lastVisitAt: iso(at(16, 0, -100)),
  },
];

/** Reglas de horario por staff (lun-sáb 9-18 con pausa de almuerzo). */
export const scheduleRules: ScheduleRule[] = (() => {
  const out: ScheduleRule[] = [];
  let n = 0;
  for (const staffId of ["staff_lucia", "staff_tomas"]) {
    for (let day = 1; day <= 6; day++) {
      // jornada de trabajo
      out.push({
        id: `sr_${n++}`,
        createdAt: iso(now),
        updatedAt: iso(now),
        staffId,
        membershipId: MEMBERSHIP_ID,
        dayOfWeek: day,
        startTime: "09:00",
        endTime: day === 6 ? "13:00" : "18:00",
        kind: ScheduleRuleKind.work,
        // serviceIds vacío = la regla aplica a todos los servicios de la membresía.
        serviceIds: [],
      });
      // pausa de almuerzo (salvo sábado)
      if (day !== 6) {
        out.push({
          id: `sr_${n++}`,
          createdAt: iso(now),
          updatedAt: iso(now),
          staffId,
          membershipId: MEMBERSHIP_ID,
          dayOfWeek: day,
          startTime: "13:00",
          endTime: "14:00",
          kind: ScheduleRuleKind.break,
          serviceIds: [],
        });
      }
    }
  }
  return out;
})();

/** Bloqueos / ausencias por staff (feriados, vacaciones, bloqueos puntuales). */
export const timeOffs: TimeOff[] = [
  {
    id: "to_1",
    createdAt: iso(now),
    updatedAt: iso(now),
    staffId: "staff_lucia",
    membershipId: MEMBERSHIP_ID,
    startAt: iso(at(0, 0, 9)),
    endAt: iso(at(23, 59, 16)),
    // El contrato tipa reason como objeto|null (ver API-GAPS §1b); guardamos el texto.
    reason: "Vacaciones" as unknown as TimeOff["reason"],
  },
  {
    id: "to_2",
    createdAt: iso(now),
    updatedAt: iso(now),
    staffId: "staff_tomas",
    membershipId: MEMBERSHIP_ID,
    startAt: iso(at(15, 0, 2)),
    endAt: iso(at(18, 0, 2)),
    reason: "Turno médico" as unknown as TimeOff["reason"],
  },
  {
    id: "to_3",
    createdAt: iso(now),
    updatedAt: iso(now),
    staffId: "staff_lucia",
    membershipId: MEMBERSHIP_ID,
    startAt: iso(at(0, 0, 3)),
    endAt: iso(at(23, 59, 3)),
    reason: "Feriado nacional" as unknown as TimeOff["reason"],
  },
];

/** Suscripción del profesional (activa, con próximo cobro). */
export const subscription: Subscription = {
  id: "sub_1",
  createdAt: iso(at(9, 0, -120)),
  updatedAt: iso(now),
  professionalId: PROFESSIONAL_ID,
  status: SubscriptionStatus.active,
  trialEndsAt: null,
  currentPeriodStart: iso(at(0, 0, -10)),
  currentPeriodEnd: iso(at(0, 0, 20)),
  graceEndsAt: null,
  amountCents: 1500000,
  mercadopagoPreapprovalId: null,
};

/** Pagos de la suscripción (historial del plan). */
export const subscriptionPayments: SubscriptionPayment[] = [
  {
    id: "subpay_1",
    createdAt: iso(at(9, 0, -40)),
    subscriptionId: "sub_1",
    amountCents: 1500000,
    status: SubscriptionPaymentStatus.paid,
    periodStart: iso(at(0, 0, -40)),
    periodEnd: iso(at(0, 0, -10)),
    method: PaymentMethod.mercadopago,
    mercadopagoRef: null,
    paidAt: iso(at(10, 0, -40)),
  },
  {
    id: "subpay_2",
    createdAt: iso(at(9, 0, -10)),
    subscriptionId: "sub_1",
    amountCents: 1500000,
    status: SubscriptionPaymentStatus.paid,
    periodStart: iso(at(0, 0, -10)),
    periodEnd: iso(at(0, 0, 20)),
    method: PaymentMethod.mercadopago,
    mercadopagoRef: null,
    paidAt: iso(at(10, 0, -10)),
  },
];

/** Cobros del tenant (señas/turnos). Uno pendiente sobre el turno provisional apt_3. */
export const payments: Payment[] = [
  {
    id: "pay_apt3",
    createdAt: iso(at(9, 0)),
    updatedAt: iso(now),
    professionalId: PROFESSIONAL_ID,
    appointmentId: "apt_3" as unknown as Payment["appointmentId"],
    personId: "per_juan",
    type: PaymentType.deposit,
    amountCents: 400000,
    method: PaymentMethod.mercadopago,
    status: PaymentStatus.pending,
    mercadopagoRef: null,
    paidAt: null,
  },
];

/** Notas privadas por clientId (NUNCA se muestran al cliente). */
export const clientNotes: Record<string, ClientNote[]> = {
  cli_sofia: [
    {
      id: "note_1",
      createdAt: iso(at(10, 30, -7)),
      updatedAt: iso(at(10, 30, -7)),
      professionalClientId: "cli_sofia",
      authorStaffId: null,
      body: "Prefiere el agua tibia, no caliente. Le gusta charlar poco mientras trabajamos.",
    },
    {
      id: "note_2",
      createdAt: iso(at(10, 0, -35)),
      updatedAt: iso(at(10, 0, -35)),
      professionalClientId: "cli_sofia",
      authorStaffId: null,
      body: "Última vez quedó muy conforme con el balayage. Repetir tono.",
    },
  ],
  cli_caro: [
    {
      id: "note_3",
      createdAt: iso(at(14, 30, -30)),
      updatedAt: iso(at(14, 30, -30)),
      professionalClientId: "cli_caro",
      authorStaffId: null,
      body: "OJO: alérgica a tinturas con amoníaco. Usar línea sin amoníaco siempre.",
    },
  ],
};
