"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customInstance } from "@/lib/api/axios-instance";
import type { AdminProfessional, AdminMetrics } from "@/mocks/contract-extensions";

/** Endpoints de admin de plataforma. Provisionales (ver API-GAPS §2e). */

export function useAdminProfessionals() {
  return useQuery({
    queryKey: ["admin-professionals"],
    queryFn: ({ signal }) =>
      customInstance<AdminProfessional[]>({ url: "/admin/professionals", method: "GET", signal }),
  });
}

export function useCreateProfessional() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { businessName: string; ownerName: string; ownerEmail: string }) =>
      customInstance<AdminProfessional>({ url: "/admin/professionals", method: "POST", data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-professionals"] }),
  });
}

export function useToggleProfessionalBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, block }: { id: string; block: boolean }) =>
      customInstance<AdminProfessional>({
        url: `/admin/professionals/${id}/${block ? "block" : "activate"}`,
        method: "POST",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-professionals"] }),
  });
}

export function useAdminMetrics() {
  return useQuery({
    queryKey: ["admin-metrics"],
    queryFn: ({ signal }) =>
      customInstance<AdminMetrics>({ url: "/admin/metrics", method: "GET", signal }),
  });
}
