"use client";

import { useQuery } from "@tanstack/react-query";
import { customInstance } from "@/lib/api/axios-instance";
import type { Appointment } from "@/lib/api/generated/model/appointment";

export interface AppointmentsQuery {
  staffId?: string;
  from?: string;
  to?: string;
}

/**
 * Lista turnos por staff y rango. `from`/`to` son una extensión del front sobre el
 * contrato (ver API-GAPS §2b); el mock ya los respeta.
 */
export function useAppointments(params: AppointmentsQuery) {
  return useQuery({
    queryKey: ["appointments", params],
    queryFn: ({ signal }) =>
      customInstance<Appointment[]>({
        url: "/appointments",
        method: "GET",
        params,
        signal,
      }),
  });
}
