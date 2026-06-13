/**
 * Parche idempotente del contrato antes de `orval`.
 *
 * El back declara el path param `comercioId` en los endpoints de Fase 2
 * (`/v1/comercios/{comercioId}/services|availability/...`) pero NO en los 4 de Fase 1
 * (`/v1/comercios/{comercioId}`, `.../members`, `.../invitations`, `.../invitations/{id}`):
 * ahí lo resuelve el guard, por eso el contrato los manda con `parameters: []` y orval falla
 * ("path params comercioId can't be found"). Verificado: sin este parche orval rompe en esos 4.
 *
 * Qué hace: por cada path cuyo template tenga `{comercioId}`, si ningún método ni el nivel de
 * path lo declara, le agrega un `parameters` a NIVEL de path con la definición de `comercioId`.
 * Es idempotente: si ya está declarado (Fase 2), no toca nada.
 *
 * Pedirle al back que declare `comercioId` también en los 4 controllers de Fase 1 para poder
 * borrar este script. (El dedupe de operationIds que hacía antes ya NO hace falta: el back
 * arregló la operationIdFactory a controller+método.)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const file = resolve(here, "..", "openapi.json");

const spec = JSON.parse(readFileSync(file, "utf8"));
const METHODS = ["get", "post", "patch", "delete", "put", "options", "head"];

let patched = 0;
for (const [path, item] of Object.entries(spec.paths ?? {})) {
  const tokens = [...path.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
  if (!tokens.includes("comercioId")) continue;

  const declaredNames = new Set((item.parameters ?? []).map((p) => p.name));
  for (const m of METHODS) {
    for (const p of item[m]?.parameters ?? []) declaredNames.add(p.name);
  }
  if (declaredNames.has("comercioId")) continue; // ya declarado: nada que hacer

  item.parameters = [
    ...(item.parameters ?? []),
    {
      name: "comercioId",
      in: "path",
      required: true,
      schema: { type: "string" },
      description: "Id del comercio (parche del front; el back no lo declara en estos 4 paths).",
    },
  ];
  patched++;
}

if (patched > 0) {
  writeFileSync(file, JSON.stringify(spec, null, 2) + "\n", "utf8");
  console.log(`[patch-openapi] comercioId agregado a ${patched} path(s).`);
} else {
  console.log("[patch-openapi] nada que parchear (comercioId ya declarado).");
}
