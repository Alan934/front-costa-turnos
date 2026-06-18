"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customInstance } from "@/lib/api/axios-instance";
import type { Subscription } from "@/lib/api/generated/model/subscription";
import type { SubscriptionPayment } from "@/lib/api/generated/model/subscriptionPayment";
import type { Payment } from "@/lib/api/generated/model/payment";
import type { CreatePreferenceDto } from "@/lib/api/generated/model/createPreferenceDto";
import type {
  CheckoutResponse,
  MpConnectResponse,
  MpOauthStatus,
  MpPreference,
} from "@/mocks/contract-extensions";

/**
 * Wrappers tipados para suscripción + pagos (MercadoPago). Varias respuestas del contrato
 * no tienen `schema` (devuelven `void`): checkout, connect, status y mp-preference. Acá las
 * tipamos de forma provisional (ver contract-extensions / API-GAPS).
 */

/* ---------- Suscripción del profesional ---------- */

export function useSubscription() {
  return useQuery({
    queryKey: ["subscription"],
    queryFn: ({ signal }) =>
      customInstance<Subscription>({ url: "/v1/subscription", method: "GET", signal }),
  });
}

export function useSubscriptionPayments() {
  return useQuery({
    queryKey: ["subscription-payments"],
    queryFn: ({ signal }) =>
      customInstance<SubscriptionPayment[]>({
        url: "/v1/subscription/payments",
        method: "GET",
        signal,
      }),
  });
}

/** Inicia el checkout de MercadoPago de la suscripción → `{ initPoint }`. */
export function useSubscriptionCheckout() {
  return useMutation({
    mutationFn: () =>
      customInstance<CheckoutResponse>({ url: "/v1/subscription/checkout", method: "POST" }),
  });
}

/* ---------- Conexión MercadoPago del profesional (OAuth) ---------- */

export function useMpStatus() {
  return useQuery({
    queryKey: ["mp-oauth-status"],
    queryFn: ({ signal }) =>
      customInstance<MpOauthStatus>({
        url: "/payments/mp/oauth/status",
        method: "GET",
        signal,
      }),
  });
}

/** Devuelve la URL a la que redirigir al profesional para autorizar MercadoPago. */
export function useMpConnect() {
  return useMutation({
    mutationFn: () =>
      customInstance<MpConnectResponse>({ url: "/payments/mp/oauth/connect", method: "GET" }),
  });
}

export function useMpDisconnect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      customInstance<void>({ url: "/payments/mp/oauth", method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mp-oauth-status"] }),
  });
}

/* ---------- Cobros (seña / turno) ---------- */

export function usePayments() {
  return useQuery({
    queryKey: ["payments"],
    queryFn: ({ signal }) =>
      customInstance<Payment[]>({ url: "/v1/payments", method: "GET", signal }),
  });
}

/** Marca un pago en efectivo como cobrado (sirve también para cobrar un pagaré). */
export function useMarkPaymentPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      customInstance<Payment>({ url: `/v1/payments/${id}/mark-paid`, method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["cash-closing"] });
    },
  });
}

/** Marca un pago en efectivo como pagaré (el cliente quedó debiendo; opcional `note`). */
export function useMarkPaymentDeferred() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      customInstance<Payment>({
        url: `/v1/payments/${id}/mark-deferred`,
        method: "POST",
        data: note ? { note } : {},
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["cash-closing"] });
    },
  });
}

/** Crea la preferencia MP de un pago pendiente → `{ initPoint }`. */
export function useCreatePaymentPreference() {
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: CreatePreferenceDto }) =>
      customInstance<MpPreference>({
        url: `/v1/payments/${id}/mp-preference`,
        method: "POST",
        data: data ?? {},
      }),
  });
}
