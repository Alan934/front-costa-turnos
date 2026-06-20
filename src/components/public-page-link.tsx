"use client";

import { useState } from "react";
import { Link2, ExternalLink, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Host público donde se sirve la página de reservas del profesional. */
export const PUBLIC_HOST = "costaturnos.com.ar";

/**
 * Tarjeta con el link a la página pública del profesional, con acciones de
 * copiar y abrir. Reutilizada en el dashboard y en Configuración para que el
 * profesional tenga el link siempre a mano.
 */
export function PublicPageLink({ slug, className }: { slug: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const path = `/r/${slug}`;
  const display = `${PUBLIC_HOST}${path}`;

  async function copy() {
    const url = `https://${display}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // El navegador puede bloquear el portapapeles sin gesto del usuario; ignoramos.
    }
  }

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3 ${className ?? ""}`}
    >
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
  );
}
