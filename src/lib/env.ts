/**
 * Acceso centralizado a variables de entorno públicas.
 * Todo lo que el cliente necesita debe ir bajo NEXT_PUBLIC_.
 */

export const env = {
  /** URL base del API (Turnerito). */
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000",
  /** URL del servidor WebSocket de la sala de espera. Por defecto = apiUrl. */
  socketUrl:
    process.env.NEXT_PUBLIC_SOCKET_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:3000",
  /** Interruptor de mocks: "enabled" => MSW intercepta las llamadas. */
  mockingEnabled: process.env.NEXT_PUBLIC_API_MOCKING === "enabled",
} as const;
