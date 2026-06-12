import type { Service } from "@/lib/api/generated/model/service";
import type { PaymentOption } from "@/lib/api/generated/model/paymentOption";
import { formatMoney } from "@/lib/format";

/** Opción de pago concreta a ofrecer al cliente al reservar. */
export type PayChoice = "deposit" | "full" | "none";

export interface PayOption {
  choice: PayChoice;
  /** Texto del botón. */
  label: string;
  /** Monto a abonar (seña o total), o null si no se paga. */
  amountCents: number | null;
  /** Valor para `paymentOption` del back; null = sin pago (usa /book). */
  paymentOption: PaymentOption | null;
  /** Si requiere pago online (seña/total) o no (reserva libre). */
  requiresPayment: boolean;
}

type SvcFlags = Pick<
  Service,
  "priceCents" | "allowDeposit" | "allowFullPayment" | "allowNoPayment" | "depositAmountCents"
>;

const hasDeposit = (s: SvcFlags) => s.allowDeposit && (s.depositAmountCents ?? 0) > 0;

/**
 * Opciones de pago habilitadas para un servicio (según los flags del profesional).
 * El front renderiza solo estas. Si no hay ninguna, deja reservar sin pagar (fallback).
 */
export function getPaymentOptions(s: SvcFlags): PayOption[] {
  const out: PayOption[] = [];
  if (hasDeposit(s)) {
    out.push({
      choice: "deposit",
      label: "Pagar seña",
      amountCents: s.depositAmountCents ?? null,
      paymentOption: "deposit",
      requiresPayment: true,
    });
  }
  if (s.allowFullPayment) {
    out.push({
      choice: "full",
      label: "Pagar el total",
      amountCents: s.priceCents,
      paymentOption: "full",
      requiresPayment: true,
    });
  }
  if (s.allowNoPayment) {
    out.push({
      choice: "none",
      label: "Reservar sin pagar",
      amountCents: null,
      paymentOption: null,
      requiresPayment: false,
    });
  }
  if (out.length === 0) {
    out.push({ choice: "none", label: "Reservar", amountCents: null, paymentOption: null, requiresPayment: false });
  }
  return out;
}

/** Resumen corto de qué pagos acepta un servicio (para la lista del profesional). */
export function paymentSummary(s: SvcFlags): string | null {
  const parts: string[] = [];
  if (hasDeposit(s)) parts.push(`Seña ${formatMoney(s.depositAmountCents!)}`);
  if (s.allowFullPayment) parts.push("Pago total");
  if (s.allowNoPayment) parts.push("Sin pago");
  return parts.length ? parts.join(" · ") : null;
}
