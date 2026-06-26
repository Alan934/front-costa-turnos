"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { customInstance } from "@/lib/api/axios-instance";
import type { Appointment } from "@/lib/api/generated/model/appointment";
import type { CancelAppointmentDto } from "@/lib/api/generated/model/cancelAppointmentDto";

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
        url: "/v1/appointments",
        method: "GET",
        params,
        signal,
      }),
    // La agenda cambia sola cuando entran reservas online: refrescamos al volver a la
    // pestaña y cada 60 s mientras está visible (react-query pausa el polling en segundo plano).
    refetchOnWindowFocus: true,
    refetchInterval: 60 * 1000,
  });
}

/**
 * Cancela un turno. orval dejó de generar `useCancel` (su operationId `cancel` colisiona con
 * `me.cancel`), así que lo escribimos a mano. `POST /v1/appointments/{id}/cancel`.
 */
export function useCancelAppointment() {
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: CancelAppointmentDto }) =>
      customInstance<Appointment>({
        url: `/v1/appointments/${id}/cancel`,
        method: "POST",
        data: data ?? {},
      }),
  });
}
