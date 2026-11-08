import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

/** Origen (esquema + host + puerto) de una URL; null si no es válida. */
function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

const apiOrigin = originOf(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000");
/** Despliegue real sobre HTTPS (prod + API por https): recién ahí tiene sentido forzar HTTPS. */
const httpsDeploy = isProd && !!apiOrigin?.startsWith("https://");
const socketOrigin = originOf(process.env.NEXT_PUBLIC_SOCKET_URL) ?? apiOrigin;

/** Equivalente ws/wss de un origen http/https (Socket.IO abre WebSocket). */
function wsOf(origin: string | null): string | null {
  return origin ? origin.replace(/^http/, "ws") : null;
}

/**
 * Content-Security-Policy. Next.js necesita scripts inline (hidratación y el script del tema),
 * por eso `script-src` lleva 'unsafe-inline' (en dev además 'unsafe-eval' por el HMR). Aun así la
 * política bloquea lo más peligroso: cargar scripts de otros orígenes, embeber la app en un
 * iframe (clickjacking), plug-ins, <base> y formularios hacia otros sitios, y limita a dónde puede
 * hablar el JS (connect-src) para dificultar la exfiltración de tokens si hubiera un XSS.
 *
 * Imágenes: las URLs firmadas de MinIO pueden salir de cualquier host https configurado en el
 * back, por eso `img-src https:` (las imágenes no ejecutan código).
 */
function buildCsp(): string {
  const connect = [
    "'self'",
    apiOrigin,
    socketOrigin,
    wsOf(apiOrigin),
    wsOf(socketOrigin),
  ].filter((v, i, a): v is string => !!v && a.indexOf(v) === i);

  const directives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https:${isProd ? "" : " http:"}`,
    "font-src 'self' data:",
    `connect-src ${connect.join(" ")}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (httpsDeploy) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

const securityHeaders = [
  { key: "Content-Security-Policy", value: buildCsp() },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  ...(httpsDeploy
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Toda la UI usa <img> directo (URLs firmadas del storage): no se necesita el optimizador
  // /_next/image. Sin remotePatterns queda cerrado y no puede usarse como proxy de imágenes.
  images: { remotePatterns: [] },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    return [
      // Cobros vivía fuera del panel. El callback OAuth de MercadoPago (back) y links viejos
      // todavía apuntan acá; la query (?mp=connected|error) se conserva en el redirect.
      { source: "/ajustes/pagos", destination: "/app/cobros", permanent: false },
    ];
  },
};

export default nextConfig;
