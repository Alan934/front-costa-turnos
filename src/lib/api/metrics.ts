"use client";

import { useQuery } from "@tanstack/react-query";
import { customInstance } from "@/lib/api/axios-instance";
import type { MetricsOverviewDto } from "@/lib/api/generated/model/metricsOverviewDto";
import type { MetricsRange } from "@/lib/api/generated/model/metricsRange";

/** Métricas agregadas del negocio (`GET /v1/metrics/overview?range=`). */
export function useMetrics(range: MetricsRange) {
  return useQuery({
    queryKey: ["metrics", range],
    queryFn: ({ signal }) =>
      customInstance<MetricsOverviewDto>({
        url: "/v1/metrics/overview",
        method: "GET",
        params: { range },
        signal,
      }),
  });
}
