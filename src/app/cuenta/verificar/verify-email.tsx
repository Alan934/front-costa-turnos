"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MailCheck, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/auth-shell";
import { useAuthRequestEmailCode, useAuthVerifyEmail } from "@/lib/api/generated/endpoints/auth/auth";

type Step = "email" | "codigo" | "listo";

export function VerifyEmail() {
  const params = useSearchParams();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const requestCode = useAuthRequestEmailCode();
  const verify = useAuthVerifyEmail();

  // Si llega ?email= (p.ej. tras registrarse), lo precargamos.
  useEffect(() => {
    const e = params.get("email");
    if (e) setEmail(e);
  }, [params]);

  function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    requestCode.mutate(
      { data: { email } },
      { onSuccess: () => setStep("codigo"), onError: () => setStep("codigo") },
    );
  }

  function confirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    verify.mutate(
      { data: { email, code } },
      {
        onSuccess: () => setStep("listo"),
        onError: () => setError("El código no es válido o expiró."),
      },
    );
  }

  if (step === "listo") {
    return (
      <AuthShell title="¡Email verificado!" subtitle="Tu correo quedó confirmado.">
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-success/10 text-success">
            <CheckCircle2 className="size-6" />
          </span>
          <Button className="w-full" size="lg" asChild>
            <Link href="/app">Ir a mi panel</Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  if (step === "email") {
    return (
      <AuthShell
        title="Verificá tu email"
        subtitle="Te mandamos un código para confirmar tu correo."
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
          <Button type="submit" className="w-full" size="lg" loading={requestCode.isPending}>
            {requestCode.isPending ? "Enviando…" : "Enviarme el código"}
          </Button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Revisá tu email"
      subtitle={`Te enviamos un código a ${email}.`}
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
      <form onSubmit={confirm} className="space-y-4">
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
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" size="lg" loading={verify.isPending}>
          {verify.isPending ? "Verificando…" : "Verificar email"}
        </Button>
      </form>
    </AuthShell>
  );
}
