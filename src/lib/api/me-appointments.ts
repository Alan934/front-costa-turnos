"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { customInstance } from "@/lib/api/axios-instance";
import type { MyAppointmentDto } from "@/lib/api/generated/model/myAppointmentDto";
import type { RescheduleMyAppointmentDto } from "@/lib/api/generated/model/rescheduleMyAppointmentDto";

/** Turnos del cliente (cross-tenant), tipado por el contrato (`MyAppointmentDto`). */
export function useMyAppointments() {
  return useQuery({
    queryKey: ["my-appointments"],
    queryFn: ({ signal }) =>
      customInstance<MyAppointmentDto[]>({ url: "/v1/me/appointments", method: "GET", signal }),
    // El estado del turno cambia del lado del negocio (confirmación, reprogramación): refrescamos
    // al volver a la pestaña y cada 60 s mientras está visible (el polling se pausa en segundo plano).
    refetchOnWindowFocus: true,
    refetchInterval: 60 * 1000,
  });
}

export function useCancelMyAppointment() {
  return useMutation({
    mutationFn: (id: string) =>
      customInstance({ url: `/v1/me/appointments/${id}/cancel`, method: "POST" }),
  });
}

export function useRescheduleMyAppointment() {
  return useMutation({
    mutationFn: ({ id, startAt }: { id: string } & RescheduleMyAppointmentDto) =>
      customInstance({
        url: `/v1/me/appointments/${id}/reschedule`,
        method: "POST",
        data: { startAt } satisfies RescheduleMyAppointmentDto,
      }),
  });
}
