/**
 * Wrappers tipados para la reserva pública por COMERCIO (Fases 3 y 5).
 *
 * Flujo Fase 5: comercio → elegir servicio → elegir profesional o "cualquiera" → slots → reservar.
 * - Servicio elegido: slots y book via `/r/:slug/services/:serviceId/{slots,book}`.
 * - Profesional específico: slots y book via `/r/:slug/professionals/:membershipId/{slots,book}`.
 * Las rutas planas `/r/:slug/{slots,book}` quedaron `deprecated`.
 *
 * Hechos a mano (en vez de usar los hooks generados) para controlar queryKeys y tipos de slot.
 */
import { useQuery, useMutation } from "@tanstack/react-query";
import { customInstance } from "@/lib/api/axios-instance";
import { titleCaseName } from "@/lib/format";
import type { ComercioPublicPageDto } from "@/lib/api/generated/model/comercioPublicPageDto";
import type { PublicProfessionalDetailDto } from "@/lib/api/generated/model/publicProfessionalDetailDto";
import type { DayAvailabilityDto } from "@/lib/api/generated/model/dayAvailabilityDto";
import type { PublicBookDto } from "@/lib/api/generated/model/publicBookDto";
import type { PublicBookWithDepositDto } from "@/lib/api/generated/model/publicBookWithDepositDto";
import type { Slot, BookWithDepositResult, ServiceCombinationRuleWithService } from "@/mocks/contract-extensions";
import type { Appointment } from "@/lib/api/generated/model/appointment";
import type { PublicServiceDto } from "@/lib/api/generated/model/publicServiceDto";

/** Página del comercio: datos + lista de profesionales (`/r/:slug`). */
export function useComercioPublicPage(slug: string) {
  return useQuery({
    queryKey: ["comercio-public-page", slug],
    queryFn: ({ signal }) =>
      customInstance<ComercioPublicPageDto>({ url: `/r/${slug}`, method: "GET", signal }),
    // Normalizamos a "Title Case" lo que se muestra (comercio + profesionales). Es la cara
    // pública y solo lectura, así que no hay riesgo de pisar formularios de edición.
    select: (page): ComercioPublicPageDto => ({
      ...page,
      name: titleCaseName(page.name),
      professionals: page.professionals.map((p) => ({
        ...p,
        displayName: titleCaseName(p.displayName),
      })),
    }),
    enabled: !!slug,
  });
}

/** Detalle de un profesional del comercio: servicios + ubicación resuelta. */
export function usePublicProfessional(slug: string, membershipId: string | null) {
  return useQuery({
    queryKey: ["public-professional", slug, membershipId],
    queryFn: ({ signal }) =>
      customInstance<PublicProfessionalDetailDto>({
        url: `/r/${slug}/professionals/${membershipId}`,
        method: "GET",
        signal,
      }),
    select: (detail): PublicProfessionalDetailDto => ({
      ...detail,
      displayName: titleCaseName(detail.displayName),
      services: detail.services.map((s) => ({ ...s, name: titleCaseName(s.name) })),
    }),
    enabled: !!slug && !!membershipId,
  });
}

export interface ProfessionalSlotsQuery {
  serviceId: string;
  from: string;
  to: string;
  /** IDs de servicios adicionales, comma-separated. El back los suma a la duración del bloque. */
  addonServiceIds?: string;
}

/**
 * Disponibilidad por día del profesional para un servicio y rango. Por cada fecha devuelve
 * `status` (available/closed/time_off/full), `bookable` y, cuando `status=time_off`, el `reason`
 * cargado por el profesional. Es la señal confiable para deshabilitar y rotular los días en el
 * selector de fecha del cliente (en vez de inferir "cerrado" desde la ausencia de slots).
 */
export function usePublicProfessionalDayAvailability(
  slug: string,
  membershipId: string | null,
  params: ProfessionalSlotsQuery | null,
) {
  return useQuery({
    queryKey: ["public-professional-day-availability", slug, membershipId, params],
    queryFn: ({ signal }) =>
      customInstance<DayAvailabilityDto[]>({
        url: `/r/${slug}/professionals/${membershipId}/day-availability`,
        method: "GET",
        params: params ?? undefined,
        signal,
      }),
    enabled: !!slug && !!membershipId && !!params,
  });
}

/** Slots de un profesional para un servicio (`/r/:slug/professionals/:membershipId/slots`). */
export function usePublicProfessionalSlots(
  slug: string,
  membershipId: string | null,
  params: ProfessionalSlotsQuery | null,
) {
  return useQuery({
    queryKey: ["public-professional-slots", slug, membershipId, params],
    queryFn: ({ signal }) =>
      customInstance<Slot[]>({
        url: `/r/${slug}/professionals/${membershipId}/slots`,
        method: "GET",
        params: params ?? undefined,
        signal,
      }),
    enabled: !!slug && !!membershipId && !!params,
  });
}

type PublicBookWithAddons = PublicBookDto & { addonServiceIds?: string[] };
type PublicBookWithDepositAndAddons = PublicBookWithDepositDto & { addonServiceIds?: string[] };

/** Reserva sin pago (eligiendo profesional). Puede quedar provisional (lo decide el back). */
export function useBookProfessional(slug: string, membershipId: string) {
  return useMutation({
    mutationFn: (data: PublicBookWithAddons) =>
      customInstance<Appointment>({
        url: `/r/${slug}/professionals/${membershipId}/book`,
        method: "POST",
        data,
      }),
  });
}

/**
 * Reserva con seña/pago total (eligiendo profesional). Devuelve `{ appointment, payment,
 * mpInitPoint? }`. `mpInitPoint` es una extensión del front para redirigir a MercadoPago.
 */
export function useBookProfessionalWithDeposit(slug: string, membershipId: string) {
  return useMutation({
    mutationFn: (data: PublicBookWithDepositAndAddons) =>
      customInstance<BookWithDepositResult>({
        url: `/r/${slug}/professionals/${membershipId}/book-with-deposit`,
        method: "POST",
        data,
      }),
  });
}

/** Catálogo de servicios del comercio para la reserva pública (Fase 5). */
export function usePublicServices(slug: string) {
  return useQuery({
    queryKey: ["public-services", slug],
    queryFn: ({ signal }) =>
      customInstance<PublicServiceDto[]>({ url: `/r/${slug}/services`, method: "GET", signal }),
    select: (list): PublicServiceDto[] =>
      list.map((s) => ({
        ...s,
        name: titleCaseName(s.name),
        professionals: s.professionals.map((p) => ({
          ...p,
          displayName: titleCaseName(p.displayName),
        })),
      })),
    enabled: !!slug,
  });
}

/** Slots agregados del servicio (cualquier profesional asignado). */
export function usePublicServiceSlots(
  slug: string,
  serviceId: string | null,
  params: ProfessionalSlotsQuery | null,
) {
  return useQuery({
    queryKey: ["public-service-slots", slug, serviceId, params],
    queryFn: ({ signal }) =>
      customInstance<Slot[]>({
        url: `/r/${slug}/services/${serviceId}/slots`,
        method: "GET",
        params: params ?? undefined,
        signal,
      }),
    enabled: !!slug && !!serviceId && !!params,
  });
}

/** Disponibilidad por día agregada del servicio (cualquier profesional asignado). */
export function usePublicServiceDayAvailability(
  slug: string,
  serviceId: string | null,
  params: ProfessionalSlotsQuery | null,
) {
  return useQuery({
    queryKey: ["public-service-day-availability", slug, serviceId, params],
    queryFn: ({ signal }) =>
      customInstance<DayAvailabilityDto[]>({
        url: `/r/${slug}/services/${serviceId}/day-availability`,
        method: "GET",
        params: params ?? undefined,
        signal,
      }),
    enabled: !!slug && !!serviceId && !!params,
  });
}

/** Reserva "cualquiera" sin pago: el back asigna el profesional de menor carga. */
export function useBookService(slug: string, serviceId: string) {
  return useMutation({
    mutationFn: (data: PublicBookWithAddons) =>
      customInstance<Appointment>({
        url: `/r/${slug}/services/${serviceId}/book`,
        method: "POST",
        data,
      }),
  });
}

/** Reserva "cualquiera" con seña/pago total. */
export function useBookServiceWithDeposit(slug: string, serviceId: string) {
  return useMutation({
    mutationFn: (data: PublicBookWithDepositAndAddons) =>
      customInstance<BookWithDepositResult>({
        url: `/r/${slug}/services/${serviceId}/book-with-deposit`,
        method: "POST",
        data,
      }),
  });
}

/** Reglas de combinación del servicio primario (para el panel de add-ons del cliente). */
export function usePublicCombinationRules(
  slug: string,
  membershipId: string | null,
  serviceId: string | null,
) {
  return useQuery({
    queryKey: ["public-combination-rules", slug, membershipId, serviceId],
    queryFn: ({ signal }) =>
      customInstance<ServiceCombinationRuleWithService[]>({
        url: `/r/${slug}/professionals/${membershipId}/services/${serviceId}/combination-rules`,
        method: "GET",
        signal,
      }),
    enabled: !!slug && !!membershipId && !!serviceId,
  });
}
