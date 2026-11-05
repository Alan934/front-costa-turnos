"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Check, ExternalLink, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Tarjeta con el QR de una URL para imprimir y colgar en el local, más el link
 * en texto (copiar / abrir). El QR se dibuja como SVG en el cliente: no se pega
 * a ningún servicio externo, así que funciona igual sin internet en el local.
 */
export function QrCard({
  url,
  title,
  hint,
  className,
}: {
  url: string;
  title: string;
  hint?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const display = url.replace(/^https?:\/\//, "");

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // El navegador puede bloquear el portapapeles sin gesto del usuario; ignoramos.
    }
  }

  return (
    <div className={cn("rounded-2xl border border-border bg-card p-5", className)}>
      <p className="font-display text-sm font-semibold">{title}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}

      <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-center">
        {/* Fondo blanco fijo: un QR sobre fondo oscuro no lo lee ningún celular. */}
        <div className="shrink-0 rounded-xl bg-white p-3">
          <QRCodeSVG value={url} size={132} level="M" marginSize={0} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="break-all text-center text-sm text-muted-foreground sm:text-left">
            {display}
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
            <Button variant="outline" size="sm" onClick={copy}>
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "Copiado" : "Copiar"}
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={url} target="_blank" rel="noreferrer">
                Abrir
                <ExternalLink className="size-3.5" />
              </a>
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="size-3.5" />
              Imprimir
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
