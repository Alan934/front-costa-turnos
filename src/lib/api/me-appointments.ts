"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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

/** Datos extra que el back agrega a `MyAppointmentDto` (link personal para gestionar el turno). */
export type ManagedAppointment = MyAppointmentDto & { manageToken?: string | null };

/**
 * Un turno por su link personal (/turno/:token): sin sesión, el token es la credencial.
 * Lo usa quien reservó como invitado y llega desde el email de confirmación.
 */
export function useAppointmentByToken(token: string) {
  return useQuery({
    queryKey: ["appointment-by-token", token],
    queryFn: ({ signal }) =>
      customInstance<ManagedAppointment>({ url: `/turno/${token}`, method: "GET", signal }),
    retry: false,
    refetchOnWindowFocus: true,
  });
}

/**
 * Cancelar un turno. Con `manageToken` usa el link personal (sin cuenta); sin él, la sesión.
 */
export function useCancelMyAppointment(manageToken?: string | null) {
  return useMutation({
    mutationFn: (id: string) =>
      customInstance({
        url: manageToken ? `/turno/${manageToken}/cancel` : `/v1/me/appointments/${id}/cancel`,
        method: "POST",
      }),
  });
}

/** "Confirmo que voy" desde el link personal (pedido de confirmación del día anterior). */
export function useConfirmByToken(manageToken: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      customInstance<ManagedAppointment>({ url: `/turno/${manageToken}/confirm`, method: "POST" }),
    // A nivel hook (no en cada mutate): se refresca el turno aunque el componente se remonte.
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointment-by-token", manageToken] }),
  });
}

/** "No puedo ir": cancela y libera el horario (si el negocio pide confirmación, sin plazo). */
export function useDeclineByToken(manageToken: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      customInstance<ManagedAppointment>({ url: `/turno/${manageToken}/decline`, method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointment-by-token", manageToken] }),
  });
}

/** Reprogramar un turno (mismo criterio que cancelar: token del link personal o sesión). */
export function useRescheduleMyAppointment(manageToken?: string | null) {
  return useMutation({
    mutationFn: ({ id, startAt }: { id: string } & RescheduleMyAppointmentDto) =>
      customInstance({
        url: manageToken
          ? `/turno/${manageToken}/reschedule`
          : `/v1/me/appointments/${id}/reschedule`,
        method: "POST",
        data: { startAt } satisfies RescheduleMyAppointmentDto,
      }),
  });
}
