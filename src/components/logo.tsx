import Link from "next/link";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- *
 *  Logo de marca: monograma "CT" (Costa Turnos).
 *
 *  Hay DOS variantes y se eligen según el tema:
 *    - light → "outline": cuadrado blanco con borde y CT turquesa.
 *    - dark  → "solid":   cuadrado turquesa con CT blanco.
 *
 *  👉 Para cambiar qué variante usa cada tema, tocá solo VARIANT_BY_THEME.
 *     (No hace falta tocar nada más; el resto se deriva de acá.)
 * -------------------------------------------------------------------------- */
const VARIANT_BY_THEME = {
  light: "outline",
  dark: "solid",
} as const;

type Variant = (typeof VARIANT_BY_THEME)[keyof typeof VARIANT_BY_THEME];

const boxSizes = {
  sm: "size-7 rounded-lg text-[15px]",
  md: "size-8 rounded-lg text-[17px]",
  lg: "size-9 rounded-xl text-[19px]",
  xl: "size-12 rounded-2xl text-[26px]",
} as const;

const textSizes = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
  xl: "text-lg",
} as const;

export type LogoSize = keyof typeof boxSizes;

const variantClasses: Record<Variant, string> = {
  solid: "bg-accent text-accent-foreground",
  outline: "border border-border bg-card text-accent",
};

/** El cuadrado con el monograma "CT", para una variante concreta. */
function LogoBox({
  size,
  variant,
  className,
}: {
  size: LogoSize;
  variant: Variant;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "grid place-items-center font-display font-extrabold leading-none tracking-tighter",
        boxSizes[size],
        variantClasses[variant],
        className,
      )}
      aria-hidden="true"
    >
      CT
    </span>
  );
}

/**
 * Marca sola (sin texto). Muestra la variante outline en claro y solid en
 * oscuro: renderiza ambas y CSS oculta la que no corresponde según `.dark` en
 * <html>. Así no hay parpadeo en la hidratación ni se necesita JS de tema.
 */
export function LogoMark({
  size = "lg",
  className,
}: {
  size?: LogoSize;
  className?: string;
}) {
  return (
    <span className={cn("inline-grid", className)}>
      <LogoBox
        size={size}
        variant={VARIANT_BY_THEME.light}
        className="col-start-1 row-start-1 dark:hidden"
      />
      <LogoBox
        size={size}
        variant={VARIANT_BY_THEME.dark}
        className="col-start-1 row-start-1 hidden dark:grid"
      />
    </span>
  );
}

interface LogoProps {
  /** Tamaño del cuadrado de la marca. */
  size?: LogoSize;
  /** Mostrar el texto "Costa Turnos" al lado de la marca. */
  showText?: boolean;
  /** Si se pasa, envuelve el logo en un Link a ese destino. */
  href?: string;
  className?: string;
}

/**
 * Logo completo (marca + texto opcional). Reemplaza el patrón repetido de
 * `CalendarClock` dentro de un cuadrado en los headers/shells.
 */
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
      <Link href={href} className="inline-flex items-center">
        {inner}
      </Link>
    );
  }
  return inner;
}
