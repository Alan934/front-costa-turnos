"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

/**
 * Botón para alternar claro/oscuro. Disponible en todo el sistema (header / topbar).
 * Muestra el icono del modo al que se va a cambiar.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolved, toggle } = useTheme();
  const goingTo = resolved === "dark" ? "claro" : "oscuro";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Cambiar a modo ${goingTo}`}
      title={`Cambiar a modo ${goingTo}`}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
      {resolved === "dark" ? (
        <Sun className="size-4" />
      ) : (
        <Moon className="size-4" />
      )}
    </button>
  );
}
