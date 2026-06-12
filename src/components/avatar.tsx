"use client";

import { useEffect, useState } from "react";
import { getSignedUrl } from "@/lib/api/files";
import { cn } from "@/lib/utils";

/**
 * Avatar con fallback: si hay una imagen (logo del negocio, vía URL firmada o URL directa)
 * la muestra; si no llega ninguna, muestra la inicial del nombre como base.
 */
export function Avatar({
  name,
  fileId,
  imageUrl,
  className,
}: {
  name?: string | null;
  /** Id de archivo del back (se resuelve a URL firmada). */
  fileId?: string | null;
  /** URL directa (si ya la tenés). Tiene prioridad sobre fileId. */
  imageUrl?: string | null;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(imageUrl ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setFailed(false);
    if (imageUrl) {
      setUrl(imageUrl);
      return;
    }
    if (!fileId) {
      setUrl(null);
      return;
    }
    getSignedUrl(fileId)
      .then((r) => active && setUrl(r.url))
      .catch(() => active && setUrl(null));
    return () => {
      active = false;
    };
  }, [fileId, imageUrl]);

  const initial = (name?.trim()?.charAt(0) ?? "?").toUpperCase();
  const showImage = url && !failed;

  return (
    <span
      className={cn(
        "grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-muted font-display text-sm font-semibold text-foreground",
        className,
      )}
      aria-hidden={!name}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={name ?? ""}
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        initial
      )}
    </span>
  );
}
