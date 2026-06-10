import type { Metadata, Viewport } from "next";
import "./globals.css";
import { fontBody, fontSpace } from "@/lib/fonts";
import { cn } from "@/lib/utils";
import { Providers } from "@/components/providers";
import { MswProvider } from "@/components/msw-provider";
import { ThemeProvider, themeInitScript } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: {
    default: "Costa Turnos",
    template: "%s · Costa Turnos",
  },
  description:
    "Reservá turnos online, sin papel ni vueltas por WhatsApp. Costa Turnos: gestión de turnos para peluquerías, consultorios, talleres y cualquier servicio con turnos.",
  metadataBase: new URL("https://costaturnos.com.ar"),
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#2a2724" },
  ],
  width: "device-width",
  initialScale: 1,
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
      <body className="min-h-dvh antialiased">
        <ThemeProvider>
          <MswProvider>
            <Providers>{children}</Providers>
          </MswProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
