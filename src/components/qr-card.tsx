"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Check, ExternalLink, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Tarjeta con el QR de una URL para imprimir y colgar en el local, más el link
 * en texto (copiar / abrir). El QR se dibuja como SVG en el cliente: no se pega
 * a ningún servicio externo, así que funciona igual sin internet en el local.
 *
 * "Imprimir" no imprime la pantalla: imprime una hoja aparte con solo el QR y, si se
 * pasan `printSteps`, un mini paso a paso para quien lo escanee (ver `.qr-print-sheet`
 * en globals.css, que oculta todo lo demás mientras se imprime).
 */
export function QrCard({
  url,
  title,
  hint,
  printTitle,
  printSteps,
  className,
}: {
  url: string;
  title: string;
  hint?: string;
  /** Título grande de la hoja impresa (por defecto, `title`). */
  printTitle?: string;
  /** Pasos que se imprimen debajo del QR, en orden. */
  printSteps?: string[];
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const display = url.replace(/^https?:\/\//, "");

  // El portal necesita `document`: recién existe después de montar en el cliente.
  useEffect(() => setMounted(true), []);

  function print() {
    // La clase en <body> activa las reglas @media print que dejan solo la hoja del QR.
    // Se saca al terminar para no afectar otros botones "Imprimir" de la app.
    const cls = "printing-qr";
    document.body.classList.add(cls);
    window.addEventListener("afterprint", () => document.body.classList.remove(cls), {
      once: true,
    });
    window.print();
  }

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
            <Button variant="outline" size="sm" onClick={print}>
              <Printer className="size-3.5" />
              Imprimir
            </Button>
          </div>
        </div>
      </div>

      {/* Hoja de impresión: oculta en pantalla, es lo único visible al imprimir.
          Colores fijos (no del tema) para que salga igual con el modo oscuro activo. */}
      {mounted &&
        createPortal(
          <div className="qr-print-sheet flex-col items-center bg-white px-10 py-8 text-center text-black">
            <h1 className="text-[34px] font-bold leading-tight">{printTitle ?? title}</h1>

            <div className="mt-8">
              <QRCodeSVG value={url} size={340} level="M" marginSize={0} />
            </div>
            <p className="mt-4 break-all text-base">{display}</p>

            {printSteps && printSteps.length > 0 && (
              <ol className="mt-10 w-full max-w-[520px] space-y-4 text-left">
                {printSteps.map((step, i) => (
                  <li key={i} className="flex items-start gap-4 text-xl leading-snug">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-black text-lg font-bold">
                      {i + 1}
                    </span>
                    <span className="pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
