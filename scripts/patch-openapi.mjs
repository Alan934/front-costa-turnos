/**
 * Parche idempotente del contrato antes de `orval`.
 *
 * Anteriormente corregía dos defectos del backend: prefijo /v1/v1 duplicado y
 * comercioId sin declarar en 4 paths. El backend los corrigió en Fase 5; este
 * script ya no modifica nada pero se mantiene como hook del pipeline por si
 * en el futuro se necesita otro parche.
 */
console.log("[patch-openapi] nada que parchear.");
