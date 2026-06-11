"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customInstance } from "@/lib/api/axios-instance";
import type { Subscription } from "@/lib/api/generated/model/subscription";
import type { AdminProfessionalRow, AdminMetrics } from "@/mocks/contract-extensions";

/** Endpoints de admin de plataforma (tag `admin` del contrato). */

/** GET /admin/professionals → `[{ professional, subscription }]` (sin schema en el contrato). */
export function useAdminProfessionals() {
  return useQuery({
    queryKey: ["admin-professionals"],
    queryFn: ({ signal }) =>
      customInstance<AdminProfessionalRow[]>({
        url: "/v1/admin/professionals",
        method: "GET",
        signal,
      }),
  });
}

/** POST /admin/subscriptions/{professionalId}/mark-cash-paid → renueva 30 días. */
export function useMarkCashPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (professionalId: string) =>
      customInstance<Subscription>({
        url: `/v1/admin/subscriptions/${professionalId}/mark-cash-paid`,
        method: "POST",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-professionals"] }),
  });
}

/** POST /admin/professionals → crea cuenta + negocio + trial y manda el email de activación. */
export function useCreateProfessionalAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { email: string; businessName: string; slug: string }) =>
      customInstance({ url: "/v1/admin/professionals", method: "POST", data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-professionals"] }),
  });
}

/** POST /admin/accounts/{accountId}/block — suspende una cuenta. */
export function useBlockAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) =>
      customInstance({ url: `/v1/admin/accounts/${accountId}/block`, method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-professionals"] }),
  });
}

/** POST /admin/accounts/{accountId}/activate — reactiva una cuenta. */
export function useActivateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) =>
      customInstance({ url: `/v1/admin/accounts/${accountId}/activate`, method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-professionals"] }),
  });
}

/** Métricas de plataforma. El contrato no las expone (ver API-GAPS §2e): mock. */
export function useAdminMetrics() {
  return useQuery({
    queryKey: ["admin-metrics"],
    queryFn: ({ signal }) =>
      customInstance<AdminMetrics>({ url: "/v1/admin/metrics", method: "GET", signal }),
  });
}
