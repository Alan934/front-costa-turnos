"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MailCheck, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { AuthShell } from "@/components/auth-shell";
import { useAuth } from "@/components/auth-provider";
import { useRequestClaimCode, useClaim } from "@/lib/api/generated/endpoints/auth/auth";
import { setAccessToken } from "@/lib/api/axios-instance";
import type { AuthTokensDto } from "@/lib/api/generated/model/authTokensDto";

type Step = "email" | "codigo";

export function ClaimAccount() {
  const router = useRouter();
  const { refresh } = useAuth();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const requestCode = useRequestClaimCode();
  const claim = useClaim();

  function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    requestCode.mutate(
      { data: { email } },
      {
        onSuccess: () => setStep("codigo"),
        onError: () => setError("No encontramos una cuenta con ese email."),
      },
    );
  }

  function confirmClaim(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    claim.mutate(
      { data: { email, code, password } },
      {
        onSuccess: async (tokens) => {
          const t = tokens as unknown as AuthTokensDto;
          if (t?.accessToken) setAccessToken(t.accessToken);
          await refresh();
          router.replace("/mis-turnos");
        },
        onError: () => setError("El código no es válido o expiró."),
      },
    );
  }

  if (step === "email") {
    return (
      <AuthShell
        title="Reclamá tu cuenta"
        subtitle="Tu profesional ya te creó una cuenta. Ingresá tu email y te mandamos un código para activarla."
        footer={
          <Link href="/ingresar" className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
            <ArrowLeft className="size-3.5" />
            Volver a ingresar
          </Link>
        }
      >
        <form onSubmit={sendCode} className="space-y-4">
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
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" size="lg" disabled={requestCode.isPending}>
            {requestCode.isPending ? <Spinner /> : null}
            Enviarme el código
          </Button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Revisá tu email"
      subtitle={`Te enviamos un código a ${email}. Ingresalo y elegí tu contraseña.`}
      footer={
        <button
          type="button"
          onClick={() => setStep("email")}
          className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          Usar otro email
        </button>
      }
    >
      <div className="mb-5 flex items-center gap-3 rounded-lg bg-accent/10 p-3 text-sm text-accent">
        <MailCheck className="size-4 shrink-0" />
        Código enviado. Revisá también el spam.
      </div>
      <form onSubmit={confirmClaim} className="space-y-4">
        <div>
          <Label htmlFor="code">Código de 6 dígitos</Label>
          <Input
            id="code"
            className="mt-1.5 text-center font-display text-lg tracking-[0.4em]"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="123456"
            inputMode="numeric"
            required
          />
        </div>
        <div>
          <Label htmlFor="password">Elegí tu contraseña</Label>
          <PasswordInput
            id="password"
            className="mt-1.5"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" size="lg" disabled={claim.isPending}>
          {claim.isPending ? <Spinner /> : null}
          Activar mi cuenta
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Demo: el código es <strong>123456</strong>.
        </p>
      </form>
    </AuthShell>
  );
}
