"use client";

import { useQuery } from "@tanstack/react-query";
import { customInstance } from "@/lib/api/axios-instance";
import type { CashClosingDto } from "@/lib/api/generated/model/cashClosingDto";

export type CashClosingRange = "week" | "month";

/**
 * Cierre de caja del profesional (`GET /v1/cash-closing?range=`). Devuelve:
 * - `pendingCompletion`: turnos pasados sin marcar como atendidos.
 * - `pendingCash`: efectivo sin cobrar (pending o pagaré/deferred) con cliente, servicio, fecha y monto.
 * - `pendingCashCents`: total a cobrar.
 * - `collected`: { count, totalCents } cobrado en el período.
 *
 * Usamos un queryKey estable (`["cash-closing", range]`) para poder invalidarlo desde
 * mark-paid / mark-deferred / complete, en vez del key por-URL del hook generado.
 */
export function useCashClosing(range: CashClosingRange) {
  return useQuery({
    queryKey: ["cash-closing", range],
    queryFn: ({ signal }) =>
      customInstance<CashClosingDto>({
        url: "/v1/cash-closing",
        method: "GET",
        params: { range },
        signal,
      }),
  });
}
