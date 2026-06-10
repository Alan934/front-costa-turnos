"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customInstance } from "@/lib/api/axios-instance";
import type { ClientNote } from "@/lib/api/generated/model/clientNote";
import type { FichaField } from "@/lib/api/generated/model/fichaField";
import type { EnrichedClient } from "@/mocks/contract-extensions";

/**
 * Wrappers tipados para clientes. Usamos `EnrichedClient` (con nombre/contacto) porque el
 * contrato no embebe los datos de la persona en ProfessionalClient (ver API-GAPS §2c).
 */

export function useClients(q?: string) {
  return useQuery({
    queryKey: ["clients", q ?? ""],
    queryFn: ({ signal }) =>
      customInstance<EnrichedClient[]>({
        url: "/clients",
        method: "GET",
        params: q ? { q } : undefined,
        signal,
      }),
  });
}

export function useClient(id: string) {
  return useQuery({
    queryKey: ["client", id],
    queryFn: ({ signal }) =>
      customInstance<EnrichedClient>({ url: `/clients/${id}`, method: "GET", signal }),
    enabled: !!id,
  });
}

export function useFichaFields() {
  return useQuery({
    queryKey: ["ficha-fields"],
    queryFn: ({ signal }) =>
      customInstance<FichaField[]>({ url: "/clients/ficha-fields", method: "GET", signal }),
  });
}

export function useClientNotes(id: string) {
  return useQuery({
    queryKey: ["client-notes", id],
    queryFn: ({ signal }) =>
      customInstance<ClientNote[]>({ url: `/clients/${id}/notes`, method: "GET", signal }),
    enabled: !!id,
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { fullName: string; email?: string; phone?: string }) =>
      customInstance<EnrichedClient>({ url: "/clients", method: "POST", data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });
}

export function useAddClientNote(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      customInstance<ClientNote>({
        url: `/clients/${clientId}/notes`,
        method: "POST",
        data: { body },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-notes", clientId] }),
  });
}

export function useUpdateFicha(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fichaValues: Record<string, unknown>) =>
      customInstance<EnrichedClient>({
        url: `/clients/${clientId}/ficha`,
        method: "PATCH",
        data: { fichaValues },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client", clientId] }),
  });
}

export function useArchiveClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      customInstance({ url: `/clients/${id}`, method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });
}
