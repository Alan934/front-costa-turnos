"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { onSubscriptionBlocked } from "@/lib/billing-events";

/**
 * Escucha los 403 de "suscripción vencida" emitidos por el interceptor de axios y muestra
 * un CTA para pagar, en lugar de dejar que la acción falle con un error genérico.
 * Se monta una sola vez (en Providers).
 */
export function SubscriptionGate() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => onSubscriptionBlocked(setMessage), []);

  return (
    <Dialog open={!!message} onOpenChange={(o) => !o && setMessage(null)}>
      <DialogContent className="text-center sm:max-w-sm">
        <div className="p-6 pt-8">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
            <Lock className="size-6" />
          </span>
          <h2 className="mt-4 font-display text-lg font-semibold tracking-tight">
            Acción bloqueada
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{message}</p>
          <div className="mt-6 space-y-2">
            <Button
              className="w-full"
              onClick={() => {
                setMessage(null);
                router.push("/app/suscripcion");
              }}
            >
              Abonar suscripción
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setMessage(null)}>
              Ahora no
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
