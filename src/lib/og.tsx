import { ImageResponse } from "next/og";

/**
 * Piezas comunes de las imágenes para compartir (Open Graph): la tarjeta que muestran
 * WhatsApp, Instagram, Facebook, etc. al pegar un link. Se dibujan con `next/og` (Satori):
 * solo flexbox y estilos inline, sin Tailwind.
 */

/** Tamaño recomendado por WhatsApp / Facebook (1.91:1). */
export const OG_SIZE = { width: 1200, height: 630 };

export const OG_COLORS = {
  teal: "#2E9A9C",
  tealDark: "#247F81",
  tealDeep: "#1C6668",
  white: "#FFFFFF",
  whiteSoft: "rgba(255,255,255,0.82)",
};

/**
 * Descarga una fuente de Google Fonts en TTF (Satori no lee woff2), recortada a los
 * caracteres de `text` para que pese poco. Si falla (sin red), devuelve null y la imagen
 * usa la fuente por defecto de next/og.
 */
async function loadGoogleFont(family: string, weight: number, text: string) {
  try {
    const url = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}&text=${encodeURIComponent(text)}`;
    const css = await (await fetch(url, { next: { revalidate: 60 * 60 * 24 * 7 } })).text();
    const src = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    if (!src) return null;
    const res = await fetch(src, { next: { revalidate: 60 * 60 * 24 * 7 } });
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

/** Fuentes de marca (Space Grotesk títulos, Hanken Grotesk texto) para el texto dado. */
export async function ogFonts(text: string) {
  const [display, body] = await Promise.all([
    loadGoogleFont("Space Grotesk", 600, text),
    loadGoogleFont("Hanken Grotesk", 500, text),
  ]);
  const fonts: { name: string; data: ArrayBuffer; weight: 500 | 600; style: "normal" }[] = [];
  if (display) fonts.push({ name: "Space Grotesk", data: display, weight: 600, style: "normal" });
  if (body) fonts.push({ name: "Hanken Grotesk", data: body, weight: 500, style: "normal" });
  return fonts;
}

/** Monograma CT (el del favicon) en blanco sobre fondo translúcido. */
export function OgLogo({ size }: { size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.25,
        background: "rgba(255,255,255,0.16)",
        border: "2px solid rgba(255,255,255,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width={size * 0.72} height={size * 0.72} viewBox="6 6 36 36">
        <g fill="none" stroke="#FFFFFF" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M34.6 14.4A14.5 14.5 0 1 0 34.6 33.6" />
          <path d="M18 18H30M24 18V31" />
        </g>
      </svg>
    </div>
  );
}

/** Fondo de marca: turquesa con la cordillera abajo (como el logo). */
export function OgFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        background: `linear-gradient(135deg, ${OG_COLORS.teal} 0%, ${OG_COLORS.tealDark} 100%)`,
        color: OG_COLORS.white,
        fontFamily: "Hanken Grotesk",
      }}
    >
      <svg
        width={OG_SIZE.width}
        height={210}
        viewBox="0 0 1200 210"
        style={{ position: "absolute", left: 0, bottom: 0 }}
      >
        <path
          d="M0 120 L150 70 L250 115 L420 20 L560 120 L680 60 L820 130 L960 50 L1080 110 L1200 80 L1200 210 L0 210 Z"
          fill={OG_COLORS.tealDark}
        />
        <path
          d="M0 170 L120 140 L260 175 L400 120 L540 170 L700 130 L860 180 L1000 140 L1200 165 L1200 210 L0 210 Z"
          fill={OG_COLORS.tealDeep}
        />
      </svg>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          padding: "64px 72px",
          position: "relative",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Imagen general de marca (landing, /ingresar): logo, un título grande, una bajada y el dominio.
 */
export async function siteOgImage({ title, subtitle }: { title: string; subtitle: string }) {
  const brand = "Costa Turnos";
  const foot = "costaturnos.com";
  const fonts = await ogFonts(title + subtitle + brand + foot);

  return new ImageResponse(
    (
      <OgFrame>
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <OgLogo size={84} />
          <span style={{ fontFamily: "Space Grotesk", fontSize: 44, fontWeight: 600 }}>{brand}</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 60, maxWidth: 960 }}>
          <span
            style={{
              fontFamily: "Space Grotesk",
              fontSize: 76,
              fontWeight: 600,
              lineHeight: 1.05,
              letterSpacing: -1.5,
            }}
          >
            {title}
          </span>
          <span style={{ fontSize: 34, lineHeight: 1.35, marginTop: 24, color: OG_COLORS.whiteSoft }}>
            {subtitle}
          </span>
        </div>

        <span
          style={{ position: "absolute", right: 72, bottom: 52, fontSize: 28, color: OG_COLORS.whiteSoft }}
        >
          {foot}
        </span>
      </OgFrame>
    ),
    { ...OG_SIZE, fonts },
  );
}
