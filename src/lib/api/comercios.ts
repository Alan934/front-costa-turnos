"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customInstance } from "@/lib/api/axios-instance";
import type { Comercio } from "@/lib/api/generated/model/comercio";
import type { ComercioInvitation } from "@/lib/api/generated/model/comercioInvitation";
import type {
  MembershipWithComercio,
  MembershipWithProfessional,
} from "@/mocks/contract-extensions";

/** Endpoints de comercios/membresías (Fase 1). */

/* ---------- Profesional (trabajador) ---------- */

/** Comercios donde trabajo (membresías propias, con el comercio embebido). */
export function useMyMemberships() {
  return useQuery({
    queryKey: ["my-memberships"],
    queryFn: ({ signal }) =>
      customInstance<MembershipWithComercio[]>({
        url: "/v1/comercios/memberships/mine",
        method: "GET",
        signal,
      }),
  });
}

/** Aceptar una invitación con su token (estando logueado como profesional). */
export function useAcceptInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) =>
      customInstance({ url: "/v1/comercios/invitations/accept", method: "POST", data: { token } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-memberships"] }),
  });
}

/* ---------- Comercial (dueño del comercio) ---------- */

/** Comercios que administro. */
export function useMyComercios() {
  return useQuery({
    queryKey: ["my-comercios"],
    queryFn: ({ signal }) =>
      customInstance<Comercio[]>({ url: "/v1/comercios/mine", method: "GET", signal }),
  });
}

export function useUpdateComercio(comercioId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name?: string; address?: string; timezone?: string }) =>
      customInstance<Comercio>({ url: `/v1/comercios/${comercioId}`, method: "PATCH", data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-comercios"] }),
  });
}

/** Roster del comercio (profesionales miembros). */
export function useComercioMembers(comercioId: string | undefined) {
  return useQuery({
    queryKey: ["comercio-members", comercioId],
    queryFn: ({ signal }) =>
      customInstance<MembershipWithProfessional[]>({
        url: `/v1/comercios/${comercioId}/members`,
        method: "GET",
        signal,
      }),
    enabled: !!comercioId,
  });
}

export function useComercioInvitations(comercioId: string | undefined) {
  return useQuery({
    queryKey: ["comercio-invitations", comercioId],
    queryFn: ({ signal }) =>
      customInstance<ComercioInvitation[]>({
        url: `/v1/comercios/${comercioId}/invitations`,
        method: "GET",
        signal,
      }),
    enabled: !!comercioId,
  });
}

export function useInviteToComercio(comercioId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (email: string) =>
      customInstance<ComercioInvitation>({
        url: `/v1/comercios/${comercioId}/invitations`,
        method: "POST",
        data: { email },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comercio-invitations", comercioId] }),
  });
}

export function useCancelInvitation(comercioId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) =>
      customInstance({
        url: `/v1/comercios/${comercioId}/invitations/${invitationId}`,
        method: "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comercio-invitations", comercioId] }),
  });
}
