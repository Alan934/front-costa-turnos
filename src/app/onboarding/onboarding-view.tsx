"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Store, Link2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/components/auth-provider";
import { useOnboard } from "@/lib/api/generated/endpoints/professionals/professionals";
import type { AxiosError } from "axios";

/** Convierte un nombre en un slug URL-safe (minúsculas, guiones, sin acentos). */
function toSlug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const TIMEZONES = [
  { value: "America/Argentina/Buenos_Aires", label: "Buenos Aires (centro/este)" },
  { value: "America/Argentina/Mendoza", label: "Mendoza" },
  { value: "America/Argentina/Cordoba", label: "Córdoba" },
  { value: "America/Argentina/Salta", label: "Salta / NOA" },
  { value: "America/Argentina/Tucuman", label: "Tucumán" },
  { value: "America/Argentina/Ushuaia", label: "Ushuaia / Sur" },
];

export function OnboardingView() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const onboard = useOnboard();

  const [businessName, setBusinessName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [timezone, setTimezone] = useState(TIMEZONES[0].value);
  const [error, setError] = useState<string | null>(null);

  // Si el profesional ya tiene tenant, no debería estar acá.
  useEffect(() => {
    if (user?.professionalId) router.replace("/app");
  }, [user?.professionalId, router]);

  // El slug sigue al nombre hasta que el usuario lo edita a mano.
  useEffect(() => {
    if (!slugTouched) setSlug(toSlug(businessName));
  }, [businessName, slugTouched]);

  const canSubmit = businessName.trim().length > 1 && slug.length > 1;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    onboard.mutate(
      { data: { businessName: businessName.trim(), slug, timezone } },
      {
        onSuccess: async () => {
          await refresh(); // recarga /auth/me para tomar el professionalId nuevo
          router.replace("/app");
        },
        onError: (err) => {
          const status = (err as AxiosError).response?.status;
          setError(
            status === 409 || status === 400
              ? "Ese enlace ya está en uso o los datos no son válidos. Probá con otro nombre/enlace."
              : "No pudimos crear tu negocio. Probá de nuevo.",
          );
        },
      },
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="mx-auto flex max-w-lg items-center justify-between px-5 py-5">
        <span className="inline-flex items-center gap-2 font-display text-sm font-semibold tracking-tight">
          <span className="grid size-7 place-items-center rounded-lg bg-accent text-accent-foreground">
            <CalendarClock className="size-4" />
          </span>
          Costa Turnos
        </span>
        <ThemeToggle />
      </header>

      <main className="mx-auto max-w-lg px-5 pb-16">
        <div className="mt-4">
          <span className="grid size-12 place-items-center rounded-2xl bg-accent/10 text-accent">
            <Store className="size-6" />
          </span>
          <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight">
            Configurá tu negocio
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Con esto creamos tu agenda y tu página pública para que tus clientes reserven.
            Tenés <strong>15 días de prueba gratis</strong>.
          </p>
        </div>

        <form onSubmit={submit} className="mt-7 space-y-5">
          <div>
            <Label htmlFor="biz">Nombre del negocio</Label>
            <Input
              id="biz"
              className="mt-1.5"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Ej: Peluquería del Pueblo"
              autoFocus
              required
            />
          </div>

          <div>
            <Label htmlFor="slug">Tu enlace público</Label>
            <div className="mt-1.5 flex items-center rounded-lg border border-input bg-card pl-3 focus-within:ring-2 focus-within:ring-ring">
              <Link2 className="size-4 shrink-0 text-muted-foreground" />
              <span className="select-none pl-2 text-sm text-muted-foreground">costaturnos.com.ar/r/</span>
              <input
                id="slug"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(toSlug(e.target.value));
                }}
                placeholder="mi-negocio"
                className="h-10 w-full bg-transparent pr-3 text-sm outline-none"
                required
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Así van a entrar tus clientes. Solo minúsculas, números y guiones.
            </p>
          </div>

          <div>
            <Label htmlFor="tz">Zona horaria</Label>
            <select
              id="tz"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="mt-1.5 h-10 w-full rounded-lg border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" size="lg" className="w-full" loading={onboard.isPending} disabled={!canSubmit}>
            {!onboard.isPending && <Check className="size-4" />}
            {onboard.isPending ? "Creando tu negocio…" : "Crear mi negocio"}
          </Button>
        </form>
      </main>
    </div>
  );
}
