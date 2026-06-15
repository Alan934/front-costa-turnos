"use client";

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { customInstance } from "@/lib/api/axios-instance";
import {
  adminListProfessionals,
  adminListClients,
  adminListComercios,
  adminDeleteProfessional,
  adminRestoreProfessional,
  adminDeleteComercio,
  adminRestoreComercio,
  adminDeleteClient,
  adminRestoreClient,
} from "@/lib/api/generated/endpoints/admin/admin";
import type { Subscription } from "@/lib/api/generated/model/subscription";
import type { AdminMetrics } from "@/mocks/contract-extensions";

/** Endpoints de admin de plataforma (tag `admin` del contrato). */

/** Parámetros de paginado/búsqueda comunes a los listados de admin. */
export interface AdminListParams {
  /** Búsqueda libre (los tres endpoints buscan por nombre + campos propios). */
  q?: string;
  /** Página 1-based (default 1). */
  page?: number;
  /** Tamaño de página (default 20, máx 100). */
  pageSize?: number;
}

/**
 * GET /admin/professionals → sobre paginado `{ items, total, page, pageSize }`. Incluye
 * los eliminados (`item.professional.deletedAt`). `keepPreviousData` evita el parpadeo al
 * cambiar de página o tipear la búsqueda.
 */
export function useAdminProfessionals(params: AdminListParams = {}) {
  return useQuery({
    queryKey: ["admin-professionals", params],
    queryFn: ({ signal }) => adminListProfessionals(params, undefined, signal),
    placeholderData: keepPreviousData,
  });
}

/** GET /admin/clients → sobre paginado de clientes globales (`item.deletedAt` = eliminado). */
export function useAdminClients(params: AdminListParams = {}) {
  return useQuery({
    queryKey: ["admin-clients", params],
    queryFn: ({ signal }) => adminListClients(params, undefined, signal),
    placeholderData: keepPreviousData,
  });
}

/** GET /admin/comercios → sobre paginado de comercios (`item.comercio.deletedAt` = eliminado). */
export function useAdminComercios(params: AdminListParams = {}) {
  return useQuery({
    queryKey: ["admin-comercios", params],
    queryFn: ({ signal }) => adminListComercios(params, undefined, signal),
    placeholderData: keepPreviousData,
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

/**
 * Wrappers de borrado lógico restaurable (delegan en las funciones generadas por orval y
 * agregan la invalidación de la lista correspondiente). Todos responden 204 (sin body).
 * El borrado bloquea el login del actor; el restore lo reactiva. El historial de turnos/
 * pagos se conserva siempre.
 */

/** DELETE /admin/professionals/{id} — borra profesional + su agenda; bloquea su login. */
export function useDeleteProfessional() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminDeleteProfessional(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-professionals"] }),
  });
}

/** POST /admin/professionals/{id}/restore — restaura el profesional y reactiva su login. */
export function useRestoreProfessional() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminRestoreProfessional(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-professionals"] }),
  });
}

/** DELETE /admin/comercios/{id} — borra comercio + membresías; bloquea la cuenta comercial. */
export function useDeleteComercio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminDeleteComercio(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-comercios"] }),
  });
}

/** POST /admin/comercios/{id}/restore — restaura el comercio y reactiva su cuenta. */
export function useRestoreComercio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminRestoreComercio(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-comercios"] }),
  });
}

/**
 * DELETE /admin/clients/{id} — borra el vínculo cliente-profesional. Si la persona no es
 * cliente de nadie más, también se elimina su perfil global. `id` es el UUID del
 * `professional_client`, no el de la persona.
 */
export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminDeleteClient(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-clients"] }),
  });
}

/** POST /admin/clients/{id}/restore — restaura el cliente (y la persona si aplica). */
export function useRestoreClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminRestoreClient(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-clients"] }),
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
