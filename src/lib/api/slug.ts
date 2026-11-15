import { useQuery } from "@tanstack/react-query";
import { customInstance } from "@/lib/api/axios-instance";

/** Respuesta de GET /v1/professionals/slug-availability. */
export interface SlugAvailability {
  slug: string;
  valid: boolean;
  available: boolean;
  suggestions: string[];
}

/**
 * Disponibilidad de un enlace público (mira profesionales y comercios). Pensado para
 * consultarse con el valor ya "debounceado" mientras la persona escribe.
 */
export function useSlugAvailability(slug: string) {
  return useQuery({
    queryKey: ["slug-availability", slug],
    queryFn: ({ signal }) =>
      customInstance<SlugAvailability>({
        url: "/v1/professionals/slug-availability",
        method: "GET",
        params: { slug },
        signal,
      }),
    enabled: slug.length > 1,
    staleTime: 15_000,
    retry: false,
  });
}
