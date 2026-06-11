"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MailCheck, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/auth-shell";
import { useRequestPasswordReset, useResetPassword } from "@/lib/api/generated/endpoints/auth/auth";

type Step = "email" | "codigo" | "listo";

export function RecoverPassword() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const requestReset = useRequestPasswordReset();
  const reset = useResetPassword();

  function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    requestReset.mutate(
      { data: { email } },
      {
        // Por privacidad respondemos igual aunque el email no exista.
        onSuccess: () => setStep("codigo"),
        onError: () => setStep("codigo"),
      },
    );
  }

  function confirmReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    reset.mutate(
      { data: { email, code, newPassword } },
      {
        onSuccess: () => setStep("listo"),
        onError: () => setError("El código no es válido o expiró."),
      },
    );
  }

  if (step === "listo") {
    return (
      <AuthShell title="¡Contraseña actualizada!" subtitle="Ya podés ingresar con tu nueva contraseña.">
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-success/10 text-success">
            <CheckCircle2 className="size-6" />
          </span>
          <Button className="w-full" size="lg" onClick={() => router.replace("/ingresar")}>
            Ir a ingresar
          </Button>
        </div>
      </AuthShell>
    );
  }

  if (step === "email") {
    return (
      <AuthShell
        title="Recuperar contraseña"
        subtitle="Ingresá tu email y te mandamos un código para crear una nueva contraseña."
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
          <Button type="submit" className="w-full" size="lg" loading={requestReset.isPending}>
            {requestReset.isPending ? "Enviando…" : "Enviarme el código"}
          </Button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Revisá tu email"
      subtitle={`Te enviamos un código a ${email}. Ingresalo y elegí tu nueva contraseña.`}
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
        Si el email existe, te llegó un código. Revisá también el spam.
      </div>
      <form onSubmit={confirmReset} className="space-y-4">
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
          <Label htmlFor="newPassword">Nueva contraseña</Label>
          <PasswordInput
            id="newPassword"
            className="mt-1.5"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" size="lg" loading={reset.isPending}>
          {reset.isPending ? "Guardando…" : "Cambiar contraseña"}
        </Button>
      </form>
    </AuthShell>
  );
}
