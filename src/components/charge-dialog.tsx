"use client";

import { useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import {
  Banknote,
  ArrowLeftRight,
  QrCode,
  CheckCircle2,
  Undo2,
  History,
  Clock,
  Copy,
  Check,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  useChargeSummary,
  useChargeQr,
  useChargePaid,
  useChargeDeferred,
  useRevertPayment,
  usePaymentAudit,
} from "@/lib/api/sala";
import { getApiErrorMessage } from "@/lib/api/error-message";
import { formatMoney, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ChargePaymentDto } from "@/lib/api/generated/model/chargePaymentDto";
import type { ChargeQrDto } from "@/lib/api/generated/model/chargeQrDto";

const METHOD_LABEL: Record<string, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  mercadopago: "Mercado Pago",
};
const STATUS_LABEL: Record<string, string> = {
  paid: "Pagado",
  pending: "Pendiente",
  deferred: "Pagaré",
  failed: "Cancelado",
  refunded: "Devuelto",
};
const ACTION_LABEL: Record<string, string> = {
  "payment.mark_paid": "Marcado como pagado",
  "payment.revert": "Cobro deshecho",
  "payment.mark_deferred": "Marcado como pagaré",
  "payment.mp_qr": "QR de Mercado Pago generado",
  "payment.mp_paid": "Acreditado por Mercado Pago",
  "payment.superseded": "QR reemplazado por otro cobro",
};

/**
 * Cobro de un turno: cuánto falta y cómo se cobra.
 * - QR de Mercado Pago: el cliente escanea y paga el monto exacto a la cuenta del profesional.
 * - "Ya pagó": efectivo, transferencia, o pagó antes por su cuenta.
 * - Pagaré: se fue sin pagar.
 * Un cobro marcado por error se puede deshacer (con motivo); queda todo registrado.
 */
export function ChargeDialog({
  appointmentId,
  clientName,
  onClose,
}: {
  appointmentId: string;
  clientName: string;
  onClose: () => void;
}) {
  const [qr, setQr] = useState<ChargeQrDto | null>(null);
  // Mientras el QR está abierto se consulta cada pocos segundos: el pago lo acredita el
  // webhook de Mercado Pago, que no le avisa al navegador.
  const summary = useChargeSummary(appointmentId, { pollMs: qr ? 3000 : false });
  const makeQr = useChargeQr(appointmentId);
  const markPaid = useChargePaid(appointmentId);
  const markDeferred = useChargeDeferred(appointmentId);

  const sum = summary.data;
  const busy = makeQr.isPending || markPaid.isPending || markDeferred.isPending;
  const error = [makeQr, markPaid, markDeferred].find((m) => m.isError)?.error;

  const [deferring, setDeferring] = useState(false);
  const [deferNote, setDeferNote] = useState("");

  function openQr() {
    makeQr.mutate(undefined, { onSuccess: (res) => setQr(res) });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cobrar</DialogTitle>
          <DialogDescription>
            {clientName}
            {sum ? ` · ${sum.serviceName}` : ""}
          </DialogDescription>
        </DialogHeader>

        {summary.isLoading && (
          <div className="grid place-items-center py-10">
            <Spinner />
          </div>
        )}
        {summary.isError && (
          <p className="text-sm text-destructive">{getApiErrorMessage(summary.error)}</p>
        )}

        {sum && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <Figure label="Valor" value={formatMoney(sum.totalCents)} />
              <Figure label="Cobrado" value={formatMoney(sum.paidCents)} />
              <Figure
                label="Falta"
                value={formatMoney(sum.dueCents)}
                highlight={!sum.fullyPaid}
                done={sum.fullyPaid}
              />
            </div>

            {sum.fullyPaid ? (
              <div className="flex items-center gap-2 rounded-xl border border-status-serving-foreground/30 bg-status-serving px-4 py-3 text-status-serving-foreground">
                <CheckCircle2 className="size-5 shrink-0" />
                <p className="text-sm font-medium">Cobrado completo</p>
              </div>
            ) : qr ? (
              <QrPanel qr={qr} onCancel={() => setQr(null)} />
            ) : (
              <div className="space-y-3">
                <Button
                  size="lg"
                  className="w-full"
                  onClick={openQr}
                  disabled={busy || !sum.mpConnected}
                >
                  {makeQr.isPending ? <Spinner /> : <QrCode className="size-5" />}
                  Cobrar con QR · {formatMoney(sum.dueMpCents)}
                </Button>
                {!sum.mpConnected && (
                  <p className="text-xs text-muted-foreground">
                    Para cobrar con QR conectá tu Mercado Pago en{" "}
                    <Link href="/ajustes/pagos" className="text-accent underline">
                      Cobros
                    </Link>
                    .
                  </p>
                )}
                {sum.dueMpCents > sum.dueCents && (
                  <p className="text-xs text-muted-foreground">
                    El QR incluye {formatMoney(sum.dueMpCents - sum.dueCents)} de IVA por Mercado
                    Pago.
                  </p>
                )}

                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Ya pagó</p>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => markPaid.mutate({ method: "cash" })}
                    >
                      <Banknote className="size-4" />
                      Efectivo
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => markPaid.mutate({ method: "transfer" })}
                    >
                      <ArrowLeftRight className="size-4" />
                      Transfer.
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      title="Pagó antes por su cuenta (transferencia, seña, etc.)"
                      onClick={() => markPaid.mutate({ method: "transfer", note: "Pagó antes" })}
                    >
                      <Clock className="size-4" />
                      Pagó antes
                    </Button>
                  </div>
                </div>

                {deferring ? (
                  <div className="space-y-2 rounded-xl border border-border p-3">
                    <p className="text-xs font-medium text-muted-foreground">
                      Pagaré: queda debiendo {formatMoney(sum.dueCents)}
                    </p>
                    <Input
                      placeholder="Cuándo / cómo quedó en pagar (opcional)"
                      value={deferNote}
                      onChange={(e) => setDeferNote(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setDeferring(false)}>
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          markDeferred.mutate(
                            { note: deferNote.trim() || undefined },
                            { onSuccess: () => setDeferring(false) },
                          )
                        }
                      >
                        Anotar pagaré
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-muted-foreground"
                    onClick={() => setDeferring(true)}
                    disabled={busy}
                  >
                    Se fue sin pagar (pagaré)
                  </Button>
                )}
              </div>
            )}

            {error ? <p className="text-sm text-destructive">{getApiErrorMessage(error)}</p> : null}

            {sum.payments.length > 0 && (
              <PaymentList payments={sum.payments} appointmentId={appointmentId} />
            )}

            <Button variant="outline" className="w-full" onClick={onClose}>
              {sum.fullyPaid ? "Listo" : "Cobrar después"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Figure({
  label,
  value,
  highlight,
  done,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  done?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl bg-muted/60 px-2 py-2.5",
        highlight && "bg-accent/10",
        done && "bg-status-serving",
      )}
    >
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-display text-base font-semibold tabular-nums">{value}</p>
    </div>
  );
}

/** QR a mostrar al cliente. Fondo blanco fijo: sobre fondo oscuro ningún celular lo lee. */
function QrPanel({ qr, onCancel }: { qr: ChargeQrDto; onCancel: () => void }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(qr.initPoint);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // sin portapapeles: el QR igual sirve
    }
  }
  return (
    <div className="rounded-2xl border border-border p-4 text-center">
      <p className="text-sm text-muted-foreground">Que el cliente lo escanee con su celular</p>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums">
        {formatMoney(qr.amountCents)}
      </p>
      <div className="mx-auto mt-3 w-fit rounded-xl bg-white p-3">
        <QRCodeSVG value={qr.initPoint} size={196} level="M" marginSize={0} />
      </div>
      <p className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Spinner />
        Esperando el pago…
      </p>
      <div className="mt-3 flex justify-center gap-2">
        <Button variant="outline" size="sm" onClick={copy}>
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copiado" : "Copiar link"}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="size-3.5" />
          Cerrar QR
        </Button>
      </div>
    </div>
  );
}

function PaymentList({
  payments,
  appointmentId,
}: {
  payments: ChargePaymentDto[];
  appointmentId: string;
}) {
  return (
    <ul className="space-y-2">
      {payments.map((p) => (
        <PaymentRow key={p.id} payment={p} appointmentId={appointmentId} />
      ))}
    </ul>
  );
}

function PaymentRow({
  payment,
  appointmentId,
}: {
  payment: ChargePaymentDto;
  appointmentId: string;
}) {
  const [undoing, setUndoing] = useState(false);
  const [reason, setReason] = useState("");
  const [showAudit, setShowAudit] = useState(false);
  const revert = useRevertPayment(appointmentId);
  const audit = usePaymentAudit(payment.id, showAudit);

  return (
    <li className="rounded-xl border border-border px-3 py-2.5 text-sm">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {METHOD_LABEL[payment.method] ?? payment.method} · {formatMoney(payment.amountCents)}
          </p>
          <p className="text-xs text-muted-foreground">
            {STATUS_LABEL[payment.status] ?? payment.status}
            {payment.paidAt ? ` · ${formatTime(payment.paidAt)}` : ""}
            {payment.note ? ` · ${payment.note}` : ""}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAudit((v) => !v)}
          aria-label="Ver historial"
          title="Historial: quién hizo qué y cuándo"
        >
          <History className="size-4" />
        </Button>
        {payment.revertible && !undoing && (
          <Button variant="outline" size="sm" onClick={() => setUndoing(true)}>
            <Undo2 className="size-4" />
            Deshacer
          </Button>
        )}
      </div>

      {undoing && (
        <div className="mt-2.5 space-y-2 rounded-lg bg-muted/50 p-2.5">
          <p className="text-xs text-muted-foreground">
            Vuelve a quedar pendiente de cobro. El motivo queda registrado junto con tu usuario.
          </p>
          <Input
            placeholder="Motivo (ej: marqué el cliente equivocado)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={300}
          />
          {revert.isError && (
            <p className="text-xs text-destructive">{getApiErrorMessage(revert.error)}</p>
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setUndoing(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={reason.trim().length < 3 || revert.isPending}
              onClick={() =>
                revert.mutate(
                  { paymentId: payment.id, reason: reason.trim() },
                  {
                    onSuccess: () => {
                      setUndoing(false);
                      setReason("");
                    },
                  },
                )
              }
            >
              {revert.isPending ? <Spinner /> : <Undo2 className="size-4" />}
              Deshacer cobro
            </Button>
          </div>
        </div>
      )}

      {showAudit && (
        <ol className="mt-2.5 space-y-1.5 border-l-2 border-border pl-3">
          {audit.isLoading && <li className="text-xs text-muted-foreground">Cargando…</li>}
          {audit.data?.map((e, i) => (
            <li key={i} className="text-xs">
              <span className="font-medium">{ACTION_LABEL[e.action] ?? e.action}</span>
              <span className="text-muted-foreground">
                {" "}
                · {new Date(e.createdAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}
                {e.accountId ? "" : " · automático"}
              </span>
              {typeof e.metadata?.reason === "string" && (
                <span className="block text-muted-foreground">Motivo: {e.metadata.reason}</span>
              )}
            </li>
          ))}
        </ol>
      )}
    </li>
  );
}
