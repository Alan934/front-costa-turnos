import { siteOgImage } from "@/lib/og";

/** Imagen al compartir /ingresar: el link que se le pasa a un profesional para que se sume. */
export const alt = "Sumate a Costa Turnos: probalo 15 días gratis";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return siteOgImage({
    title: "Armá tu página de turnos en minutos.",
    subtitle: "Tus clientes reservan solos, desde el celu. Probalo 15 días gratis, sin tarjeta.",
  });
}
