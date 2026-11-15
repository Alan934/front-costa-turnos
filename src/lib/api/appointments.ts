"use client";

import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customInstance } from "@/lib/api/axios-instance";
import type { Appointment } from "@/lib/api/generated/model/appointment";
import type { CancelAppointmentDto } from "@/lib/api/generated/model/cancelAppointmentDto";

export interface AppointmentsQuery {
  staffId?: string;
  from?: string;
  to?: string;
}

/**
 * Lista turnos por staff y rango (`from`/`to` = inicio del turno, ISO, inclusive; máx. 100
 * días). Pasá siempre el rango: sin él el back devuelve solo desde hace 24 h en adelante.
 */
export function appointmentsQueryOptions(params: AppointmentsQuery) {
  return {
    queryKey: ["appointments", params] as const,
    queryFn: ({ signal }: { signal?: AbortSignal }) =>
      customInstance<Appointment[]>({
        url: "/v1/appointments",
        method: "GET",
        params,
        signal,
      }),
  };
}

/**
 * Precarga el rango anterior y el siguiente al visible (día/semana/mes): al tocar las flechas la
 * agenda aparece al instante en vez de mostrar el esqueleto de carga.
 */
export function usePrefetchAppointments(ranges: AppointmentsQuery[]) {
  const qc = useQueryClient();
  const key = JSON.stringify(ranges);
  useEffect(() => {
    for (const params of JSON.parse(key) as AppointmentsQuery[]) {
      void qc.prefetchQuery({ ...appointmentsQueryOptions(params), staleTime: 30_000 });
    }
  }, [qc, key]);
}

export function useAppointments(params: AppointmentsQuery) {
  return useQuery({
    ...appointmentsQueryOptions(params),
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
