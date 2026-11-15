"use client";

import { useState } from "react";
import { Link2, ExternalLink, Copy, Check, MessageCircle, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QrCard } from "@/components/qr-card";

/** Host público donde se sirve la página de reservas del profesional. */
export const PUBLIC_HOST = "www.costaturnos.com";

/**
 * Tarjeta con el link a la página pública del profesional, con acciones de
 * copiar y abrir. Reutilizada en el dashboard y en Configuración para que el
 * profesional tenga el link siempre a mano.
 *
 * Con `share` suma las dos formas en que el link llega a los clientes: mandarlo por
 * WhatsApp (abre WhatsApp con el mensaje ya escrito, para elegir a quién) y el QR para
 * imprimir y dejar en el local.
 */
export function PublicPageLink({
  slug,
  className,
  businessName,
  share = false,
}: {
  slug: string;
  className?: string;
  /** Nombre del negocio, para el mensaje de WhatsApp. */
  businessName?: string;
  share?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const path = `/r/${slug}`;
  const display = `${PUBLIC_HOST}${path}`;
  const url = `https://${display}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // El navegador puede bloquear el portapapeles sin gesto del usuario; ignoramos.
    }
  }

  const whatsappText = encodeURIComponent(
    `¡Hola! Ya podés sacar turno online${businessName ? ` en ${businessName}` : ""}, a cualquier hora, desde acá: ${url}`,
  );

  return (
    <div className={className}>
      <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3">
        <Link2 className="size-4 shrink-0 text-accent" />
        <span className="min-w-0 flex-1 truncate text-sm">{display}</span>
        <Button variant="outline" size="sm" onClick={copy}>
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copiado" : "Copiar"}
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a href={path} target="_blank" rel="noreferrer">
            Ver
            <ExternalLink className="size-3.5" />
          </a>
        </Button>
      </div>

      {share && (
        <>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" asChild>
              <a
                href={`https://wa.me/?text=${whatsappText}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="size-3.5" />
                Enviar por WhatsApp
              </a>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowQr((v) => !v)}
              aria-expanded={showQr}
            >
              <QrCode className="size-3.5" />
              {showQr ? "Ocultar QR" : "QR para imprimir"}
            </Button>
          </div>
          {showQr && (
            <QrCard
              className="mt-3"
              url={url}
              title="QR de tu página de reservas"
              hint="Imprimilo y dejalo en el mostrador o en la puerta: quien lo escanee puede sacar turno desde su celular."
              printTitle={businessName ? `Reservá tu turno en ${businessName}` : "Reservá tu turno"}
              printSteps={[
                "Escaneá el código con la cámara de tu celular.",
                "Elegí el servicio, el día y el horario.",
                "Listo: tu turno queda reservado.",
              ]}
            />
          )}
        </>
      )}
    </div>
  );
}
