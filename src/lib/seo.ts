/**
 * Campos de Open Graph comunes a todas las páginas. Next reemplaza el objeto `openGraph`
 * entero en cada página que define el suyo (no lo combina con el del layout), así que cada
 * página lo esparce: `openGraph: { ...baseOpenGraph, title, description }`.
 */
export const baseOpenGraph = {
  type: "website",
  locale: "es_AR",
  siteName: "Costa Turnos",
} as const;
