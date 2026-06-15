"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Trash2, Loader2, Check, X } from "lucide-react";
import {
  uploadFile,
  getSignedUrl,
  MAX_IMAGE_BYTES,
  ACCEPTED_IMAGE_TYPES,
  uploadErrorMessage,
} from "@/lib/api/files";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { AxiosError } from "axios";
import type { FileObject } from "@/lib/api/generated/model/fileObject";
import { cn } from "@/lib/utils";

interface ImageUploadProps {
  ownerType: string;
  ownerId: string;
  /** Id de un archivo ya subido (para mostrar su preview vía URL firmada). */
  fileId?: string | null;
  onUploaded: (file: FileObject) => void;
  onRemoved?: () => void;
  label?: string;
  className?: string;
}

/**
 * Subida de una imagen (logo, portada, foto de ficha). Al elegir un archivo muestra
 * un preview y pide confirmación: recién al confirmar sube a `/files` y avisa con
 * `onUploaded`. Valida tamaño/tipo en el cliente y maneja 400/413 del backend. Para
 * archivos ya subidos, resuelve la URL firmada (válida ~15 min).
 */
export function ImageUpload({
  ownerType,
  ownerId,
  fileId,
  onUploaded,
  onRemoved,
  label = "Subir imagen",
  className,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Imagen ya guardada (URL firmada del back).
  const [saved, setSaved] = useState<string | null>(null);
  // Archivo elegido pendiente de confirmar (preview local sin subir aún).
  const [pending, setPending] = useState<{ file: File; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Si llega un fileId previo, pedimos su URL firmada para mostrarlo.
  useEffect(() => {
    let active = true;
    if (!fileId) {
      setSaved(null);
      return;
    }
    getSignedUrl(fileId)
      .then((r) => active && setSaved(r.url))
      .catch(() => {
        if (active) setError("No pudimos cargar la imagen. Probá recargar la página.");
      });
    return () => {
      active = false;
    };
  }, [fileId]);

  // Liberamos el object URL del preview pendiente cuando cambia o se desmonta.
  useEffect(() => {
    return () => {
      if (pending) URL.revokeObjectURL(pending.url);
    };
  }, [pending]);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite re-elegir el mismo archivo
    if (!file) return;
    setError(null);

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setError("Formato no permitido. Usá JPG, PNG o WebP.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("La imagen supera los 10 MB.");
      return;
    }

    if (pending) URL.revokeObjectURL(pending.url);
    setPending({ file, url: URL.createObjectURL(file) });
  }

  function cancelPending() {
    if (pending) URL.revokeObjectURL(pending.url);
    setPending(null);
    setError(null);
  }

  async function confirmUpload() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      const uploaded = await uploadFile({ file: pending.file, ownerType, ownerId });
      URL.revokeObjectURL(pending.url);
      setPending(null);
      onUploaded(uploaded);
    } catch (err) {
      setError(uploadErrorMessage((err as AxiosError).response?.status));
    } finally {
      setBusy(false);
    }
  }

  const preview = pending?.url ?? saved;

  return (
    <div className={className}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className={cn(
            "relative grid size-20 place-items-center overflow-hidden rounded-xl border border-dashed border-border bg-muted/40 text-muted-foreground transition-colors hover:border-accent hover:text-accent",
            busy && "pointer-events-none",
          )}
          aria-label={label}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="size-full object-cover" />
          ) : (
            <ImagePlus className="size-6" />
          )}
          {busy && (
            <span className="absolute inset-0 grid place-items-center bg-card/70">
              <Loader2 className="size-5 animate-spin" />
            </span>
          )}
        </button>

        <div className="min-w-0">
          {pending ? (
            // Archivo elegido: pedir confirmación antes de subir.
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={confirmUpload} disabled={busy}>
                {busy ? <Spinner /> : <Check className="size-4" />}
                Confirmar
              </Button>
              <Button variant="ghost" size="sm" onClick={cancelPending} disabled={busy}>
                <X className="size-4" />
                Cancelar
              </Button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={busy}
                className="text-sm font-medium text-accent hover:underline disabled:opacity-50"
              >
                {label}
              </button>
              <p className="text-xs text-muted-foreground">JPG, PNG o WebP · hasta 10 MB</p>
              {saved && onRemoved && (
                <button
                  type="button"
                  onClick={() => {
                    setSaved(null);
                    onRemoved();
                  }}
                  className="mt-1 inline-flex items-center gap-1 text-xs text-destructive hover:underline"
                >
                  <Trash2 className="size-3" />
                  Quitar
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        className="hidden"
        onChange={onPick}
        aria-label={label}
      />
    </div>
  );
}
