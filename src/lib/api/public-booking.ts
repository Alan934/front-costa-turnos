/**
 * Wrappers tipados sobre el cliente generado para la reserva pública.
 * El contrato deja `GET /r/{slug}` y `/slots` como `void` (ver API-GAPS §1); acá
 * adaptamos los hooks generados a los tipos provisionales (PublicPage, Slot) para que
 * las pantallas trabajen tipadas. Cuando el back tipe el spec, esto se simplifica.
 */
import { useQuery, useMutation } from "@tanstack/react-query";
import { customInstance } from "@/lib/api/axios-instance";
import type { BookWithDepositDto } from "@/lib/api/generated/model/bookWithDepositDto";
import type { PublicPage, Slot, BookWithDepositResult } from "@/mocks/contract-extensions";

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

/**
 * Reserva con seña desde la página pública. Devuelve `{ appointment, payment, mpInitPoint? }`.
 * orval tipa la respuesta como `void` (el contrato no la describe), así que la tipamos acá.
 */
export function useBookPublicWithDeposit(slug: string) {
  return useMutation({
    mutationFn: (data: BookWithDepositDto) =>
      customInstance<BookWithDepositResult>({
        url: `/r/${slug}/book-with-deposit`,
        method: "POST",
        data,
      }),
  });
}
