"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { customInstance } from "@/lib/api/axios-instance";
import type { MetricsOverviewDto } from "@/lib/api/generated/model/metricsOverviewDto";
import type { MetricsRange } from "@/lib/api/generated/model/metricsRange";

/**
 * Métricas agregadas del negocio (`GET /v1/metrics/overview?range=&offset=`).
 * `offset` = cuántas semanas/meses hacia atrás (0 = el período en curso); `comercioId` = solo
 * lo que pasó en ese comercio (null = todos).
 */
export function useMetrics(range: MetricsRange, offset = 0, comercioId: string | null = null) {
  return useQuery({
    queryKey: ["metrics", range, offset, comercioId],
    queryFn: ({ signal }) =>
      customInstance<MetricsOverviewDto>({
        url: "/v1/metrics/overview",
        method: "GET",
        params: { range, offset, ...(comercioId ? { comercioId } : {}) },
        signal,
      }),
    // Al cambiar de período se sigue viendo el anterior mientras carga (sin parpadeo).
    placeholderData: keepPreviousData,
  });
}
