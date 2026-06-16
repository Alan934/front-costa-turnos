/**
 * Normaliza el estado que devuelve MercadoPago al volver del checkout.
 *
 * MP anexa a la back_url varios parámetros según cómo se arme la preferencia:
 * `?status=` / `?collection_status=` (lo habitual) y a veces `?payment=` / `?mp=`.
 * Tomamos el primero que aparezca y lo mapeamos a un set chico de estados de UI.
 */
export type PayResult = "approved" | "pending" | "rejected";

export function readPaymentResult(value: string | null | undefined): PayResult | null {
  if (!value) return null;
  const v = value.toLowerCase();
  if (["approved", "success", "paid", "ok"].includes(v)) return "approved";
  if (["pending", "in_process", "in_progress"].includes(v)) return "pending";
  if (["rejected", "failure", "failed", "error", "cancelled", "null"].includes(v)) return "rejected";
  return null;
}

/** Lee el resultado deserializando los nombres de parámetro habituales de MP. */
export function readPaymentResultFromParams(params: URLSearchParams): PayResult | null {
  return readPaymentResult(
    params.get("status") ??
      params.get("collection_status") ??
      params.get("payment") ??
      params.get("mp"),
  );
}
