"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Hand } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/components/auth-provider";
import { usePublicProfessional, useSelfCheckIn } from "@/lib/api/public-booking";
import {
  getApiErrorMessage,
  getApiValidationMessages,
  matchFieldErrors,
} from "@/lib/api/error-message";
import { formatDuration, titleCaseName } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * El cliente se anota en la fila desde su celular. Si ya tiene sesión, el nombre
 * viene precargado y el back cuelga la entrada de su cuenta: es un tap y listo.
 * Al confirmar, se va a su link personal, donde ve su número y cuántos le faltan.
 */
export function SelfCheckInDialog({
  slug,
  membershipId,
  onClose,
}: {
  slug: string;
  membershipId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const detail = usePublicProfessional(slug, membershipId);
  const services = (detail.data?.services ?? []).filter((s) => s.isActive);

  const [serviceId, setServiceId] = useState("");
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [phone, setPhone] = useState("");

  const checkIn = useSelfCheckIn(slug, membershipId);
  const fieldErrors = checkIn.isError
    ? matchFieldErrors(getApiValidationMessages(checkIn.error), [
        "fullName",
        "phone",
        "serviceId",
      ])
    : {};

  // Con varios servicios NO se preselecciona ninguno: con el primero ya marcado es muy fácil
  // anotarse en uno que no era. Si hay uno solo, no hay nada que elegir.
  const chosen = serviceId || (services.length === 1 ? services[0].id : "");
  const canSubmit = !!chosen && fullName.trim().length > 0 && phone.trim().length > 0;

  function submit() {
    checkIn.mutate(
      { serviceId: chosen, fullName: fullName.trim(), phone: phone.trim() },
      { onSuccess: (res) => router.push(`/sala/t/${res.token}`) },
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      {/* En celular es un bottom sheet: con muchos servicios es más alto que la pantalla, así que
          scrollea adentro (dvh descuenta la barra del navegador) en vez de cortarse. */}
      <DialogContent className="max-h-[92dvh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Anotarme en la fila</DialogTitle>
          <DialogDescription>
            Entrás a la fila cuando el profesional confirme que llegaste. Te queda un link para
            seguir tu lugar.
          </DialogDescription>
        </DialogHeader>

        {/* px-6 como el header (sin esto el contenido quedaba pegado a los bordes); el pb suma el
            área segura de abajo para que los botones no queden bajo la barra de gestos. */}
        <div className="space-y-5 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <div>
            <Label>¿Qué venís a hacerte?{services.length > 1 && !chosen && <span className="ml-1 text-xs font-normal text-muted-foreground">(elegí uno)</span>}</Label>
            {detail.isLoading ? (
              <p className="mt-1.5 text-sm text-muted-foreground">Cargando servicios…</p>
            ) : services.length === 0 ? (
              <p className="mt-1.5 text-sm text-muted-foreground">
                No hay servicios disponibles en este momento.
              </p>
            ) : (
              <ul className="mt-1.5 grid gap-1.5">
                {services.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setServiceId(s.id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                        s.id === chosen
                          ? "border-accent bg-accent/10"
                          : "border-border hover:border-accent/50",
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate">{titleCaseName(s.name)}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDuration(s.durationMinutes)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <Label htmlFor="checkin-name">Tu nombre</Label>
            <Input
              id="checkin-name"
              className={cn("mt-1.5 text-base sm:text-sm", fieldErrors.fullName && "border-destructive")}
              placeholder="Juan García"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            {fieldErrors.fullName && (
              <p className="mt-1 text-xs text-destructive">{fieldErrors.fullName}</p>
            )}
          </div>

          <div>
            <Label htmlFor="checkin-phone">Tu teléfono</Label>
            <Input
              id="checkin-phone"
              className={cn("mt-1.5 text-base sm:text-sm", fieldErrors.phone && "border-destructive")}
              placeholder="2612465120"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Sirve para que el local te reconozca la próxima vez.
            </p>
            {fieldErrors.phone && (
              <p className="mt-1 text-xs text-destructive">Revisá el número de teléfono.</p>
            )}
          </div>

          {checkIn.isError && Object.keys(fieldErrors).length === 0 && (
            <p className="text-sm text-destructive">{getApiErrorMessage(checkIn.error)}</p>
          )}

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={submit} disabled={!canSubmit || checkIn.isPending}>
              {checkIn.isPending ? <Spinner /> : <Hand className="size-4" />}
              Anotarme
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
