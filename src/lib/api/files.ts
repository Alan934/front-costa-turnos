"use client";

import { useMutation } from "@tanstack/react-query";
import { customInstance } from "@/lib/api/axios-instance";
import type { FileObject } from "@/lib/api/generated/model/fileObject";
import type { SignedUrlResponse } from "@/mocks/contract-extensions";

/**
 * Subida de archivos (`POST /files`, multipart). orval no tipa el body (es `multipart file`),
 * así que armamos el FormData a mano. Límites del backend: imágenes (jpeg/png/webp) ≤ 10 MB
 * (se comprimen a webp), PDF ≤ 3 MB. Errores: 400 (tipo inválido) / 413 (muy grande).
 */
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_PDF_BYTES = 3 * 1024 * 1024;

export interface UploadArgs {
  file: File;
  ownerType: string;
  ownerId: string;
}

export function uploadFile({ file, ownerType, ownerId }: UploadArgs) {
  const form = new FormData();
  form.append("file", file);
  return customInstance<FileObject>({
    url: "/v1/files",
    method: "POST",
    params: { ownerType, ownerId },
    data: form,
    // Dejamos que el navegador ponga el boundary del multipart.
    headers: { "Content-Type": "multipart/form-data" },
  });
}

export function useUploadFile() {
  return useMutation({ mutationFn: uploadFile });
}

/** Pide la URL firmada (válida ~15 min) para mostrar/descargar un archivo. */
export function getSignedUrl(id: string) {
  return customInstance<SignedUrlResponse>({ url: `/v1/files/${id}/url`, method: "GET" });
}

export function useDeleteFile() {
  return useMutation({
    mutationFn: (id: string) =>
      customInstance<void>({ url: `/v1/files/${id}`, method: "DELETE" }),
  });
}

/** Mensaje de error legible a partir del status de una subida fallida. */
export function uploadErrorMessage(status?: number): string {
  if (status === 413) return "El archivo es demasiado grande.";
  if (status === 400) return "Formato no permitido. Usá JPG, PNG, WebP o PDF.";
  return "No pudimos subir el archivo. Probá de nuevo.";
}
