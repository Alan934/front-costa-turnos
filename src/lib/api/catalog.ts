"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customInstance } from "@/lib/api/axios-instance";
import type { Service } from "@/lib/api/generated/model/service";
import type { CreateServiceDto } from "@/lib/api/generated/model/createServiceDto";
import type { UpdateServiceDto } from "@/lib/api/generated/model/updateServiceDto";

/**
 * Wrappers tipados para el catálogo de servicios. orval no generó los hooks GET/POST de
 * `/services` (operationId `list`/`create` colisionan — ver API-GAPS §1c).
 */
export function useServices() {
  return useQuery({
    queryKey: ["services"],
    queryFn: ({ signal }) =>
      customInstance<Service[]>({ url: "/services", method: "GET", signal }),
  });
}

export function useCreateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateServiceDto) =>
      customInstance<Service>({ url: "/services", method: "POST", data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["services"] }),
  });
}

export function useUpdateService(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateServiceDto) =>
      customInstance<Service>({ url: `/services/${id}`, method: "PATCH", data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["services"] }),
  });
}

export function useDeactivateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      customInstance({ url: `/services/${id}`, method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["services"] }),
  });
}
