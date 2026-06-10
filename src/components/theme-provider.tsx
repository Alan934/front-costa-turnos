"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type ThemePref = "light" | "dark" | "system";
type Resolved = "light" | "dark";

interface ThemeContextValue {
  /** Preferencia elegida por el usuario (incluye "system"). */
  theme: ThemePref;
  /** Tema efectivamente aplicado ahora ("light" | "dark"). */
  resolved: Resolved;
  setTheme: (t: ThemePref) => void;
  /** Cicla claro → oscuro → claro (sin pasar por system). */
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = "costa-theme";

function systemPrefersDark() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

function apply(resolved: Resolved) {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePref>("system");
  const [resolved, setResolved] = useState<Resolved>("light");

  // Carga inicial desde localStorage (el anti-flash ya aplicó la clase en el head).
  // `?theme=dark|light` permite forzar el modo (útil para previews/QA).
  useEffect(() => {
    const override = new URLSearchParams(window.location.search).get("theme");
    if (override === "dark" || override === "light") {
      // Override de preview: no se persiste, no pisa la preferencia del usuario.
      setThemeState(override);
      return;
    }
    const stored = (localStorage.getItem(STORAGE_KEY) as ThemePref | null) ?? "system";
    setThemeState(stored);
  }, []);

  // Recalcula el tema efectivo ante cambios de preferencia o del sistema.
  useEffect(() => {
    const compute = (): Resolved =>
      theme === "system" ? (systemPrefersDark() ? "dark" : "light") : theme;
    const next = compute();
    setResolved(next);
    apply(next);

    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const r = systemPrefersDark() ? "dark" : "light";
      setResolved(r);
      apply(r);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((t: ThemePref) => {
    setThemeState(t);
    localStorage.setItem(STORAGE_KEY, t);
  }, []);

  const toggle = useCallback(() => {
    setTheme(resolved === "dark" ? "light" : "dark");
  }, [resolved, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme debe usarse dentro de <ThemeProvider>");
  return ctx;
}

/**
 * Script anti-flash: aplica la clase .dark ANTES de pintar, leyendo localStorage o la
 * preferencia del sistema. Se inyecta en el <head> vía dangerouslySetInnerHTML.
 */
export const themeInitScript = `
(function(){
  try {
    var k = '${STORAGE_KEY}';
    var t = localStorage.getItem(k);
    var dark = t === 'dark' || ((!t || t === 'system') &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
    var el = document.documentElement;
    el.classList.toggle('dark', dark);
    el.style.colorScheme = dark ? 'dark' : 'light';
  } catch(e){}
})();
`;
