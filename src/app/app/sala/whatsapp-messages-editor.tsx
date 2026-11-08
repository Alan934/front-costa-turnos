"use client";

import { useRef, useState } from "react";
import { ArrowLeft, Check, MessageCircle, RotateCcw } from "lucide-react";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useUpdateMyMembership } from "@/lib/api/comercios";
import { useUpdateProfessional } from "@/lib/api/professional";
import { getApiErrorMessage } from "@/lib/api/error-message";
import {
  DEFAULT_WAITING_MESSAGES,
  WAITING_MESSAGE_LABELS,
  WHATSAPP_MESSAGE_MAX,
  WHATSAPP_PLACEHOLDERS,
  peopleLabel,
  renderWhatsAppMessage,
  type WaitingMessageKind,
} from "@/lib/whatsapp";
import { titleCaseName } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { WaitingRoomWhatsappMessagesDto } from "@/lib/api/generated/model/waitingRoomWhatsappMessagesDto";

const KINDS: WaitingMessageKind[] = ["called", "next", "waiting"];

/** Celular argentino: característica + número, 10 dígitos (igual que el resto de la app). */
const PHONE_DIGITS = 10;

type Drafts = Record<WaitingMessageKind, string>;

/**
 * Edición de los mensajes de WhatsApp con los que se avisa a quien espera. Vive dentro del modal de
 * configuración de la sala. Hay un texto por situación (lo llamás / es el siguiente / todavía espera)
 * y arranca con el de siempre; lo que el profesional no cambia sigue siendo el texto por defecto.
 * También deja cargar el teléfono propio, que se puede usar en el mensaje con `{telefono}`.
 */
export function WhatsAppMessagesEditor({
  comercioId,
  staffName,
  saved,
  publicPageSettings,
  onBack,
  onChanged,
}: {
  comercioId: string;
  staffName: string;
  /** Lo guardado en la membresía; ausente = todo por defecto. */
  saved: WaitingRoomWhatsappMessagesDto | null | undefined;
  /** `professional.publicPageSettings`: ahí vive el teléfono (el mismo de la página pública). */
  publicPageSettings: Record<string, unknown>;
  onBack: () => void;
  onChanged: () => void;
}) {
  const updateMembership = useUpdateMyMembership(comercioId);
  const updatePro = useUpdateProfessional();

  const effective = (k: WaitingMessageKind) =>
    saved?.[k]?.trim() || DEFAULT_WAITING_MESSAGES[k];
  const [drafts, setDrafts] = useState<Drafts>(() => ({
    called: effective("called"),
    next: effective("next"),
    waiting: effective("waiting"),
  }));
  const [savedOk, setSavedOk] = useState(false);

  // Cuál textarea recibe la variable que se toca: la última en la que se escribió.
  const refs = useRef<Record<WaitingMessageKind, HTMLTextAreaElement | null>>({
    called: null,
    next: null,
    waiting: null,
  });
  const [lastFocused, setLastFocused] = useState<WaitingMessageKind>("called");

  const storedPhone =
    typeof publicPageSettings.phone === "string"
      ? publicPageSettings.phone
      : "";
  const dirty = KINDS.some(
    (k) => (drafts[k].trim() || DEFAULT_WAITING_MESSAGES[k]) !== effective(k),
  );
  const tooLong = KINDS.some((k) => drafts[k].length > WHATSAPP_MESSAGE_MAX);

  function insertVariable(key: string) {
    const kind = lastFocused;
    const el = refs.current[kind];
    const token = `{${key}}`;
    const start = el?.selectionStart ?? drafts[kind].length;
    const end = el?.selectionEnd ?? start;
    const next = drafts[kind].slice(0, start) + token + drafts[kind].slice(end);
    setDrafts((d) => ({ ...d, [kind]: next }));
    setSavedOk(false);
    // Devuelve el foco con el cursor justo después de lo insertado.
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  function save() {
    // Solo viaja lo que difiere del texto por defecto: así, si mejoramos un default, les llega a
    // quienes nunca lo tocaron. Vacío = volver al por defecto.
    const custom: WaitingRoomWhatsappMessagesDto = {};
    for (const k of KINDS) {
      const text = drafts[k].trim();
      if (text && text !== DEFAULT_WAITING_MESSAGES[k]) custom[k] = text;
    }
    updateMembership.mutate(
      {
        waitingRoomWhatsappMessages:
          Object.keys(custom).length > 0 ? custom : null,
      },
      {
        onSuccess: () => {
          setDrafts({
            called: drafts.called.trim() || DEFAULT_WAITING_MESSAGES.called,
            next: drafts.next.trim() || DEFAULT_WAITING_MESSAGES.next,
            waiting: drafts.waiting.trim() || DEFAULT_WAITING_MESSAGES.waiting,
          });
          setSavedOk(true);
          onChanged();
        },
      },
    );
  }

  const sample = {
    nombre: "Carla",
    profesional: titleCaseName(staffName),
    numero: 12,
    personas: peopleLabel(2),
    minutos: 20,
    telefono: storedPhone,
  };

  return (
    <>
      <DialogHeader>
        <button
          type="button"
          onClick={onBack}
          className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Volver a la configuración
        </button>
        <DialogTitle>Mensaje de WhatsApp</DialogTitle>
        <DialogDescription>
          Es lo que se escribe para avisarle a un cliente desde la sala. Vos
          tocás «Enviar» en WhatsApp. Si no cambiás nada, se usa el mensaje de
          siempre.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-5 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <PhoneField
          stored={storedPhone}
          publicPageSettings={publicPageSettings}
          save={updatePro}
        />

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            Variables: tocá una para ponerla en el mensaje que estás editando
          </p>
          <div className="flex flex-wrap gap-1.5">
            {WHATSAPP_PLACEHOLDERS.map((p) => (
              <button
                key={p.key}
                type="button"
                title={p.help}
                onClick={() => insertVariable(p.key)}
                className="rounded-full border border-border px-2.5 py-1 font-mono text-xs transition-colors hover:border-accent/50 hover:text-accent"
              >
                {`{${p.key}}`}
              </button>
            ))}
          </div>
        </div>

        {KINDS.map((k) => {
          const isDefault = drafts[k].trim() === DEFAULT_WAITING_MESSAGES[k];
          return (
            <div key={k} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor={`wa-${k}`}>
                  {WAITING_MESSAGE_LABELS[k].title}
                </Label>
                {!isDefault && (
                  <button
                    type="button"
                    onClick={() => {
                      setDrafts((d) => ({
                        ...d,
                        [k]: DEFAULT_WAITING_MESSAGES[k],
                      }));
                      setSavedOk(false);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                  >
                    <RotateCcw className="size-3" />
                    Volver al original
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {WAITING_MESSAGE_LABELS[k].when}
              </p>
              <textarea
                id={`wa-${k}`}
                ref={(el) => {
                  refs.current[k] = el;
                }}
                rows={3}
                maxLength={WHATSAPP_MESSAGE_MAX}
                value={drafts[k]}
                onFocus={() => setLastFocused(k)}
                onChange={(e) => {
                  setDrafts((d) => ({ ...d, [k]: e.target.value }));
                  setSavedOk(false);
                }}
                className="w-full resize-y rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="flex gap-1.5 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                <MessageCircle className="mt-0.5 size-3.5 shrink-0 text-accent" />
                <span className="min-w-0 whitespace-pre-wrap break-words">
                  {renderWhatsAppMessage(drafts[k], sample) ||
                    "(mensaje vacío: se usa el original)"}
                </span>
              </p>
            </div>
          );
        })}

        <p className="text-xs text-muted-foreground">
          Al final de cada mensaje se agrega solo el link para que el cliente
          siga su lugar en la fila.
        </p>

        {updateMembership.isError && (
          <p className="text-sm text-destructive">
            {getApiErrorMessage(updateMembership.error)}
          </p>
        )}

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onBack}>
            Volver
          </Button>
          <Button
            className="flex-1"
            onClick={save}
            disabled={!dirty || tooLong || updateMembership.isPending}
          >
            {updateMembership.isPending ? (
              <Spinner />
            ) : (
              <Check className="size-4" />
            )}
            {savedOk && !dirty ? "Guardado" : "Guardar mensajes"}
          </Button>
        </div>
      </div>
    </>
  );
}

/**
 * Teléfono / WhatsApp del profesional. Es el mismo que se muestra en la página pública (se guarda en
 * `publicPageSettings.phone`), así que cargarlo acá lo carga allá también. Si todavía no hay, lo
 * ofrece de forma visible: sin él, `{telefono}` queda vacío en los mensajes.
 */
function PhoneField({
  stored,
  publicPageSettings,
  save,
}: {
  stored: string;
  publicPageSettings: Record<string, unknown>;
  save: ReturnType<typeof useUpdateProfessional>;
}) {
  const [value, setValue] = useState(stored);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const digits = value.replace(/\D/g, "");
  const changed = value.trim() !== stored.trim();
  const missing = !stored.trim();

  function submit() {
    // Vacío = quitarlo; si no, tiene que ser un celular válido (si no, el link de WhatsApp falla).
    if (digits && digits.length !== PHONE_DIGITS) {
      setError(
        `El celular debe tener ${PHONE_DIGITS} dígitos: característica + número, sin 0 ni 15. Ej: 2612465120`,
      );
      return;
    }
    setError(null);
    const next = { ...publicPageSettings };
    if (digits) next.phone = digits;
    else delete next.phone;
    save.mutate(
      { publicPageSettings: next },
      {
        onSuccess: () => {
          setValue(digits);
          setDone(true);
        },
        onError: (e) => setError(getApiErrorMessage(e)),
      },
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border p-3.5",
        missing ? "border-accent/40 bg-accent/5" : "border-border",
      )}
    >
      <Label htmlFor="wa-phone">Tu teléfono / WhatsApp</Label>
      <p className="mt-1 text-xs text-muted-foreground">
        {missing
          ? "Todavía no cargaste tu número. Agregalo para poder usar {telefono} en los mensajes; también se muestra en tu página pública."
          : "Se usa donde pongas {telefono} y se muestra en tu página pública."}
      </p>
      <div className="mt-2 flex gap-2">
        <Input
          id="wa-phone"
          inputMode="tel"
          autoComplete="tel"
          placeholder="2612465120"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setDone(false);
            setError(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && changed && submit()}
        />
        <Button
          variant="outline"
          onClick={submit}
          disabled={!changed || save.isPending}
          className="shrink-0"
        >
          {save.isPending ? (
            <Spinner />
          ) : done && !changed ? (
            <Check className="size-4" />
          ) : null}
          {done && !changed ? "Guardado" : "Guardar"}
        </Button>
      </div>
      {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
    </div>
  );
}
