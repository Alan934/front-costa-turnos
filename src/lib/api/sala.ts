"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customInstance } from "@/lib/api/axios-instance";
import type { ChargeSummaryDto } from "@/lib/api/generated/model/chargeSummaryDto";
import type { ChargeQrDto } from "@/lib/api/generated/model/chargeQrDto";
import type { ChargePaymentDto } from "@/lib/api/generated/model/chargePaymentDto";
import type { PaymentAuditEntryDto } from "@/lib/api/generated/model/paymentAuditEntryDto";
import type { WaitingRoomStatsDto } from "@/lib/api/generated/model/waitingRoomStatsDto";
import type { LeaveResultDto } from "@/lib/api/generated/model/leaveResultDto";
import type { PushPublicKeyDto } from "@/lib/api/generated/model/pushPublicKeyDto";

/* ---------- Cobro de un turno ---------- */

const chargeKey = (appointmentId: string) => ["charge", appointmentId] as const;

/**
 * Cuánto vale el turno, cuánto se cobró y cuánto falta. `pollMs` lo usa el QR de Mercado Pago
 * para enterarse de cuándo se acredita el pago (el webhook no empuja nada al navegador).
 */
export function useChargeSummary(appointmentId: string, opts: { pollMs?: number | false } = {}) {
  return useQuery({
    queryKey: chargeKey(appointmentId),
    queryFn: ({ signal }) =>
      customInstance<ChargeSummaryDto>({
        url: `/v1/payments/appointment/${appointmentId}/charge`,
        method: "GET",
        signal,
      }),
    enabled: !!appointmentId,
    refetchInterval: opts.pollMs ?? false,
  });
}

function useChargeMutation<TVars, TRes>(
  appointmentId: string,
  fn: (vars: TVars) => Promise<TRes>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: chargeKey(appointmentId) });
      // Los cobros pendientes/pagarés también viven en el cierre de caja y en métricas.
      void qc.invalidateQueries({ queryKey: ["cash-closing"] });
      void qc.invalidateQueries({ queryKey: ["payments"] });
    },
  });
}

export function useChargeQr(appointmentId: string) {
  return useChargeMutation(appointmentId, () =>
    customInstance<ChargeQrDto>({
      url: `/v1/payments/appointment/${appointmentId}/charge/qr`,
      method: "POST",
    }),
  );
}

export function useChargePaid(appointmentId: string) {
  return useChargeMutation(appointmentId, (data: { method: "cash" | "transfer"; note?: string }) =>
    customInstance<ChargeSummaryDto>({
      url: `/v1/payments/appointment/${appointmentId}/charge/paid`,
      method: "POST",
      data,
    }),
  );
}

export function useChargeDeferred(appointmentId: string) {
  return useChargeMutation(appointmentId, (data: { note?: string }) =>
    customInstance<ChargeSummaryDto>({
      url: `/v1/payments/appointment/${appointmentId}/charge/deferred`,
      method: "POST",
      data,
    }),
  );
}

export function useRevertPayment(appointmentId: string) {
  return useChargeMutation(appointmentId, (vars: { paymentId: string; reason: string }) =>
    customInstance<ChargePaymentDto>({
      url: `/v1/payments/${vars.paymentId}/revert`,
      method: "POST",
      data: { reason: vars.reason },
    }),
  );
}

export function usePaymentAudit(paymentId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["payment-audit", paymentId],
    queryFn: ({ signal }) =>
      customInstance<PaymentAuditEntryDto[]>({
        url: `/v1/payments/${paymentId}/audit`,
        method: "GET",
        signal,
      }),
    enabled: enabled && !!paymentId,
  });
}

/* ---------- Estadísticas ---------- */

export function useWaitingStats(staffId: string, days: number, enabled = true) {
  return useQuery({
    queryKey: ["waiting-stats", staffId, days],
    queryFn: ({ signal }) =>
      customInstance<WaitingRoomStatsDto>({
        url: `/v1/appointments/waiting-room/${staffId}/stats`,
        method: "GET",
        params: { days },
        signal,
      }),
    enabled: enabled && !!staffId,
  });
}

/* ---------- Web Push ---------- */

export function usePushPublicKey() {
  return useQuery({
    queryKey: ["push-public-key"],
    queryFn: ({ signal }) =>
      customInstance<PushPublicKeyDto>({ url: "/push/public-key", method: "GET", signal }),
    staleTime: Infinity,
  });
}

/** Suscribe este navegador a los avisos de la cuenta del profesional ("se anotó alguien"). */
export function useSubscribeProPush() {
  return useMutation({
    mutationFn: (subscription: PushSubscriptionJSON) =>
      customInstance<void>({ url: "/push/subscribe", method: "POST", data: subscription }),
  });
}

/* ---------- Acciones del cliente por el token de su link ---------- */

/** Invalida "mi lugar" tras cualquier acción, para que la pantalla refleje el cambio ya. */
function useSpotAction<TVars, TRes>(token: string, fn: (vars: TVars) => Promise<TRes>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["waiting-spot", token] }),
  });
}

export function useLeaveQueue(token: string) {
  return useSpotAction<void, LeaveResultDto>(token, () =>
    customInstance<LeaveResultDto>({ url: `/sala/t/${token}/leave`, method: "POST" }),
  );
}

export function useAwayFromQueue(token: string) {
  return useSpotAction(token, (minutes: number) =>
    customInstance<void>({ url: `/sala/t/${token}/away`, method: "POST", data: { minutes } }),
  );
}

export function useBackToQueue(token: string) {
  return useSpotAction<void, void>(token, () =>
    customInstance<void>({ url: `/sala/t/${token}/back`, method: "POST" }),
  );
}

export function useSubscribeSpotPush(token: string) {
  return useSpotAction(token, (subscription: PushSubscriptionJSON) =>
    customInstance<void>({ url: `/sala/t/${token}/push`, method: "POST", data: subscription }),
  );
}

export function useUnsubscribeSpotPush(token: string) {
  return useSpotAction<void, void>(token, () =>
    customInstance<void>({ url: `/sala/t/${token}/push/unsubscribe`, method: "POST" }),
  );
}
