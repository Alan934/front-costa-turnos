"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RefreshButtonProps {
  onClick: () => void;
  /** Mientras refetchea: ícono girando + botón deshabilitado para evitar dobles clics. */
  fetching?: boolean;
  label?: string;
  className?: string;
}

/**
 * Botón "Actualizar" para vistas con datos que cambian solos (agenda, mis turnos).
 * El ícono gira mientras hay un refetch en curso. En pantallas chicas queda solo el ícono.
 */
export function RefreshButton({
  onClick,
  fetching = false,
  label = "Actualizar",
  className,
}: RefreshButtonProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={fetching}
      aria-label={label}
      title={label}
      className={className}
    >
      <RefreshCw className={cn("size-4", fetching && "animate-spin")} />
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}
