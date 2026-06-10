"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Plus, ChevronRight, Users, Phone, Mail } from "lucide-react";
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
import { useClients, useCreateClient } from "@/lib/api/clients";
import { formatDateShort } from "@/lib/format";
import type { EnrichedClient } from "@/mocks/contract-extensions";

export function ClientsList() {
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const { data, isLoading, isError, refetch } = useClients(q);

  const clients = (data ?? []).filter((c) => c.status === "active");

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

      <div className="mt-5">
        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        )}
        {isError && <ErrorState message="No pudimos cargar tus clientes." onRetry={() => refetch()} />}
        {data && clients.length === 0 && (
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
              <ClientRow key={c.id} client={c} />
            ))}
          </ul>
        )}
      </div>

      {creating && <NewClientDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

function ClientRow({ client }: { client: EnrichedClient }) {
  return (
    <li>
      <Link
        href={`/app/clientes/${client.id}`}
        className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 transition-colors hover:border-accent"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted font-display text-sm font-semibold">
          {client.fullName.charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{client.fullName}</p>
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
        <div className="hidden text-right text-xs text-muted-foreground sm:block">
          <Badge variant="muted">{client.visitCount} visitas</Badge>
          {client.lastVisitAt && (
            <p className="mt-1">Últ.: {formatDateShort(client.lastVisitAt)}</p>
          )}
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </Link>
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
