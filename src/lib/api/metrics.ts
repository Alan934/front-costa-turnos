"use client";

import { useQuery } from "@tanstack/react-query";
import { customInstance } from "@/lib/api/axios-instance";
import type { MetricsOverview } from "@/mocks/contract-extensions";

/** Métricas agregadas. Endpoint provisional (ver API-GAPS §2). */
export function useMetrics(range: "week" | "month") {
  return useQuery({
    queryKey: ["metrics", range],
    queryFn: ({ signal }) =>
      customInstance<MetricsOverview>({
        url: "/v1/metrics/overview",
        method: "GET",
        params: { range },
        signal,
      }),
  });
}
