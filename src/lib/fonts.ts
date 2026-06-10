import { Hanken_Grotesk, Space_Grotesk } from "next/font/google";

/**
 * Body — Hanken Grotesk: grotesca humanista muy legible en densidad y tamaños chicos.
 * Para todo el texto de interfaz. `--font-body`.
 */
export const fontBody = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

/**
 * Display — Space Grotesk: grotesca geométrica con carácter (cierres rectos, detalles
 * técnicos). Para títulos, números y acentos de marca. Sin serif. `--font-space`.
 */
export const fontSpace = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});
