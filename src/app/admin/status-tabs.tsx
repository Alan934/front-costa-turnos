"use client";

import { cn } from "@/lib/utils";
import type { ListStatusFilter } from "@/lib/api/generated/model/listStatusFilter";

/**
 * Pestañas Activos / Eliminados para los listados de admin. Mapean a `?status=` del
 * endpoint, así cada pestaña pagina sobre su propio total real (el back filtra en la
 * query). `all` no se ofrece como pestaña: por defecto se muestran los activos.
 */
export function StatusTabs({
  value,
  onChange,
}: {
  value: ListStatusFilter;
  onChange: (status: ListStatusFilter) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Tab active={value === "active"} onClick={() => onChange("active")}>
        Activos
      </Tab>
      <Tab active={value === "deleted"} onClick={() => onChange("deleted")}>
        Eliminados
      </Tab>
    </div>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted",
      )}
      aria-pressed={active ? "true" : "false"}
    >
      {children}
    </button>
  );
}
