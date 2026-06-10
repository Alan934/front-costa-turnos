"use client";

import { useQuery } from "@tanstack/react-query";
import { customInstance } from "@/lib/api/axios-instance";
import type { Appointment } from "@/lib/api/generated/model/appointment";

/**
 * Lectura de un turno por id. orval no generó el hook GET para este endpoint
 * (ver API-GAPS §1c); usamos un wrapper tipado sobre customInstance.
 */
export function useAppointment(appointmentId: string) {
  return useQuery({
    queryKey: ["appointment", appointmentId],
    queryFn: ({ signal }) =>
      customInstance<Appointment>({
        url: `/appointments/${appointmentId}`,
        method: "GET",
        signal,
      }),
    enabled: !!appointmentId,
  });
}
