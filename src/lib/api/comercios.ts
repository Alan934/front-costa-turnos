"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customInstance } from "@/lib/api/axios-instance";
import type { Comercio } from "@/lib/api/generated/model/comercio";
import type { ComercioInvitation } from "@/lib/api/generated/model/comercioInvitation";
import type { Membership } from "@/lib/api/generated/model/membership";
import type { UpdateMembershipDto } from "@/lib/api/generated/model/updateMembershipDto";
import type { InvitationPreviewDto } from "@/lib/api/generated/model/invitationPreviewDto";
import type {
  MembershipWithComercio,
  MembershipWithProfessional,
} from "@/mocks/contract-extensions";
import type { AxiosError } from "axios";

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

/**
 * Vista previa pública de una invitación por token (no requiere sesión). La landing del
 * email la usa para guiar al profesional a registrarse o ingresar y pre-cargar el email.
 * Token inexistente/expirado/cancelado → 404/410: no reintentamos.
 */
export function useInvitationPreview(token: string | null) {
  return useQuery({
    queryKey: ["invitation-preview", token],
    queryFn: ({ signal }) =>
      customInstance<InvitationPreviewDto>({
        url: `/v1/comercios/invitations/preview?token=${encodeURIComponent(token ?? "")}`,
        method: "GET",
        signal,
      }),
    enabled: !!token,
    retry: (count, err) => {
      const status = (err as AxiosError).response?.status;
      // Token inválido/expirado o endpoint inexistente: no insistir.
      if (status === 404 || status === 410 || status === 400 || status === 405) return false;
      return count < 2;
    },
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

/**
 * Editar la membresía propia en un comercio (Fase 3). Campos:
 * - `address`: ubicación propia (texto = dónde atiende; `null`/`""` = usa la del comercio).
 * - `minBookingHours`: anticipación mínima de reserva en horas (0 = sin restricción).
 * - `maxBookingDays`: ventana máxima de reserva en días (0 = sin límite).
 * - `allowProvisionalBookings`: si true, un turno sin seña queda provisional/desplazable (default false).
 * El back filtra los slots y rechaza reservas fuera de la ventana (400). Se refleja en la página pública.
 */
export function useUpdateMyMembership(comercioId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateMembershipDto) =>
      customInstance<Membership>({
        url: `/v1/comercios/${comercioId}/membership`,
        method: "PATCH",
        data,
      }),
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
