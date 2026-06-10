import { defineConfig } from "orval";

/**
 * Genera el cliente tipado + hooks de React Query desde el contrato.
 * Fuente de verdad: ./openapi.json (Turnerito API).
 *
 * - `client: react-query` => hooks useQuery/useMutation por operación.
 * - `mutator` => todas las llamadas pasan por nuestra instancia de axios.
 * - `mock: true` => genera funciones de mock (faker) que MSW puede reusar.
 * - `mode: tags-split` => un archivo por tag (auth, appointments, ...).
 *
 * Salida: src/lib/api/generated/  (no editar a mano; está en eslintignore).
 */
export default defineConfig({
  turnerito: {
    input: {
      target: "./openapi.json",
    },
    output: {
      mode: "tags-split",
      target: "./src/lib/api/generated/endpoints",
      schemas: "./src/lib/api/generated/model",
      client: "react-query",
      httpClient: "axios",
      clean: true,
      prettier: false,
      override: {
        mutator: {
          path: "./src/lib/api/axios-instance.ts",
          name: "customInstance",
        },
        query: {
          useQuery: true,
          useInfinite: false,
          signal: true,
        },
        mock: {
          type: "msw",
          delay: false,
        },
      },
    },
  },
});
