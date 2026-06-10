"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customInstance } from "@/lib/api/axios-instance";
import type { Professional } from "@/lib/api/generated/model/professional";
import type { UpdateProfessionalDto } from "@/lib/api/generated/model/updateProfessionalDto";
import type { Subscription } from "@/lib/api/generated/model/subscription";

/** Datos del profesional propio (gap: sin hook GET generado — ver API-GAPS §1c). */
export function useProfessional() {
  return useQuery({
    queryKey: ["professional-me"],
    queryFn: ({ signal }) =>
      customInstance<Professional>({ url: "/v1/professionals/me", method: "GET", signal }),
  });
}

export function useUpdateProfessional() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateProfessionalDto & { publicPageSettings?: Record<string, unknown> }) =>
      customInstance<Professional>({ url: "/v1/professionals/me", method: "PATCH", data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["professional-me"] }),
  });
}

export function useSubscription() {
  return useQuery({
    queryKey: ["subscription"],
    queryFn: ({ signal }) =>
      customInstance<Subscription>({ url: "/v1/subscription", method: "GET", signal }),
  });
}
