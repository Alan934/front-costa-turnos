import type { Metadata, Viewport } from "next";
import "./globals.css";
import { fontBody, fontSpace } from "@/lib/fonts";
import { cn } from "@/lib/utils";
import { Providers } from "@/components/providers";
import { MswProvider } from "@/components/msw-provider";
import { ThemeProvider, themeInitScript } from "@/components/theme-provider";
import { baseOpenGraph } from "@/lib/seo";

export const metadata: Metadata = {
  title: {
    default: "Costa Turnos",
    template: "%s · Costa Turnos",
  },
  description:
    "Reservá turnos online, sin papel ni vueltas por WhatsApp. Costa Turnos: gestión de turnos para peluquerías, consultorios, talleres y cualquier servicio con turnos.",
  metadataBase: new URL("https://www.costaturnos.com"),
  // Tarjeta al compartir el link (WhatsApp, Instagram, Facebook…). La imagen sale de
  // app/opengraph-image.tsx; las páginas de reserva (/r/<slug>) tienen la suya.
  openGraph: {
    ...baseOpenGraph,
    title: "Costa Turnos · Turnos online para tu negocio",
    description:
      "Tus clientes reservan solos. Turnos online, fila por orden de llegada y cobros con MercadoPago, todo en un solo lugar.",
    url: "/",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#2a2724" },
  ],
  width: "device-width",
  initialScale: 1,
  // Con el teclado abierto, Chrome Android por defecto solo achica el viewport "visual": los
  // paneles anclados abajo (bottom sheets) quedaban tapados por el teclado. Así el layout se
  // achica con el teclado y el sheet queda justo encima.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es-AR"
      suppressHydrationWarning
      className={cn(fontBody.variable, fontSpace.variable)}
    >
      <head>
        {/* Aplica el tema antes de pintar para evitar flash de color. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-dvh antialiased" suppressHydrationWarning>
        <ThemeProvider>
          <MswProvider>
            <Providers>{children}</Providers>
          </MswProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
