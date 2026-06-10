/**
 * Wrappers tipados sobre el cliente generado para la reserva pública.
 * El contrato deja `GET /r/{slug}` y `/slots` como `void` (ver API-GAPS §1); acá
 * adaptamos los hooks generados a los tipos provisionales (PublicPage, Slot) para que
 * las pantallas trabajen tipadas. Cuando el back tipe el spec, esto se simplifica.
 */
import { useQuery } from "@tanstack/react-query";
import { customInstance } from "@/lib/api/axios-instance";
import type { PublicPage, Slot } from "@/mocks/contract-extensions";

export function usePublicPage(slug: string) {
  return useQuery({
    queryKey: ["public-page", slug],
    queryFn: ({ signal }) =>
      customInstance<PublicPage>({ url: `/r/${slug}`, method: "GET", signal }),
    enabled: !!slug,
  });
}

export interface SlotsQuery {
  staffId: string;
  serviceId: string;
  from: string;
  to: string;
}

export function usePublicSlots(slug: string, params: SlotsQuery | null) {
  return useQuery({
    queryKey: ["public-slots", slug, params],
    queryFn: ({ signal }) =>
      customInstance<Slot[]>({
        url: `/r/${slug}/slots`,
        method: "GET",
        params: params ?? undefined,
        signal,
      }),
    enabled: !!slug && !!params,
  });
}
