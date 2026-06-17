"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Store, User, Building2, Scissors } from "lucide-react";
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
type RegType = "cliente" | "profesional" | "comercio";

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
  const { login, register, registerProfessional, registerComercial } = useAuth();

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

  // El nombre del negocio (pro o comercio) genera el slug automáticamente.
  const nameForSlug = regType === "comercio" ? businessName : businessName;
  useEffect(() => {
    if (!slugTouched) setSlug(toSlug(nameForSlug));
  }, [nameForSlug, slugTouched]);

  function switchTab(t: Tab) {
    setTab(t);
    setError(null);
  }

  function switchType(t: RegType) {
    setRegType(t);
    setError(null);
    setSlugTouched(false);
    setSlug(toSlug(businessName));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (tab === "registro" && regType === "profesional") {
        await registerProfessional({
          email,
          password,
          fullName,
          businessName: businessName.trim(),
          slug,
          timezone: DEFAULT_TZ,
          address: address.trim() || undefined,
        });
        router.replace(next ?? "/app");
        return;
      }
      if (tab === "registro" && regType === "comercio") {
        await registerComercial({
          email,
          password,
          comercioName: businessName.trim(),
          slug,
          timezone: DEFAULT_TZ,
          address: address.trim() || undefined,
        });
        router.replace(next ?? "/comercio");
        return;
      }
      if (tab === "registro") {
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
      } else if (status === 409 || (status === 400 && /existe|registrad|ya.*email|email.*ya/i.test(message))) {
        setError(<EmailExistsHelp />);
      } else {
        setError("No pudimos crear la cuenta. Revisá los datos e intentá de nuevo.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const isPro = tab === "registro" && regType === "profesional";
  const isCom = tab === "registro" && regType === "comercio";
  const showBusinessFields = isPro || isCom;

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
            onClick={() => switchTab(t)}
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

      {/* Selector de tipo de cuenta (solo al registrarse) */}
      {tab === "registro" && (
        <div className="mb-5 space-y-2">
          <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            ¿Qué tipo de cuenta necesitás?
          </p>
          <RegTypeCard
            active={regType === "cliente"}
            onClick={() => switchType("cliente")}
            icon={<User className="size-4" />}
            title="Soy cliente"
            description="Reservá turnos con profesionales y llevá el seguimiento de tu historial."
          />
          <RegTypeCard
            active={regType === "profesional"}
            onClick={() => switchType("profesional")}
            icon={<Scissors className="size-4" />}
            title="Soy profesional"
            description="Manejá tu agenda, recibí reservas online y obtené tu propia página pública. Podés trabajar de forma independiente o sumarte al comercio de otro."
          />
          <RegTypeCard
            active={regType === "comercio"}
            onClick={() => switchType("comercio")}
            icon={<Building2 className="size-4" />}
            title="Administro un comercio"
            description="Creá un negocio que agrupa varios profesionales bajo una sola página pública. Cada profesional se registra con su propio email y después lo invitás a unirse."
            note="Usá un email diferente al de los profesionales que van a trabajar en tu negocio."
          />
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-3.5">
        {/* Nombre personal (no aplica al comercio, que no tiene persona física) */}
        {tab === "registro" && regType !== "comercio" && (
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
          <Label htmlFor="email">
            {isCom ? "Email del comercio" : "Email"}
          </Label>
          {isCom && (
            <p className="mb-1.5 mt-0.5 text-xs text-muted-foreground">
              Este email será el acceso al panel del comercio, no el de los profesionales.
            </p>
          )}
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

        {/* Datos del negocio (profesional o comercio) */}
        {showBusinessFields && (
          <>
            <div>
              <Label htmlFor="businessName">
                {isCom ? "Nombre del comercio" : "Nombre de tu negocio o perfil"}
              </Label>
              <p className="mb-1.5 mt-0.5 text-xs text-muted-foreground">
                {isCom
                  ? "Así va a aparecer en la página pública y en la app."
                  : "Así te van a ver los clientes. Puede ser tu nombre, tu marca o tu salón."}
              </p>
              <Input
                id="businessName"
                className="mt-1.5"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder={isCom ? "Studio 34" : "Peluquería del Pueblo"}
                required
              />
            </div>

            <div>
              <Label htmlFor="slug">Dirección de la página pública</Label>
              <p className="mb-1.5 mt-0.5 text-xs text-muted-foreground">
                Tus clientes van a reservar desde esta URL. No se puede cambiar después.
              </p>
              <div className="flex items-center rounded-lg border border-input bg-card pl-3 focus-within:ring-2 focus-within:ring-ring">
                <span className="select-none text-sm text-muted-foreground">/r/</span>
                <input
                  id="slug"
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(toSlug(e.target.value));
                  }}
                  placeholder="mi-negocio"
                  className="h-10 w-full bg-transparent px-2 text-sm outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="address">
                Dirección <span className="text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="address"
                className="mt-1.5"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Belgrano 245, Costa de Araujo"
              />
            </div>

            {/* Recordatorio de emails separados para el comercio */}
            {isCom && (
              <div className="flex gap-2.5 rounded-xl border border-warning/40 bg-warning/10 p-3.5 text-xs text-warning-foreground">
                <Store className="mt-0.5 size-4 shrink-0" />
                <p>
                  <strong>Recordá:</strong> los profesionales que invites deben registrarse
                  con sus propios emails antes de sumarse al comercio. El email que usás acá
                  es solo para administrar el negocio.
                </p>
              </div>
            )}
          </>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <Button type="submit" className="w-full" size="lg" loading={submitting}>
          {tab === "login"
            ? "Ingresar"
            : regType === "cliente"
              ? "Crear cuenta de cliente"
              : regType === "profesional"
                ? "Crear mi cuenta profesional"
                : "Crear cuenta del comercio"}
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
  description,
  note,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  title: string;
  description: string;
  note?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-xl border p-3.5 text-left transition-colors",
        active ? "border-accent bg-accent/10" : "border-border hover:border-accent/50",
      )}
    >
      <span
        className={cn(
          "mb-1 flex items-center gap-1.5 text-sm font-semibold",
          active ? "text-accent" : "text-foreground",
        )}
      >
        {icon}
        {title}
      </span>
      <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
      {note && active && (
        <p className="mt-2 text-xs font-medium text-warning-foreground">{note}</p>
      )}
    </button>
  );
}

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
