/**
 * Wrappers tipados para la reserva pública por COMERCIO (Fase 3).
 *
 * `/r/:slug` resuelve un comercio. El flujo es: comercio → elegir profesional (membership) →
 * sus servicios → slots → reservar, todo con `membershipId`. El contrato ahora SÍ tipa estas
 * respuestas (`ComercioPublicPageDto`, `PublicProfessionalDetailDto`, …), así que ya no hace
 * falta normalizar a mano. Las rutas planas `/r/:slug/{slots,book}` quedaron `deprecated`.
 *
 * Hechos a mano (en vez de usar los hooks generados) para controlar queryKeys y tipos de slot.
 */
import { useQuery, useMutation } from "@tanstack/react-query";
import { customInstance } from "@/lib/api/axios-instance";
import type { ComercioPublicPageDto } from "@/lib/api/generated/model/comercioPublicPageDto";
import type { PublicProfessionalDetailDto } from "@/lib/api/generated/model/publicProfessionalDetailDto";
import type { PublicBookDto } from "@/lib/api/generated/model/publicBookDto";
import type { PublicBookWithDepositDto } from "@/lib/api/generated/model/publicBookWithDepositDto";
import type { Slot, BookWithDepositResult } from "@/mocks/contract-extensions";
import type { Appointment } from "@/lib/api/generated/model/appointment";

/** Página del comercio: datos + lista de profesionales (`/r/:slug`). */
export function useComercioPublicPage(slug: string) {
  return useQuery({
    queryKey: ["comercio-public-page", slug],
    queryFn: ({ signal }) =>
      customInstance<ComercioPublicPageDto>({ url: `/r/${slug}`, method: "GET", signal }),
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
    enabled: !!slug && !!membershipId,
  });
}

export interface ProfessionalSlotsQuery {
  serviceId: string;
  from: string;
  to: string;
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

/** Reserva sin pago (eligiendo profesional). Puede quedar provisional (lo decide el back). */
export function useBookProfessional(slug: string, membershipId: string) {
  return useMutation({
    mutationFn: (data: PublicBookDto) =>
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
    mutationFn: (data: PublicBookWithDepositDto) =>
      customInstance<BookWithDepositResult>({
        url: `/r/${slug}/professionals/${membershipId}/book-with-deposit`,
        method: "POST",
        data,
      }),
  });
}
