import type { Service } from "@/lib/api/generated/model/service";
import type { ServicePricing } from "@/lib/api/generated/model/servicePricing";
import type { ServicePriceBreakdown } from "@/lib/api/generated/model/servicePriceBreakdown";
import type { PaymentOption } from "@/lib/api/generated/model/paymentOption";
import { formatMoney } from "@/lib/format";

/** Opción de pago concreta a ofrecer al cliente al reservar. */
export type PayChoice = "deposit" | "full" | "cash" | "transfer" | "none";

/** Desglose de IVA de una opción que se cobra por Mercado Pago. */
export interface PayBreakdown {
  baseCents: number;
  vatAmountCents: number;
  totalCents: number;
  vatPercent: number;
  vatChargedToClient: boolean;
}

export interface PayOption {
  choice: PayChoice;
  /** Texto del botón. */
  label: string;
  /** Monto a abonar (seña o total), o null si no se paga. */
  amountCents: number | null;
  /** Valor para `paymentOption` del back; null = sin pago, efectivo o transferencia. */
  paymentOption: PaymentOption | null;
  /**
   * Cómo se reserva con esta opción:
   * - "online": seña/pago total por MercadoPago (`book-with-deposit`, method mercadopago). Incluye IVA.
   * - "cash": efectivo presencial, turno confirmado al instante (`book-with-deposit`, method cash). Sin IVA.
   * - "transfer": transferencia/QR presencial, igual que efectivo (`book-with-deposit`, method transfer). Sin IVA.
   * - "free": reserva sin pagar (`book`); puede quedar provisional.
   */
  flow: "online" | "cash" | "transfer" | "free";
  /** Si requiere pago online (seña/total). Equivale a flow === "online". */
  requiresPayment: boolean;
  /** Desglose de IVA, solo en opciones online (MP). El IVA no aplica a efectivo/transferencia. */
  breakdown: PayBreakdown | null;
}

type SvcFlags = Pick<
  Service,
  | "priceCents"
  | "allowDeposit"
  | "allowFullPayment"
  | "allowNoPayment"
  | "allowCash"
  | "allowTransfer"
  | "depositAmountCents"
> & {
  /** Precios con/sin IVA calculados por el back. Si falta, se usa priceCents/depositAmountCents (sin IVA). */
  pricing?: ServicePricing | null;
};

const hasDeposit = (s: SvcFlags) => s.allowDeposit && (s.depositAmountCents ?? 0) > 0;

/** Precio base (sin IVA) del servicio: el que cargó el profesional. */
export function baseCents(s: SvcFlags): number {
  return s.pricing?.full.baseCents ?? s.priceCents;
}

/** Arma el desglose de IVA a partir del breakdown del back (o sin IVA si no hay pricing). */
function toBreakdown(b: ServicePriceBreakdown | null | undefined, pricing: ServicePricing | null | undefined): PayBreakdown | null {
  if (!b || !pricing) return null;
  return {
    baseCents: b.baseCents,
    vatAmountCents: b.vatAmountCents,
    totalCents: b.totalCents,
    vatPercent: pricing.vatPercent,
    vatChargedToClient: pricing.vatChargedToClient,
  };
}

/**
 * Opciones de pago habilitadas para un servicio (según los flags del profesional).
 * El front renderiza solo estas. Si no hay ninguna, deja reservar sin pagar (fallback).
 *
 * Montos: las opciones por Mercado Pago (seña/total) cobran el total CON IVA (`pricing.*.totalCents`);
 * efectivo y transferencia cobran el precio base SIN IVA.
 */
export function getPaymentOptions(s: SvcFlags): PayOption[] {
  const out: PayOption[] = [];
  const base = baseCents(s);
  if (hasDeposit(s)) {
    const depositTotal = s.pricing?.deposit?.totalCents ?? s.depositAmountCents ?? null;
    out.push({
      choice: "deposit",
      label: "Pagar seña",
      amountCents: depositTotal,
      paymentOption: "deposit",
      flow: "online",
      requiresPayment: true,
      breakdown: toBreakdown(s.pricing?.deposit, s.pricing),
    });
  }
  if (s.allowFullPayment) {
    out.push({
      choice: "full",
      label: "Pagar el total",
      amountCents: s.pricing?.full.totalCents ?? base,
      paymentOption: "full",
      flow: "online",
      requiresPayment: true,
      breakdown: toBreakdown(s.pricing?.full, s.pricing),
    });
  }
  if (s.allowCash) {
    // Efectivo: precio base (sin IVA), turno confirmado al instante; el cobro se recibe en persona.
    out.push({
      choice: "cash",
      label: "Pagar en efectivo",
      amountCents: base,
      paymentOption: null,
      flow: "cash",
      requiresPayment: false,
      breakdown: null,
    });
  }
  if (s.allowTransfer) {
    // Transferencia / QR: igual que efectivo (precio base sin IVA), confirmado al instante.
    out.push({
      choice: "transfer",
      label: "Pagar por transferencia",
      amountCents: base,
      paymentOption: null,
      flow: "transfer",
      requiresPayment: false,
      breakdown: null,
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
      breakdown: null,
    });
  }
  if (out.length === 0) {
    out.push({
      choice: "none",
      label: "Reservar",
      amountCents: null,
      paymentOption: null,
      flow: "free",
      requiresPayment: false,
      breakdown: null,
    });
  }
  return out;
}

/** Resumen corto de qué pagos acepta un servicio (para la lista del profesional). */
export function paymentSummary(s: SvcFlags): string | null {
  const parts: string[] = [];
  if (hasDeposit(s)) parts.push(`Seña ${formatMoney(s.depositAmountCents!)}`);
  if (s.allowFullPayment) parts.push("Pago total");
  if (s.allowCash) parts.push("Efectivo");
  if (s.allowTransfer) parts.push("Transferencia");
  if (s.allowNoPayment) parts.push("Sin pago");
  return parts.length ? parts.join(" · ") : null;
}
