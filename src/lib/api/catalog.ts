"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customInstance } from "@/lib/api/axios-instance";
import type { Service } from "@/lib/api/generated/model/service";
import type { CreateServiceDto } from "@/lib/api/generated/model/createServiceDto";
import type { UpdateServiceDto } from "@/lib/api/generated/model/updateServiceDto";
import type { ServiceCombinationRule } from "@/lib/api/generated/model/serviceCombinationRule";
import type { CreateCombinationRuleDto } from "@/lib/api/generated/model/createCombinationRuleDto";

/**
 * Wrappers tipados para el catálogo de servicios. orval no generó los hooks GET/POST de
 * `/services` (operationId `list`/`create` colisionan — ver API-GAPS §1c).
 */
export function useServices() {
  return useQuery({
    queryKey: ["services"],
    queryFn: ({ signal }) =>
      customInstance<Service[]>({ url: "/v1/services", method: "GET", signal }),
  });
}

export function useCreateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateServiceDto) =>
      customInstance<Service>({ url: "/v1/services", method: "POST", data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["services"] }),
  });
}

export function useUpdateService(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateServiceDto) =>
      customInstance<Service>({ url: `/v1/services/${id}`, method: "PATCH", data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["services"] }),
  });
}

export function useDeactivateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      customInstance({ url: `/v1/services/${id}`, method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["services"] }),
  });
}

/* ---------- Servicios por comercio (Fase 2) ---------- */

/**
 * Variantes scopeadas a un comercio (membresía del profesional en ese comercio).
 * Misma forma que las de arriba pero contra `/v1/comercios/{comercioId}/services`. La
 * queryKey incluye el `comercioId` para no mezclar la caché entre comercios.
 *
 * Hechas a mano (como `comercios.ts`) porque orval nombra estos endpoints de forma genérica
 * (`listInComercio`, `createInComercio`, …) y preferimos no acoplarnos a esos nombres.
 */
export function useComercioServices(comercioId: string | undefined) {
  return useQuery({
    queryKey: ["comercio-services", comercioId],
    queryFn: ({ signal }) =>
      customInstance<Service[]>({
        url: `/v1/comercios/${comercioId}/services`,
        method: "GET",
        signal,
      }),
    enabled: !!comercioId,
  });
}

export function useCreateComercioService(comercioId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateServiceDto) =>
      customInstance<Service>({
        url: `/v1/comercios/${comercioId}/services`,
        method: "POST",
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comercio-services", comercioId] });
      qc.invalidateQueries({ queryKey: ["services"] });
    },
  });
}

export function useUpdateComercioService(comercioId: string, id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateServiceDto) =>
      customInstance<Service>({
        url: `/v1/comercios/${comercioId}/services/${id}`,
        method: "PATCH",
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comercio-services", comercioId] });
      qc.invalidateQueries({ queryKey: ["services"] });
    },
  });
}

export function useDeactivateComercioService(comercioId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      customInstance({
        url: `/v1/comercios/${comercioId}/services/${id}`,
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comercio-services", comercioId] });
      qc.invalidateQueries({ queryKey: ["services"] });
    },
  });
}

/* ---------- Reglas de combinación de servicios (F7) ---------- */

export function useCombinationRules(comercioId: string | undefined) {
  return useQuery({
    queryKey: ["combination-rules", comercioId],
    queryFn: ({ signal }) =>
      customInstance<ServiceCombinationRule[]>({
        url: `/v1/comercios/${comercioId}/services/combination-rules`,
        method: "GET",
        signal,
      }),
    enabled: !!comercioId,
  });
}

export function useCreateCombinationRule(comercioId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCombinationRuleDto) =>
      customInstance<ServiceCombinationRule>({
        url: `/v1/comercios/${comercioId}/services/combination-rules`,
        method: "POST",
        data,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["combination-rules", comercioId] }),
  });
}

export function useDeleteCombinationRule(comercioId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ruleId: string) =>
      customInstance({
        url: `/v1/comercios/${comercioId}/services/combination-rules/${ruleId}`,
        method: "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["combination-rules", comercioId] }),
  });
}
