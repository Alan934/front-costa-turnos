"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  ChevronRight,
  Users,
  Phone,
  Mail,
  MessageCircle,
  UserRoundX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ErrorState, EmptyState } from "@/components/state-views";
import { useAuth } from "@/components/auth-provider";
import { useClients, useCreateClient } from "@/lib/api/clients";
import { matchesClient } from "@/lib/client-search";
import { useProfessional } from "@/lib/api/professional";
import { PUBLIC_HOST } from "@/components/public-page-link";
import { comebackMessage, whatsAppLink } from "@/lib/whatsapp";
import { formatDateShort } from "@/lib/format";
import type { EnrichedClient } from "@/mocks/contract-extensions";

export function ClientsList() {
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const { user } = useAuth();
  // Cartera entera una vez (misma caché que los diálogos de turno/sala) y búsqueda local:
  // sin un pedido por tecla, e ignora tildes ("maria" encuentra a "María").
  const { data, isLoading, isError, refetch } = useClients();

  // El back puede listar al propio profesional como cliente (su persona quedó vinculada como
  // professional_client). El back ya lo excluye por account_id, pero filtramos también del lado
  // del front por las dudas: por personId (la persona canónica que expone /auth/me) y, como
  // respaldo si el back todavía no lo informa, por email de cuenta.
  const selfPersonId = user?.personId ?? null;
  const selfEmail = user?.email?.trim().toLowerCase();
  const isSelf = (c: EnrichedClient) =>
    (selfPersonId != null && c.personId === selfPersonId) ||
    (!!selfEmail && c.email?.trim().toLowerCase() === selfEmail);
  const active = (data ?? []).filter(
    (c) => c.status === "active" && !isSelf(c) && matchesClient(c, q),
  );

  // ---- "No vienen hace más de X semanas": tuvieron turno y no tienen ninguno reservado ----
  const [awayWeeks, setAwayWeeks] = useState(0); // 0 = todos
  const away = useMemo(() => {
    if (awayWeeks === 0) return [];
    const limit = Date.now() - awayWeeks * 7 * 86_400_000;
    return active
      .filter(
        (c) =>
          !!c.lastAppointmentAt &&
          +new Date(c.lastAppointmentAt) < limit &&
          !c.nextAppointmentAt,
      )
      .sort((a, b) => +new Date(b.lastAppointmentAt!) - +new Date(a.lastAppointmentAt!));
  }, [active, awayWeeks]);
  const clients = awayWeeks === 0 ? active : away;

  const pro = useProfessional();
  const bookUrl = pro.data?.slug ? `https://${PUBLIC_HOST}/r/${pro.data.slug}` : null;

  return (
    <div className="mx-auto max-w-3xl px-5 py-6 sm:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">Tu cartera de clientes y sus fichas</p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          <span className="hidden sm:inline">Nuevo cliente</span>
        </Button>
      </div>

      {/* Búsqueda */}
      <div className="relative mt-5">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, email o teléfono…"
          aria-label="Buscar clientes"
        />
      </div>

      {/* Clientes que dejaron de venir */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <UserRoundX className="size-4 text-muted-foreground" />
        <label htmlFor="cl-away" className="text-muted-foreground">
          Mostrar
        </label>
        <select
          id="cl-away"
          value={awayWeeks}
          onChange={(e) => setAwayWeeks(Number(e.target.value))}
          className="h-9 rounded-lg border border-input bg-card px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value={0}>Todos los clientes</option>
          <option value={4}>Los que no vienen hace más de 4 semanas</option>
          <option value={6}>Los que no vienen hace más de 6 semanas</option>
          <option value={8}>Los que no vienen hace más de 8 semanas</option>
          <option value={12}>Los que no vienen hace más de 3 meses</option>
        </select>
      </div>
      {awayWeeks > 0 && data && (
        <p className="mt-2 text-xs text-muted-foreground">
          {away.length === 0
            ? "Nadie: todos tus clientes vinieron hace poco o ya tienen turno reservado."
            : `${away.length} ${away.length === 1 ? "cliente tuvo" : "clientes tuvieron"} turno hace más de ${awayWeeks} semanas y no ${away.length === 1 ? "tiene otro reservado. Escribile" : "tienen otro reservado. Escribiles"} por WhatsApp con el link para reservar.`}
        </p>
      )}

      <div className="mt-5">
        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        )}
        {isError && <ErrorState message="No pudimos cargar tus clientes." onRetry={() => refetch()} />}
        {data && clients.length === 0 && awayWeeks === 0 && (
          <EmptyState
            icon={<Users className="size-5" />}
            title={q ? "Sin resultados" : "Todavía no tenés clientes"}
            message={
              q
                ? "Probá con otro nombre o teléfono."
                : "Cuando alguien reserve o lo cargues a mano, aparece acá."
            }
            action={
              !q ? (
                <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
                  <Plus className="size-4" />
                  Cargar cliente
                </Button>
              ) : undefined
            }
          />
        )}
        {clients.length > 0 && (
          <ul className="space-y-2">
            {clients.map((c) => (
              <ClientRow
                key={c.id}
                client={c}
                comeback={
                  awayWeeks > 0
                    ? {
                        bookUrl,
                        businessName: pro.data?.businessName ?? null,
                      }
                    : undefined
                }
              />
            ))}
          </ul>
        )}
      </div>

      {creating && <NewClientDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

/** Semanas enteras desde una fecha ("hace 9 semanas"). */
function weeksAgo(iso: string): number {
  return Math.floor((Date.now() - +new Date(iso)) / (7 * 86_400_000));
}

function ClientRow({
  client,
  comeback,
}: {
  client: EnrichedClient;
  /** Vista "no vienen hace X": muestra hace cuánto vino y el botón de invitarlo a volver. */
  comeback?: { bookUrl: string | null; businessName: string | null };
}) {
  const name = client.fullName?.trim() || "Cliente sin nombre";
  const initial = (client.fullName?.trim()?.charAt(0) ?? "?").toUpperCase();
  return (
    <li className="flex items-center gap-2">
      <Link
        href={`/app/clientes/${client.id}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-border bg-card p-3.5 transition-colors hover:border-accent"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted font-display text-sm font-semibold">
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{name}</p>
          <p className="flex items-center gap-3 truncate text-xs text-muted-foreground">
            {client.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="size-3" />
                {client.phone}
              </span>
            )}
            {client.email && (
              <span className="inline-flex items-center gap-1 truncate">
                <Mail className="size-3" />
                {client.email}
              </span>
            )}
          </p>
        </div>
        {comeback && client.lastAppointmentAt ? (
          <div className="shrink-0 text-right text-xs text-muted-foreground">
            <p className="font-medium text-foreground">
              Hace {weeksAgo(client.lastAppointmentAt)} semanas
            </p>
            <p>Últ. turno: {formatDateShort(client.lastAppointmentAt)}</p>
          </div>
        ) : (
          <div className="hidden text-right text-xs text-muted-foreground sm:block">
            {client.visitCount != null && <Badge variant="muted">{client.visitCount} visitas</Badge>}
            {client.lastVisitAt && (
              <p className="mt-1">Últ.: {formatDateShort(client.lastVisitAt)}</p>
            )}
          </div>
        )}
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </Link>
      {comeback && client.phone && (
        <Button variant="outline" size="sm" className="shrink-0" asChild>
          <a
            href={whatsAppLink(
              client.phone,
              comebackMessage({
                clientName: name,
                businessName: comeback.businessName,
                bookUrl: comeback.bookUrl,
              }),
            )}
            target="_blank"
            rel="noopener noreferrer"
            title="Abre WhatsApp con un mensaje para invitarlo a volver, con el link para reservar"
          >
            <MessageCircle className="size-4" />
            <span className="hidden sm:inline">Invitar a volver</span>
          </a>
        </Button>
      )}
    </li>
  );
}

function NewClientDialog({ onClose }: { onClose: () => void }) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const create = useCreateClient();

  function submit() {
    create.mutate(
      { fullName: fullName.trim(), phone: phone.trim() || undefined, email: email.trim() || undefined },
      { onSuccess: onClose },
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo cliente</DialogTitle>
        </DialogHeader>
        <div className="space-y-3.5 px-6 pb-2">
          <div>
            <Label htmlFor="nc-name">Nombre y apellido</Label>
            <Input id="nc-name" className="mt-1.5" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Sofía Pérez" />
          </div>
          <div>
            <Label htmlFor="nc-phone">Teléfono / WhatsApp</Label>
            <Input id="nc-phone" className="mt-1.5" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="261 555 1234" inputMode="tel" />
          </div>
          <div>
            <Label htmlFor="nc-email">Email <span className="text-muted-foreground">(opcional)</span></Label>
            <Input id="nc-email" type="email" className="mt-1.5" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vos@email.com" />
          </div>
        </div>
        <div className="p-6 pt-3">
          <Button className="w-full" disabled={fullName.trim().length < 2 || create.isPending} onClick={submit}>
            {create.isPending ? <Spinner /> : null}
            Guardar cliente
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
