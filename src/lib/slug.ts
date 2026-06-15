/**
 * Normaliza un texto a un slug URL-safe: minúsculas, sin acentos, espacios y símbolos
 * colapsados a guiones, sin guiones al inicio/fin. Usado para los enlaces públicos /r/:slug
 * y los comercios.
 */
export function toSlug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
