"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Store, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/auth-shell";
import { GoogleButton } from "@/components/google-button";
import { useAuth } from "@/components/auth-provider";
import { homeForUser } from "@/lib/auth-routing";
import { cn } from "@/lib/utils";
import type { AxiosError } from "axios";
import type { ReactNode } from "react";

type Tab = "login" | "registro";
type RegType = "cliente" | "profesional";

const DEFAULT_TZ = "America/Argentina/Buenos_Aires";

function toSlug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function LoginRegister() {
  const [tab, setTab] = useState<Tab>("login");
  const [regType, setRegType] = useState<RegType>("cliente");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, register, registerProfessional } = useAuth();

  // `next` permite volver al destino original (p. ej. aceptar una invitación) tras autenticarse.
  // Solo aceptamos rutas internas para evitar redirecciones abiertas.
  const rawNext = searchParams.get("next");
  const next = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [address, setAddress] = useState("");
  const [error, setError] = useState<ReactNode>(null);
  const [submitting, setSubmitting] = useState(false);

  const isPro = tab === "registro" && regType === "profesional";

  useEffect(() => {
    if (!slugTouched) setSlug(toSlug(businessName));
  }, [businessName, slugTouched]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (tab === "registro" && regType === "profesional") {
        // Profesional: crea cuenta + profesional + comercio-de-uno + trial, en una.
        await registerProfessional({
          email,
          password,
          fullName,
          businessName: businessName.trim(),
          slug,
          timezone: DEFAULT_TZ,
          address: address.trim() || undefined,
        });
        // Si vino de una invitación (next), volvemos ahí; si no, sigue el onboarding.
        router.replace(next ?? "/onboarding");
        return;
      }
      if (tab === "registro") {
        // Cliente.
        const user = await register({ email, password, fullName });
        router.replace(next ?? homeForUser(user));
        return;
      }
      const user = await login({ email, password });
      router.replace(next ?? homeForUser(user));
    } catch (err) {
      const ax = err as AxiosError<{ message?: string }>;
      const status = ax.response?.status;
      const message = ax.response?.data?.message ?? "";
      if (tab === "login") {
        setError("Email o contraseña incorrectos.");
      } else if (status === 400 && /existe|registrad|ya.*email|email.*ya/i.test(message)) {
        // El email ya tiene cuenta: orientamos según el caso.
        setError(<EmailExistsHelp />);
      } else {
        setError("No pudimos crear la cuenta. Revisá los datos.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title={tab === "login" ? "Bienvenido de nuevo" : "Creá tu cuenta"}
      subtitle="Gestioná tus turnos sin vueltas."
      footer={
        <>
          ¿Te creó la cuenta un profesional?{" "}
          <Link href="/cuenta/reclamar" className="font-medium text-accent hover:underline">
            Reclamala acá
          </Link>
        </>
      }
    >
      {/* Tabs */}
      <div className="mb-5 grid grid-cols-2 rounded-lg bg-muted p-1 text-sm font-medium">
        {(["login", "registro"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t);
              setError(null);
            }}
            className={cn(
              "rounded-md py-1.5 capitalize transition-colors",
              tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            {t === "login" ? "Ingresar" : "Registrarme"}
          </button>
        ))}
      </div>

      <GoogleButton />

      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />o con tu email<span className="h-px flex-1 bg-border" />
      </div>

      {/* ¿Cliente o profesional? (solo al registrarse) */}
      {tab === "registro" && (
        <div className="mb-4 grid grid-cols-2 gap-2">
          <RegTypeCard
            active={regType === "cliente"}
            onClick={() => { setRegType("cliente"); setError(null); }}
            icon={<User className="size-4" />}
            title="Soy cliente"
            hint="Para reservar turnos"
          />
          <RegTypeCard
            active={regType === "profesional"}
            onClick={() => { setRegType("profesional"); setError(null); }}
            icon={<Store className="size-4" />}
            title="Tengo un negocio"
            hint="Gestiono mis turnos"
          />
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-3.5">
        {tab === "registro" && (
          <div>
            <Label htmlFor="fullName">Nombre y apellido</Label>
            <Input
              id="fullName"
              className="mt-1.5"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Sofía Pérez"
              autoComplete="name"
              required
            />
          </div>
        )}
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            className="mt-1.5"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vos@email.com"
            autoComplete="email"
            required
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Contraseña</Label>
            {tab === "login" && (
              <Link
                href="/cuenta/recuperar"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                ¿La olvidaste?
              </Link>
            )}
          </div>
          <PasswordInput
            id="password"
            className="mt-1.5"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={tab === "registro" ? "Mínimo 8 caracteres" : "••••••••"}
            autoComplete={tab === "login" ? "current-password" : "new-password"}
            minLength={tab === "registro" ? 8 : undefined}
            required
          />
        </div>

        {/* Datos del negocio (registro profesional) */}
        {isPro && (
          <>
            <div>
              <Label htmlFor="businessName">Nombre del negocio</Label>
              <Input
                id="businessName"
                className="mt-1.5"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Peluquería del Pueblo"
                required
              />
            </div>
            <div>
              <Label htmlFor="slug">Tu enlace público</Label>
              <div className="mt-1.5 flex items-center rounded-lg border border-input bg-card pl-3 focus-within:ring-2 focus-within:ring-ring">
                <span className="select-none text-sm text-muted-foreground">/r/</span>
                <input
                  id="slug"
                  value={slug}
                  onChange={(e) => { setSlugTouched(true); setSlug(toSlug(e.target.value)); }}
                  placeholder="mi-negocio"
                  className="h-10 w-full bg-transparent px-2 text-sm outline-none"
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="address">Dirección <span className="text-muted-foreground">(opcional)</span></Label>
              <Input
                id="address"
                className="mt-1.5"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Belgrano 245, Costa de Araujo"
              />
            </div>
          </>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <Button type="submit" className="w-full" size="lg" loading={submitting}>
          {submitting
            ? tab === "login"
              ? "Ingresando…"
              : "Creando cuenta…"
            : tab === "login"
              ? "Ingresar"
              : "Crear cuenta"}
        </Button>
      </form>
    </AuthShell>
  );
}

function RegTypeCard({
  active,
  onClick,
  icon,
  title,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-0.5 rounded-xl border p-3 text-left transition-colors",
        active ? "border-accent bg-accent/10" : "border-border hover:border-accent/50",
      )}
    >
      <span className={cn("flex items-center gap-1.5 text-sm font-medium", active ? "text-accent" : "text-foreground")}>
        {icon}
        {title}
      </span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </button>
  );
}

/** Mensaje cuando el email ya tiene cuenta: orienta a recuperar o activar. */
function EmailExistsHelp() {
  return (
    <div className="space-y-1.5">
      <p className="font-medium">Ya existe una cuenta con ese email.</p>
      <ul className="list-disc space-y-1 pl-4 text-destructive/90">
        <li>
          ¿Olvidaste tu contraseña?{" "}
          <Link href="/cuenta/recuperar" className="font-medium underline">
            Recuperala
          </Link>
          .
        </li>
        <li>
          ¿Te creó la cuenta un profesional y todavía no tenés contraseña?{" "}
          <Link href="/cuenta/reclamar" className="font-medium underline">
            Activá tu cuenta
          </Link>
          .
        </li>
      </ul>
    </div>
  );
}
