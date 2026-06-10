"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Trash2, Loader2 } from "lucide-react";
import {
  uploadFile,
  getSignedUrl,
  MAX_IMAGE_BYTES,
  ACCEPTED_IMAGE_TYPES,
  uploadErrorMessage,
} from "@/lib/api/files";
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
 * Subida de una imagen (logo, portada, foto de ficha). Valida tamaño/tipo en el cliente,
 * sube a `/files` y muestra preview. Maneja 400/413 del backend. Para archivos ya subidos,
 * resuelve la URL firmada (válida ~15 min).
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
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Si llega un fileId previo, pedimos su URL firmada para mostrarlo.
  useEffect(() => {
    let active = true;
    if (!fileId) return;
    getSignedUrl(fileId)
      .then((r) => active && setPreview(r.url))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [fileId]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
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

    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setBusy(true);
    try {
      const uploaded = await uploadFile({ file, ownerType, ownerId });
      onUploaded(uploaded);
    } catch (err) {
      setError(uploadErrorMessage((err as AxiosError).response?.status));
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }

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
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="text-sm font-medium text-accent hover:underline disabled:opacity-50"
          >
            {label}
          </button>
          <p className="text-xs text-muted-foreground">JPG, PNG o WebP · hasta 10 MB</p>
          {preview && onRemoved && (
            <button
              type="button"
              onClick={() => {
                setPreview(null);
                onRemoved();
              }}
              className="mt-1 inline-flex items-center gap-1 text-xs text-destructive hover:underline"
            >
              <Trash2 className="size-3" />
              Quitar
            </button>
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
      />
    </div>
  );
}
