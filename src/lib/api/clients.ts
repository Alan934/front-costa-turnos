"use client";

import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customInstance } from "@/lib/api/axios-instance";
import { personDisplayName } from "@/lib/agenda";
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
        url: "/v1/clients",
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
      customInstance<EnrichedClient>({ url: `/v1/clients/${id}`, method: "GET", signal }),
    enabled: !!id,
  });
}

/** Datos legibles de la persona de un turno, para mostrarle al profesional en la agenda. */
export interface PersonInfo {
  /** Nombre y apellido reales del cliente (o un fallback derivado del id). */
  name: string;
  /** Id del cliente del profesional, si existe (para enlazar a su ficha). */
  clientId?: string;
  phone?: string;
  email?: string;
}

/**
 * Resuelve el `personId` de un turno a datos humanos (nombre, teléfono, email). El contrato
 * no embebe los datos de la persona en Appointment (ver API-GAPS §2c), así que cruzamos con
 * la lista de clientes del profesional. Si la persona no está en la lista (turno de alguien
 * que aún no es cliente), caemos al nombre derivado del id (`personDisplayName`).
 *
 * Devuelve una función estable para usar en cualquier vista de la agenda.
 */
export function usePersonLookup() {
  const { data: clients } = useClients();
  return useMemo(() => {
    const byPerson = new Map<string, EnrichedClient>();
    for (const c of clients ?? []) byPerson.set(c.personId, c);
    return (personId: string): PersonInfo => {
      const c = byPerson.get(personId);
      return {
        name: c?.fullName?.trim() || personDisplayName(personId),
        clientId: c?.id,
        phone: c?.phone ?? undefined,
        email: c?.email ?? undefined,
      };
    };
  }, [clients]);
}

export function useFichaFields() {
  return useQuery({
    queryKey: ["ficha-fields"],
    queryFn: ({ signal }) =>
      customInstance<FichaField[]>({ url: "/v1/clients/ficha-fields", method: "GET", signal }),
  });
}

export function useClientNotes(id: string) {
  return useQuery({
    queryKey: ["client-notes", id],
    queryFn: ({ signal }) =>
      customInstance<ClientNote[]>({ url: `/v1/clients/${id}/notes`, method: "GET", signal }),
    enabled: !!id,
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { fullName: string; email?: string; phone?: string }) =>
      customInstance<EnrichedClient>({ url: "/v1/clients", method: "POST", data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });
}

export function useAddClientNote(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      customInstance<ClientNote>({
        url: `/v1/clients/${clientId}/notes`,
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
        url: `/v1/clients/${clientId}/ficha`,
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
      customInstance({ url: `/v1/clients/${id}`, method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });
}
