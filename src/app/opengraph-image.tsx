import { siteOgImage } from "@/lib/og";

/** Imagen al compartir el sitio (landing y cualquier página sin imagen propia). */
export const alt = "Costa Turnos: turnos online, fila por orden de llegada y cobros";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return siteOgImage({
    title: "Tus clientes reservan solos.",
    subtitle: "Turnos online, fila por orden de llegada y cobros con MercadoPago.",
  });
}
