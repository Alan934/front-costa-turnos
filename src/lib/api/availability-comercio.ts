"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customInstance } from "@/lib/api/axios-instance";
import type { ScheduleRule } from "@/lib/api/generated/model/scheduleRule";
import type { CreateScheduleRuleDto } from "@/lib/api/generated/model/createScheduleRuleDto";
import type { TimeOff } from "@/lib/api/generated/model/timeOff";
import type { CreateTimeOffDto } from "@/lib/api/generated/model/createTimeOffDto";

/**
 * Disponibilidad (horarios y bloqueos) scopeada a un comercio — Fase 2.
 * Endpoints `/v1/comercios/{comercioId}/availability/...`. A diferencia del modelo viejo
 * (por `staffId`), acá la regla cuelga de la MEMBRESÍA del profesional en ese comercio: el
 * back la resuelve desde el usuario logueado + comercioId, por eso la creación NO pide staffId.
 *
 * Hechas a mano (como `comercios.ts`) porque orval nombra estos endpoints de forma genérica.
 * Las queryKeys incluyen `comercioId` para no mezclar caché entre comercios.
 */

/* ---------- Reglas de horario ---------- */

export function useComercioSchedule(comercioId: string | undefined) {
  return useQuery({
    queryKey: ["comercio-schedule", comercioId],
    queryFn: ({ signal }) =>
      customInstance<ScheduleRule[]>({
        url: `/v1/comercios/${comercioId}/availability/schedule`,
        method: "GET",
        signal,
      }),
    enabled: !!comercioId,
  });
}

export function useCreateComercioScheduleRule(comercioId: string) {
  const qc = useQueryClient();
  return useMutation({
    // `serviceIds` es opcional: omitido/vacío = la regla aplica a todos los servicios.
    mutationFn: (data: CreateScheduleRuleDto) =>
      customInstance<ScheduleRule>({
        url: `/v1/comercios/${comercioId}/availability/schedule`,
        method: "POST",
        data,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comercio-schedule", comercioId] }),
  });
}

export function useDeleteComercioScheduleRule(comercioId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      customInstance({
        url: `/v1/comercios/${comercioId}/availability/schedule/${id}`,
        method: "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comercio-schedule", comercioId] }),
  });
}

/* ---------- Bloqueos / ausencias ---------- */

export function useComercioTimeOff(comercioId: string | undefined) {
  return useQuery({
    queryKey: ["comercio-time-off", comercioId],
    queryFn: ({ signal }) =>
      customInstance<TimeOff[]>({
        url: `/v1/comercios/${comercioId}/availability/time-off`,
        method: "GET",
        signal,
      }),
    enabled: !!comercioId,
  });
}

export function useCreateComercioTimeOff(comercioId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTimeOffDto) =>
      customInstance<TimeOff>({
        url: `/v1/comercios/${comercioId}/availability/time-off`,
        method: "POST",
        data,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comercio-time-off", comercioId] }),
  });
}

export function useDeleteComercioTimeOff(comercioId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      customInstance({
        url: `/v1/comercios/${comercioId}/availability/time-off/${id}`,
        method: "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comercio-time-off", comercioId] }),
  });
}
