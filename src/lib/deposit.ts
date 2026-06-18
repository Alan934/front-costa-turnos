import type { Service } from "@/lib/api/generated/model/service";
import type { PaymentOption } from "@/lib/api/generated/model/paymentOption";
import { formatMoney } from "@/lib/format";

/** Opción de pago concreta a ofrecer al cliente al reservar. */
export type PayChoice = "deposit" | "full" | "cash" | "none";

export interface PayOption {
  choice: PayChoice;
  /** Texto del botón. */
  label: string;
  /** Monto a abonar (seña o total), o null si no se paga. */
  amountCents: number | null;
  /** Valor para `paymentOption` del back; null = sin pago o efectivo. */
  paymentOption: PaymentOption | null;
  /**
   * Cómo se reserva con esta opción:
   * - "online": seña/pago total por MercadoPago (`book-with-deposit`, method mercadopago).
   * - "cash": efectivo presencial, turno confirmado al instante (`book-with-deposit`, method cash, sin paymentOption).
   * - "free": reserva sin pagar (`book`); puede quedar provisional.
   */
  flow: "online" | "cash" | "free";
  /** Si requiere pago online (seña/total). Equivale a flow === "online". */
  requiresPayment: boolean;
}

type SvcFlags = Pick<
  Service,
  "priceCents" | "allowDeposit" | "allowFullPayment" | "allowNoPayment" | "allowCash" | "depositAmountCents"
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
      flow: "online",
      requiresPayment: true,
    });
  }
  if (s.allowFullPayment) {
    out.push({
      choice: "full",
      label: "Pagar el total",
      amountCents: s.priceCents,
      paymentOption: "full",
      flow: "online",
      requiresPayment: true,
    });
  }
  if (s.allowCash) {
    // Efectivo: precio completo (sin IVA), turno confirmado al instante; el cobro se recibe en persona.
    out.push({
      choice: "cash",
      label: "Pagar en efectivo",
      amountCents: s.priceCents,
      paymentOption: null,
      flow: "cash",
      requiresPayment: false,
    });
  }
  if (s.allowNoPayment) {
    out.push({
      choice: "none",
      label: "Reservar sin pagar",
      amountCents: null,
      paymentOption: null,
      flow: "free",
      requiresPayment: false,
    });
  }
  if (out.length === 0) {
    out.push({ choice: "none", label: "Reservar", amountCents: null, paymentOption: null, flow: "free", requiresPayment: false });
  }
  return out;
}

/** Resumen corto de qué pagos acepta un servicio (para la lista del profesional). */
export function paymentSummary(s: SvcFlags): string | null {
  const parts: string[] = [];
  if (hasDeposit(s)) parts.push(`Seña ${formatMoney(s.depositAmountCents!)}`);
  if (s.allowFullPayment) parts.push("Pago total");
  if (s.allowCash) parts.push("Efectivo");
  if (s.allowNoPayment) parts.push("Sin pago");
  return parts.length ? parts.join(" · ") : null;
}
