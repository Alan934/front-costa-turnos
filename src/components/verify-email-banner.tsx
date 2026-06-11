"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MailWarning, X } from "lucide-react";
import { useAuth } from "@/components/auth-provider";

const DISMISS_KEY = "costa-verify-dismissed";

/**
 * Aviso para verificar el email. Solo aparece si el back informa `emailVerified === false`
 * (si no manda el dato, no molestamos). Se puede ocultar por sesión (sessionStorage).
 */
export function VerifyEmailBanner() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(true);

  const needsVerify = !!user && user.emailVerified === false;

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === (user?.email ?? ""));
  }, [user?.email]);

  if (!needsVerify || dismissed) return null;

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, user?.email ?? "");
    setDismissed(true);
  }

  const href = `/cuenta/verificar?email=${encodeURIComponent(user!.email)}`;

  return (
    <div className="border-b border-warning/45 bg-warning/10 px-5 py-2.5 text-warning-foreground sm:px-8">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-1.5">
        <MailWarning className="size-4 shrink-0" />
        <p className="text-sm">
          <span className="font-medium">Verificá tu email.</span>{" "}
          <span className="opacity-90">Confirmá tu correo para asegurar tu cuenta.</span>
        </p>
        <div className="ml-auto flex items-center gap-1.5">
          <Link
            href={href}
            className="shrink-0 rounded-lg bg-foreground/90 px-3 py-1.5 text-xs font-semibold text-background transition-opacity hover:opacity-90"
          >
            Verificar
          </Link>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Ocultar aviso"
            className="grid size-7 place-items-center rounded-md opacity-70 transition-opacity hover:opacity-100"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
