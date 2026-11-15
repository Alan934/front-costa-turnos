/**
 * Búsqueda de clientes en el navegador, la misma en todas las pantallas (Clientes, Nuevo turno,
 * Agregar a la sala). La cartera se trae entera una vez (`useClients()`, cacheada) y se filtra
 * acá: es instantáneo, no pide nada por tecla y funciona con mala señal.
 */

/** Sin tildes ni mayúsculas: "María" → "maria", "Ñoño" → "nono". */
export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Lo mínimo de un cliente para buscarlo. */
export interface SearchableClient {
  fullName?: string | null;
  phone?: string | null;
  email?: string | null;
}

/** Con menos dígitos que esto no se busca por teléfono (evita que "2" traiga a todos). */
const MIN_PHONE_DIGITS = 3;

/**
 * ¿El cliente coincide con lo que se escribió? Ignora tildes y mayúsculas.
 * - Cada palabra tiene que aparecer en el nombre ("mari gonz" encuentra a "María González") o,
 *   si es un número de 3+ dígitos, en el teléfono ("261 555" o "261-555" encuentran "2615550177").
 * - Email: contiene lo escrito.
 * Una búsqueda vacía coincide con todos.
 */
export function matchesClient(client: SearchableClient, query: string): boolean {
  const q = normalizeText(query.trim());
  if (!q) return true;

  if (client.email && normalizeText(client.email).includes(q)) return true;

  // Cada palabra coincide con el nombre o, si es un número, con el teléfono: así "juan 261"
  // encuentra a Juan con un 261 en el número (y no a cualquiera con 261).
  const name = normalizeText(client.fullName ?? "");
  const phone = (client.phone ?? "").replace(/\D/g, "");
  return q.split(/\s+/).every((word) => {
    if (name.includes(word)) return true;
    if (/[a-z]/.test(word)) return false;
    const digits = word.replace(/\D/g, "");
    return digits.length >= MIN_PHONE_DIGITS && phone.includes(digits);
  });
}
