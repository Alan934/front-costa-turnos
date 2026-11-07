/**
 * Valida un destino de redirección que viene de la URL (?next=...). Solo se aceptan rutas
 * internas del propio sitio. Rechaza lo que el navegador podría interpretar como otro origen:
 * "//host", "/\host" (el navegador trata "\" como "/"), esquemas, y caracteres de control.
 * Devuelve la ruta o null si no es segura.
 */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  if (raw.includes("\\") || /[\u0000-\u001f\u007f]/.test(raw)) return null;
  try {
    const base = "http://internal.invalid";
    if (new URL(raw, base).origin !== base) return null;
  } catch {
    return null;
  }
  return raw;
}
