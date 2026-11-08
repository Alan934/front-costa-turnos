import { ImageResponse } from "next/og";
import { OG_COLORS, OG_SIZE, OgFrame, OgLogo, ogFonts } from "@/lib/og";
import { getComercioPublicPage } from "@/lib/api/public-page-server";

/** Imagen al compartir la página de reservas de un comercio (/r/<slug>). */
export const alt = "Reservá tu turno online";
export const size = OG_SIZE;
export const contentType = "image/png";
export const revalidate = 300;

/** Tamaño del nombre según el largo, para que entre en dos líneas como mucho. */
function nameFontSize(name: string) {
  if (name.length <= 16) return 96;
  if (name.length <= 26) return 80;
  if (name.length <= 40) return 64;
  return 52;
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getComercioPublicPage(slug);

  const name = page?.name ?? "Reservá tu turno";
  const address = page?.address?.trim() || null;
  const cta = "Reservá tu turno online";
  const brand = "Costa Turnos";

  const fonts = await ogFonts(name + (address ?? "") + cta + brand + "→");

  return new ImageResponse(
    (
      <OgFrame>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <OgLogo size={56} />
          <span style={{ fontFamily: "Space Grotesk", fontSize: 30, fontWeight: 600, color: OG_COLORS.whiteSoft }}>
            {brand}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 56, maxWidth: 1040 }}>
          <span
            style={{
              fontFamily: "Space Grotesk",
              fontSize: nameFontSize(name),
              fontWeight: 600,
              lineHeight: 1.04,
              letterSpacing: -1.5,
            }}
          >
            {name}
          </span>
          {address && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 22 }}>
              <svg width="30" height="30" viewBox="0 0 24 24">
                <path
                  d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"
                  fill="none"
                  stroke={OG_COLORS.whiteSoft}
                  strokeWidth="2"
                />
                <circle cx="12" cy="10" r="3" fill="none" stroke={OG_COLORS.whiteSoft} strokeWidth="2" />
              </svg>
              <span style={{ fontSize: 32, color: OG_COLORS.whiteSoft }}>{address}</span>
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginTop: 40,
            alignSelf: "flex-start",
            padding: "16px 30px",
            borderRadius: 999,
            background: OG_COLORS.white,
            color: OG_COLORS.tealDeep,
            fontFamily: "Space Grotesk",
            fontSize: 32,
            fontWeight: 600,
          }}
        >
          {cta} →
        </div>
      </OgFrame>
    ),
    { ...size, fonts },
  );
}
