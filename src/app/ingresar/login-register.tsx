"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Store, User, Scissors, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/auth-shell";
import { GoogleButton } from "@/components/google-button";
import { useAuth } from "@/components/auth-provider";
import { useAuthRequestClaimCode } from "@/lib/api/generated/endpoints/auth/auth";
import { axiosInstance } from "@/lib/api/axios-instance";
import { resolvePostAuthPath, saveAuthIntent } from "@/lib/auth-intent";
import { safeNextPath } from "@/lib/safe-redirect";
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, loginWithCode, register, registerComercial } = useAuth();

  const next = safeNextPath(searchParams.get("next"));

  // Pre-carga desde una invitación a comercio: email fijo + (opcional) alta de profesional.
  const invitedEmail = searchParams.get("email") ?? "";
  const forceRegType = searchParams.get("registro") as RegType | null;
  const invited = !!invitedEmail;

  const [tab, setTab] = useState<Tab>(forceRegType ? "registro" : "login");
  // Sin tipo preseleccionado: quien se registra elige primero qué es. Así "Continuar con
  // Google" ya sabe si tiene que llevarlo al asistente del profesional o al área de cliente.
  const [regType, setRegType] = useState<RegType | null>(
    forceRegType === "profesional" || forceRegType === "comercio" || forceRegType === "cliente"
      ? forceRegType
      : null,
  );

  const [email, setEmail] = useState(invitedEmail);
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [address, setAddress] = useState("");
  const [error, setError] = useState<ReactNode>(null);
  // Si el email tiene una cuenta pendiente de activar (la creó un profesional), el back manda un
  // código por mail y hay que ingresarlo para tomarla: prueba que el email es de quien se registra.
  const [needsCode, setNeedsCode] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const requestClaimCode = useAuthRequestClaimCode();

  function resendCode() {
    setError(null);
    requestClaimCode.mutate(
      { data: { email } },
      {
        onSuccess: () => setInfo("Listo, te mandamos un código nuevo. Puede tardar un minuto."),
        onError: () => setError("No pudimos reenviar el código. Probá de nuevo en un momento."),
      },
    );
  }

  // Ingreso sin contraseña: se pide un código por email y se canjea por la sesión.
  const [codeLogin, setCodeLogin] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [loginCode, setLoginCode] = useState("");

  function toggleCodeLogin(on: boolean) {
    setCodeLogin(on);
    setCodeSent(false);
    setLoginCode("");
    setError(null);
    setInfo(null);
  }

  async function sendLoginCode() {
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      await axiosInstance.post("/auth/request-login-code", { email });
      setCodeSent(true);
      setInfo(
        `Si hay una cuenta con ${email}, te mandamos un código de 6 dígitos. Puede tardar un minuto; revisá también el spam.`,
      );
    } catch (err) {
      const status = (err as AxiosError).response?.status;
      setError(
        status === 429
          ? "Pediste muchos códigos seguidos. Esperá un minuto y probá de nuevo."
          : "No pudimos enviar el código. Revisá el email y tu conexión.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  // El nombre del comercio genera el enlace público automáticamente.
  useEffect(() => {
    if (!slugTouched) setSlug(toSlug(businessName));
  }, [businessName, slugTouched]);

  function switchTab(t: Tab) {
    setCodeLogin(false);
    setCodeSent(false);
    setTab(t);
    setError(null);
    setInfo(null);
  }

  function switchType(t: RegType | null) {
    setRegType(t);
    setError(null);
    setInfo(null);
  }

  const isRegister = tab === "registro";
  const isCodeLogin = tab === "login" && codeLogin;
  const isPro = isRegister && regType === "profesional";
  const isCom = isRegister && regType === "comercio";
  // En el registro, primero se elige el tipo de cuenta; recién después aparece el formulario.
  const choosingType = isRegister && regType === null;

  /** Antes de salir a Google: recordar qué eligió y a dónde quería volver. */
  function rememberIntent() {
    saveAuthIntent({ role: isPro ? "profesional" : undefined, next: next ?? undefined });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isCodeLogin) {
      if (!codeSent) {
        await sendLoginCode();
        return;
      }
      setError(null);
      setSubmitting(true);
      try {
        const user = await loginWithCode({ email, code: loginCode });
        router.replace(resolvePostAuthPath(user, next));
      } catch (err) {
        const status = (err as AxiosError).response?.status;
        setError(
          status === 403
            ? "Tu cuenta está bloqueada. Escribinos si creés que es un error."
            : status === 429
              ? "Demasiados intentos. Esperá un minuto y probá de nuevo."
              : "El código es incorrecto o venció. Pedí uno nuevo y probá de nuevo.",
        );
      } finally {
        setSubmitting(false);
      }
      return;
    }
    setError(null);
    setInfo(null);
    setSubmitting(true);
    const code = needsCode && verificationCode.length === 6 ? verificationCode : undefined;
    try {
      if (isCom) {
        await registerComercial({
          email,
          password,
          comercioName: businessName.trim(),
          slug,
          timezone: DEFAULT_TZ,
          address: address.trim() || undefined,
          verificationCode: code,
        });
        router.replace(next ?? "/comercio");
        return;
      }
      if (isRegister) {
        // Profesional y cliente crean la MISMA cuenta básica. El profesional sigue en el
        // asistente (/onboarding), donde arma su negocio: el registro queda en 3 campos y no
        // puede fallar a mitad de camino por un enlace público ya tomado.
        const user = await register({ email, password, fullName, verificationCode: code });
        if (isPro) {
          saveAuthIntent({
            role: "profesional",
            next: next ?? undefined,
            email: user.email.toLowerCase(),
          });
        }
        router.replace(resolvePostAuthPath(user, next));
        return;
      }
      const user = await login({ email, password });
      router.replace(resolvePostAuthPath(user, next));
    } catch (err) {
      const ax = err as AxiosError<{ message?: string; error?: string }>;
      const status = ax.response?.status;
      const message = String(ax.response?.data?.message ?? "");
      if (!ax.response) {
        setError("No pudimos conectarnos. Revisá tu conexión a internet y probá de nuevo.");
      } else if (status === 429) {
        setError(
          tab === "login" ? (
            <>
              Demasiados intentos seguidos. Esperá unos minutos o{" "}
              <Link href="/cuenta/recuperar" className="font-medium underline">
                recuperá tu contraseña
              </Link>
              .
            </>
          ) : (
            "Demasiados intentos seguidos. Esperá un minuto y probá de nuevo."
          ),
        );
      } else if (tab === "login") {
        setError(
          status === 403
            ? "Tu cuenta está bloqueada. Escribinos si creés que es un error."
            : status === 401 || status === 400
              ? "Email o contraseña incorrectos. Si creaste tu cuenta con Google, ingresá con el botón de Google."
              : "No pudimos iniciar tu sesión. Probá de nuevo en un momento.",
        );
      } else if (status === 409 && ax.response?.data?.error === "claim_required") {
        setNeedsCode(true);
        setVerificationCode("");
        setInfo(
          "Ese email ya tiene una cuenta pendiente de activar. Te mandamos un código de 6 dígitos para confirmar que es tuyo: ingresalo abajo.",
        );
      } else if (needsCode && status === 400 && /codigo|código/i.test(message)) {
        setError("El código es incorrecto o venció. Pedí uno nuevo y probá de nuevo.");
      } else if (status === 409 && /slug|enlace/i.test(message)) {
        setError("Esa dirección de página pública ya está en uso. Probá con otra.");
      } else if (
        status === 409 ||
        (status === 400 && /existe|registrad|ya.*email|email.*ya/i.test(message))
      ) {
        setError(<EmailExistsHelp />);
      } else {
        setError("No pudimos crear la cuenta. Revisá los datos e intentá de nuevo.");
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

      {/* Paso 1 del registro: qué tipo de cuenta */}
      {choosingType && (
        <div className="space-y-2">
          <p className="mb-2 text-sm font-medium">¿Cómo vas a usar la app?</p>
          <RegTypeCard
            onClick={() => switchType("profesional")}
            icon={<Scissors className="size-4" />}
            title="Soy profesional"
            description="Quiero mi agenda y recibir reservas online."
          />
          <RegTypeCard
            onClick={() => switchType("cliente")}
            icon={<User className="size-4" />}
            title="Soy cliente"
            description="Quiero reservar turnos."
          />
          <button
            type="button"
            onClick={() => switchType("comercio")}
            className="block w-full pt-2 text-center text-xs text-muted-foreground hover:text-foreground"
          >
            ¿Administrás un comercio con varios profesionales?{" "}
            <span className="font-medium text-accent">Creá la cuenta del comercio</span>
          </button>
        </div>
      )}

      {!choosingType && (
        <>
          {/* Tipo elegido + volver a elegir */}
          {isRegister && (
            <button
              type="button"
              onClick={() => switchType(null)}
              className="mb-4 flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2 text-left text-sm hover:border-accent/50"
            >
              <ArrowLeft className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">
                  {isPro ? "Cuenta de profesional" : isCom ? "Cuenta de comercio" : "Cuenta de cliente"}
                </span>
                {isPro && (
                  <span className="block text-xs text-muted-foreground">
                    Creás tu cuenta y después armás tu negocio en un par de minutos.
                  </span>
                )}
              </span>
              <span className="shrink-0 text-xs text-accent">Cambiar</span>
            </button>
          )}

          {/* Google: no aplica al comercio (necesita los datos del negocio en el alta). */}
          {!isCom && (
            <>
              <GoogleButton
                label={isRegister ? "Registrarme con Google" : "Continuar con Google"}
                onBeforeRedirect={rememberIntent}
              />
              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />o con tu email
                <span className="h-px flex-1 bg-border" />
              </div>
            </>
          )}

          <form onSubmit={onSubmit} className="space-y-3.5">
            {/* Nombre personal (no aplica al comercio, que no tiene persona física) */}
            {isRegister && !isCom && (
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
              <Label htmlFor="email">{isCom ? "Email del comercio" : "Email"}</Label>
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
                readOnly={invited}
                aria-readonly={invited}
              />
              {invited && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Usá este email: es al que llegó la invitación del comercio.
                </p>
              )}
            </div>

            {isCodeLogin && codeSent && (
              <div>
                <Label htmlFor="loginCode">Código que te enviamos por email</Label>
                <Input
                  id="loginCode"
                  className="mt-1.5 tracking-widest"
                  value={loginCode}
                  onChange={(e) => setLoginCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  autoFocus
                  required
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  ¿No llegó?{" "}
                  <button
                    type="button"
                    onClick={sendLoginCode}
                    disabled={submitting}
                    className="font-medium text-accent hover:underline disabled:opacity-60"
                  >
                    Reenviar código
                  </button>{" "}
                  (podés pedir uno nuevo cada minuto).
                </p>
              </div>
            )}

            <div className={isCodeLogin ? "hidden" : undefined}>
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
                placeholder={isRegister ? "Mínimo 8 caracteres" : "••••••••"}
                autoComplete={tab === "login" ? "current-password" : "new-password"}
                minLength={isRegister ? 8 : undefined}
                required={!isCodeLogin}
                disabled={isCodeLogin}
              />
            </div>

            {/* Datos del negocio: solo para el comercio. El profesional los carga en el asistente. */}
            {isCom && (
              <>
                <div>
                  <Label htmlFor="businessName">Nombre del comercio</Label>
                  <p className="mb-1.5 mt-0.5 text-xs text-muted-foreground">
                    Así va a aparecer en la página pública y en la app.
                  </p>
                  <Input
                    id="businessName"
                    className="mt-1.5"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Studio 34"
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
                <div className="flex gap-2.5 rounded-xl border border-warning/40 bg-warning/10 p-3.5 text-xs text-warning-foreground">
                  <Store className="mt-0.5 size-4 shrink-0" />
                  <p>
                    <strong>Recordá:</strong> los profesionales que invites deben registrarse con sus
                    propios emails antes de sumarse al comercio. El email que usás acá es solo para
                    administrar el negocio.
                  </p>
                </div>
              </>
            )}

            {needsCode && (
              <div>
                <Label htmlFor="verificationCode">Código que te enviamos por email</Label>
                <Input
                  id="verificationCode"
                  className="mt-1.5 tracking-widest"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  ¿No llegó?{" "}
                  <button
                    type="button"
                    onClick={resendCode}
                    disabled={requestClaimCode.isPending}
                    className="font-medium text-accent hover:underline disabled:opacity-60"
                  >
                    Reenviar código
                  </button>{" "}
                  (podés pedir uno nuevo cada minuto).
                </p>
              </div>
            )}

            {info && (
              <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 text-sm text-foreground">
                {info}
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" size="lg" loading={submitting}>
              {isCodeLogin
                ? codeSent
                  ? "Ingresar"
                  : "Enviarme un código"
                : tab === "login"
                ? "Ingresar"
                : isPro
                  ? "Crear cuenta y configurar mi negocio"
                  : isCom
                    ? "Crear cuenta del comercio"
                    : "Crear cuenta"}
            </Button>

            {/* Alternativa sin contraseña (sirve también para cuentas creadas con Google). */}
            {tab === "login" && (
              <button
                type="button"
                onClick={() => toggleCodeLogin(!codeLogin)}
                className="block w-full text-center text-sm text-muted-foreground hover:text-foreground"
              >
                {codeLogin ? (
                  "Ingresar con mi contraseña"
                ) : (
                  <>
                    ¿Sin contraseña?{" "}
                    <span className="font-medium text-accent">Ingresá con un código por email</span>
                  </>
                )}
              </button>
            )}
          </form>
        </>
      )}
    </AuthShell>
  );
}

function RegTypeCard({
  onClick,
  icon,
  title,
  description,
}: {
  onClick: () => void;
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-border p-3.5 text-left transition-colors hover:border-accent hover:bg-accent/5"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
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
          ¿Te registraste con Google? Volvé a &quot;Ingresar&quot; y usá el botón de Google.
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
