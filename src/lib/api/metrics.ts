"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { customInstance } from "@/lib/api/axios-instance";
import type { MetricsOverviewDto } from "@/lib/api/generated/model/metricsOverviewDto";
import type { MetricsRange } from "@/lib/api/generated/model/metricsRange";

/**
 * Métricas agregadas del negocio (`GET /v1/metrics/overview?range=&offset=`).
 * `offset` = cuántas semanas/meses hacia atrás (0 = el período en curso).
 */
export function useMetrics(range: MetricsRange, offset = 0) {
  return useQuery({
    queryKey: ["metrics", range, offset],
    queryFn: ({ signal }) =>
      customInstance<MetricsOverviewDto>({
        url: "/v1/metrics/overview",
        method: "GET",
        params: { range, offset },
        signal,
      }),
    // Al cambiar de período se sigue viendo el anterior mientras carga (sin parpadeo).
    placeholderData: keepPreviousData,
  });
}
