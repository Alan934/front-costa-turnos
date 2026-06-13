"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useMyMemberships } from "@/lib/api/comercios";
import type { MembershipWithComercio } from "@/mocks/contract-extensions";

/** Un comercio donde el profesional puede operar (derivado de su membresía activa). */
export interface ComercioOption {
  comercioId: string;
  name: string;
  isPersonal: boolean;
}

interface ComercioContextValue {
  /** Comercios donde el profesional trabaja (membresías activas). */
  options: ComercioOption[];
  /** Comercio activo (Servicios/Horarios operan sobre éste). `null` mientras carga. */
  activeId: string | null;
  active: ComercioOption | null;
  setActiveId: (id: string) => void;
  loading: boolean;
  isError: boolean;
}

const ComercioContext = createContext<ComercioContextValue | null>(null);

const STORAGE_KEY = "costa-active-comercio";

/** Mapea las membresías a opciones simples; solo las que tienen comercio activo embebido. */
function toOptions(memberships: MembershipWithComercio[] | undefined): ComercioOption[] {
  return (memberships ?? [])
    .filter((m) => m.status === "active" && m.comercio)
    .map((m) => ({
      comercioId: m.comercioId,
      name: m.comercio!.name,
      isPersonal: m.comercio!.isPersonal,
    }));
}

/**
 * Provee el "comercio activo" del panel del profesional. Lo elige un selector global en el
 * shell; Servicios y Horarios leen `active.comercioId` para llamar a los endpoints por-comercio.
 * Se persiste en localStorage; por defecto arranca en el comercio-de-uno (`isPersonal`).
 */
export function ComercioProvider({ children }: { children: ReactNode }) {
  const { data, isLoading, isError } = useMyMemberships();
  const options = useMemo(() => toOptions(data), [data]);
  const [activeId, setActiveIdState] = useState<string | null>(null);

  // Elige/normaliza el comercio activo cuando llegan las opciones.
  useEffect(() => {
    if (options.length === 0) return;
    setActiveIdState((prev) => {
      if (prev && options.some((o) => o.comercioId === prev)) return prev;
      const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      if (stored && options.some((o) => o.comercioId === stored)) return stored;
      // Default: el comercio-de-uno; si no hay, el primero.
      return (options.find((o) => o.isPersonal) ?? options[0]).comercioId;
    });
  }, [options]);

  function setActiveId(id: string) {
    setActiveIdState(id);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, id);
  }

  const active = options.find((o) => o.comercioId === activeId) ?? null;

  return (
    <ComercioContext.Provider
      value={{
        options,
        activeId,
        active,
        setActiveId,
        loading: isLoading,
        isError,
      }}
    >
      {children}
    </ComercioContext.Provider>
  );
}

export function useActiveComercio() {
  const ctx = useContext(ComercioContext);
  if (!ctx) throw new Error("useActiveComercio debe usarse dentro de <ComercioProvider>");
  return ctx;
}
