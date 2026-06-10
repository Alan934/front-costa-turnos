import { DepositMode } from "@/lib/api/generated/model/depositMode";
import type { Service } from "@/lib/api/generated/model/service";
import { formatMoney } from "@/lib/format";

/** Describe el modo de seña de un servicio para mostrar al cliente. */
export interface DepositInfo {
  mode: DepositMode;
  /** Requiere pago para confirmar (required). */
  requiresPayment: boolean;
  /** Permite pagar para asegurar, pero no obliga (hybrid). */
  isHybrid: boolean;
  amountCents: number | null;
  label: string | null;
}

export function getDepositInfo(service: Pick<Service, "depositMode" | "depositAmountCents">): DepositInfo {
  const amount = service.depositAmountCents ?? null;
  switch (service.depositMode) {
    case DepositMode.required:
      return {
        mode: service.depositMode,
        requiresPayment: true,
        isHybrid: false,
        amountCents: amount,
        label: amount ? `Seña de ${formatMoney(amount)} para reservar` : "Requiere seña",
      };
    case DepositMode.hybrid:
      return {
        mode: service.depositMode,
        requiresPayment: false,
        isHybrid: true,
        amountCents: amount,
        label: amount ? `Asegurá tu turno con ${formatMoney(amount)}` : "Seña opcional",
      };
    default:
      return {
        mode: DepositMode.none,
        requiresPayment: false,
        isHybrid: false,
        amountCents: null,
        label: null,
      };
  }
}
