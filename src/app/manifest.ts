import type { MetadataRoute } from "next";

/**
 * Manifiesto de la web app. En iPhone es requisito para recibir notificaciones push: solo
 * funcionan si la web se agrega a la pantalla de inicio Y declara `display: standalone`.
 * Sin `start_url` a propósito: la app instalada abre la página desde la que se instaló (por ej.
 * el link personal de la fila del cliente) en vez de mandarlo a la portada.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Costa Turnos",
    short_name: "Costa Turnos",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [{ src: "/logo-mark.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
