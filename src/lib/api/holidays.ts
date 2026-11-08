"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customInstance } from "@/lib/api/axios-instance";

/**
 * Feriados nacionales scopeados al profesional en un comercio.
 * Endpoints `/v1/comercios/{comercioId}/holidays`. El back sincroniza el catálogo desde una API
 * pública (cron mensual) y devuelve cada feriado con la decisión efectiva del profesional:
 * `works` sale de su excepción puntual si la hay, o del ajuste general (`worksHolidays`).
 *
 * Hechas a mano (como `availability-comercio.ts`). Las queryKeys incluyen `comercioId`.
 */

export interface MembershipHoliday {
  /** YYYY-MM-DD */
  date: string;
  name: string;
  /** inamovible | trasladable | puente | nolaborable */
  kind: string;
  /** true = el profesional trabaja ese feriado; false = la agenda queda bloqueada. */
  works: boolean;
  /** true si el profesional fijó una excepción puntual para esta fecha. */
  overridden: boolean;
}

/** Prefijo de las queryKeys de feriados: `[KEY, comercioId, from, to]`. */
export const HOLIDAYS_QUERY_KEY = "membership-holidays";
const KEY = HOLIDAYS_QUERY_KEY;

/** Feriados de un rango (YYYY-MM-DD, inclusive). Sin rango, el back devuelve el año actual. */
export function useMembershipHolidays(
  comercioId: string | undefined,
  range?: { from: string; to: string },
) {
  return useQuery({
    queryKey: [KEY, comercioId, range?.from ?? null, range?.to ?? null],
    queryFn: ({ signal }) =>
      customInstance<MembershipHoliday[]>({
        url: `/v1/comercios/${comercioId}/holidays`,
        method: "GET",
        params: range,
        signal,
      }),
    enabled: !!comercioId,
    // El catálogo cambia como mucho una vez al mes.
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fija si el profesional trabaja UN feriado puntual.
 *  - `works` distinto del ajuste general → guarda la excepción (PUT).
 *  - `works` igual al ajuste general → quita la excepción (DELETE): vuelve a seguir el general.
 */
export function useSetHolidayWorks(comercioId: string, generalWorksHolidays: boolean) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ date, works }: { date: string; works: boolean }) =>
      works === generalWorksHolidays
        ? customInstance<void>({
            url: `/v1/comercios/${comercioId}/holidays/${date}`,
            method: "DELETE",
          })
        : customInstance<void>({
            url: `/v1/comercios/${comercioId}/holidays/${date}`,
            method: "PUT",
            data: { works },
          }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY, comercioId] });
    },
    // Si falla, el listado vuelve a lo que dice el back (el checkbox no queda desfasado).
    onError: () => {
      qc.invalidateQueries({ queryKey: [KEY, comercioId] });
    },
  });
}
