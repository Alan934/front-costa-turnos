"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { AuthShell } from "@/components/auth-shell";
import { GoogleButton } from "@/components/google-button";
import { useAuth } from "@/components/auth-provider";
import { cn } from "@/lib/utils";
import type { MeResponse } from "@/mocks/contract-extensions";

type Tab = "login" | "registro";

export function LoginRegister() {
  const [tab, setTab] = useState<Tab>("login");
  const router = useRouter();
  const { login, register } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function routeByRole(user: MeResponse) {
    if (user.roles.includes("professional")) {
      // Profesional sin tenant todavía: completa el onboarding primero.
      router.replace(user.professionalId ? "/app" : "/onboarding");
    } else if (user.roles.includes("admin")) {
      router.replace("/admin/profesionales");
    } else {
      router.replace("/mis-turnos");
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (tab === "registro") {
        // Registrarse acá = crear tu cuenta para gestionar turnos → onboarding del negocio.
        await register({ email, password, fullName });
        router.replace("/onboarding");
        return;
      }
      const user = await login({ email, password });
      routeByRole(user);
    } catch {
      setError(
        tab === "login"
          ? "Email o contraseña incorrectos."
          : "No pudimos crear la cuenta. Revisá los datos.",
      );
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

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" className="w-full" size="lg" disabled={submitting}>
          {submitting ? <Spinner /> : null}
          {tab === "login" ? "Ingresar" : "Crear cuenta"}
        </Button>
      </form>
    </AuthShell>
  );
}
