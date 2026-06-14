import axios, { type AxiosError } from "axios";

/** Forma típica del cuerpo de error de NestJS. `message` puede ser string o array (validación). */
type ApiErrorBody = {
  message?: string | string[];
  error?: string;
  statusCode?: number;
};

/**
 * Extrae un mensaje legible del error que devuelve el backend.
 * - Si es un error de validación (`message: string[]`), une los mensajes.
 * - Si no hay cuerpo, cae a un texto por defecto según el status HTTP.
 */
export function getApiErrorMessage(err: unknown, fallback = "Ocurrió un error. Probá de nuevo."): string {
  if (axios.isAxiosError(err)) {
    const ax = err as AxiosError<ApiErrorBody>;
    const data = ax.response?.data;
    const raw = data?.message;
    if (Array.isArray(raw) && raw.length > 0) return raw.join(" · ");
    if (typeof raw === "string" && raw.trim()) return raw;

    switch (ax.response?.status) {
      case 400:
        return "Datos inválidos. Revisá los campos.";
      case 401:
        return "Tu sesión expiró. Volvé a iniciar sesión.";
      case 403:
        return "No tenés permisos para hacer esto.";
      case 409:
        return "Ya existe un turno en ese horario para el profesional.";
      default:
        return fallback;
    }
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

/**
 * Devuelve los mensajes de validación crudos (uno por campo/regla) si el backend
 * envió `message` como array. Útil para resaltar campos específicos.
 */
export function getApiValidationMessages(err: unknown): string[] {
  if (!axios.isAxiosError(err)) return [];
  const raw = (err as AxiosError<ApiErrorBody>).response?.data?.message;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) return [raw];
  return [];
}

/**
 * Mapea los mensajes de validación a los campos del formulario de turno.
 * NestJS suele prefijar el nombre del campo (ej. "phone must be a string").
 * Devuelve, por campo, el primer mensaje que lo menciona.
 */
export function matchFieldErrors(
  messages: string[],
  fields: readonly string[],
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const field of fields) {
    const hit = messages.find((m) => new RegExp(`\\b${field}\\b`, "i").test(m));
    if (hit) result[field] = hit;
  }
  return result;
}
