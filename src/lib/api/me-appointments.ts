"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { customInstance } from "@/lib/api/axios-instance";
import type { MyAppointment } from "@/mocks/contract-extensions";

/** Turnos del cliente (cross-tenant). Endpoint provisional (ver API-GAPS §2d). */
export function useMyAppointments() {
  return useQuery({
    queryKey: ["my-appointments"],
    queryFn: ({ signal }) =>
      customInstance<MyAppointment[]>({ url: "/v1/me/appointments", method: "GET", signal }),
  });
}

export function useCancelMyAppointment() {
  return useMutation({
    mutationFn: (id: string) =>
      customInstance({ url: `/v1/me/appointments/${id}/cancel`, method: "POST" }),
  });
}
