import { cache } from "react";
import { env } from "@/lib/env";
import type { ComercioPublicPageDto } from "@/lib/api/generated/model/comercioPublicPageDto";

/**
 * Página pública de un comercio leída desde el servidor (metadatos e imagen para compartir).
 * `cache` evita pedirla dos veces en el mismo render (generateMetadata + opengraph-image);
 * `revalidate` la refresca cada 5 min. Si el API falla devuelve null (se usan textos genéricos).
 */
export const getComercioPublicPage = cache(
  async (slug: string): Promise<ComercioPublicPageDto | null> => {
    try {
      const res = await fetch(`${env.apiUrl}/r/${encodeURIComponent(slug)}`, {
        next: { revalidate: 300 },
      });
      if (!res.ok) return null;
      return (await res.json()) as ComercioPublicPageDto;
    } catch {
      return null;
    }
  },
);

/** Bio del comercio (vive dentro de `settings`), recortada para descripciones. */
export function comercioBio(page: ComercioPublicPageDto): string | null {
  const bio = (page.settings as { bio?: unknown } | undefined)?.bio;
  return typeof bio === "string" && bio.trim() ? bio.trim() : null;
}
