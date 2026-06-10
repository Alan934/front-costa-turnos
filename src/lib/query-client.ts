import { QueryClient } from "@tanstack/react-query";

/**
 * Crea un QueryClient con defaults sensatos para un panel de turnos:
 * datos frescos por poco tiempo, reintentos moderados, sin refetch agresivo.
 */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
