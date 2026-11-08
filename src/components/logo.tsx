import Link from "next/link";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- *
 *  Logo de marca: monograma "CT" sobre un cuadrado turquesa con la cordillera
 *  de fondo (Costa de Araujo, Mendoza).
 *
 *  Es una marca de colores fijos: se ve igual en tema claro y oscuro.
 *  Los mismos trazos están en `src/app/icon.svg` (favicon), `public/logo-mark.svg`
 *  (ícono de notificaciones) y `public/brand/*.png` (fotos de perfil). Si cambiás
 *  el dibujo acá, actualizá esos archivos también.
 * -------------------------------------------------------------------------- */

export const BRAND_COLORS = {
  tile: "#2E9A9C",
  mountains: "#247F81",
  mark: "#FFFFFF",
} as const;

const markSizes = {
  sm: "size-7",
  md: "size-8",
  lg: "size-9",
  xl: "size-12",
} as const;

const textSizes = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
  xl: "text-lg",
} as const;

export type LogoSize = keyof typeof markSizes;

/**
 * Marca sola (sin texto). SVG inline: nítida en cualquier tamaño y sin pedir archivos.
 * La cordillera sigue el borde redondeado del cuadrado, así no hace falta clipPath
 * (y no hay ids repetidos cuando el logo aparece varias veces en la página).
 */
export function LogoMark({
  size = "lg",
  className,
}: {
  size?: LogoSize;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn("shrink-0 rounded-[25%]", markSizes[size], className)}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="48" height="48" rx="12" fill={BRAND_COLORS.tile} />
      <path
        d="M0 36L7 33L12 37L20 28L28 36L33 31L41 37L48 33.5V36A12 12 0 0 1 36 48H12A12 12 0 0 1 0 36Z"
        fill={BRAND_COLORS.mountains}
      />
      <g
        fill="none"
        stroke={BRAND_COLORS.mark}
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M34.6 14.4A14.5 14.5 0 1 0 34.6 33.6" />
        <path d="M18 18H30M24 18V31" />
      </g>
    </svg>
  );
}

interface LogoProps {
  /** Tamaño de la marca. */
  size?: LogoSize;
  /** Mostrar el texto "Costa Turnos" al lado de la marca. */
  showText?: boolean;
  /** Si se pasa, envuelve el logo en un Link a ese destino. */
  href?: string;
  className?: string;
}

/** Logo completo (marca + texto opcional), para headers y shells. */
export function Logo({
  size = "lg",
  showText = true,
  href,
  className,
}: LogoProps) {
  const inner = (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark size={size} />
      {showText && (
        <span
          className={cn(
            "font-display font-semibold tracking-tight",
            textSizes[size],
          )}
        >
          Costa Turnos
        </span>
      )}
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center" aria-label="Costa Turnos">
        {inner}
      </Link>
    );
  }
  return inner;
}
