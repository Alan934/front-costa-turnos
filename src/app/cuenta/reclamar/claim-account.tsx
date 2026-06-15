"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MailCheck, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/auth-shell";
import { useAuth } from "@/components/auth-provider";
import { homeForUser } from "@/lib/auth-routing";
import { useAuthRequestClaimCode, useAuthClaim } from "@/lib/api/generated/endpoints/auth/auth";
import { setAuthTokens } from "@/lib/api/axios-instance";
import type { AuthTokensDto } from "@/lib/api/generated/model/authTokensDto";

type Step = "email" | "codigo";

export function ClaimAccount() {
  const router = useRouter();
  const params = useSearchParams();
  const { refresh, user } = useAuth();

  // El email de activación deep-linkea con ?email= (y opcional ?code=). Si viene el email,
  // arrancamos directo en el paso del código (el back ya lo mandó; no pedimos uno nuevo).
  const emailParam = params.get("email") ?? "";
  const [step, setStep] = useState<Step>(emailParam ? "codigo" : "email");
  const [email, setEmail] = useState(emailParam);
  const [code, setCode] = useState((params.get("code") ?? "").replace(/\D/g, "").slice(0, 6));
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [claimed, setClaimed] = useState(false);

  const requestCode = useAuthRequestClaimCode();
  const claim = useAuthClaim();

  function resendCode() {
    setError(null);
    setResent(false);
    requestCode.mutate(
      { data: { email } },
      {
        onSuccess: () => setResent(true),
        onError: () => setError("No pudimos reenviar el código. Revisá el email."),
      },
    );
  }

  // Tras activar, derivamos según el rol (un profesional creado por admin va al panel).
  useEffect(() => {
    if (!claimed || !user) return;
    router.replace(homeForUser(user));
  }, [claimed, user, router]);

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
          if (t?.accessToken) setAuthTokens(t);
          await refresh();
          setClaimed(true);
        },
        onError: () => setError("El código no es válido o expiró."),
      },
    );
  }

  if (step === "email") {
    return (
      <AuthShell
        title="Activá tu cuenta"
        subtitle="Si te crearon una cuenta (tu profesional o el equipo de Costa Turnos), ingresá tu email y te mandamos un código para activarla."
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
          <Button type="submit" className="w-full" size="lg" loading={requestCode.isPending}>
            {requestCode.isPending ? "Enviando…" : "Enviarme el código"}
          </Button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Activá tu cuenta"
      subtitle={`Ingresá el código que te enviamos a ${email} y elegí tu contraseña.`}
      footer={
        <button
          type="button"
          onClick={() => {
            setStep("email");
            setResent(false);
          }}
          className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          Usar otro email
        </button>
      }
    >
      <div className="mb-5 flex items-center gap-3 rounded-lg bg-accent/10 p-3 text-sm text-accent">
        <MailCheck className="size-4 shrink-0" />
        {resent ? "Te reenviamos un código nuevo. Revisá también el spam." : "Revisá tu email (y el spam) para encontrar el código."}
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
        <Button type="submit" className="w-full" size="lg" loading={claim.isPending}>
          {claim.isPending ? "Activando…" : "Activar mi cuenta"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          ¿No te llegó o venció?{" "}
          <button
            type="button"
            onClick={resendCode}
            disabled={requestCode.isPending}
            className="font-medium text-accent hover:underline disabled:opacity-50"
          >
            {requestCode.isPending ? "Reenviando…" : "Reenviá el código"}
          </button>
        </p>
      </form>
    </AuthShell>
  );
}
