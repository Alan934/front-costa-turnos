"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ArrowLeft, Check, CheckCheck, Plus, RotateCcw } from "lucide-react";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { PUBLIC_HOST } from "@/components/public-page-link";
import { useUpdateMyMembership } from "@/lib/api/comercios";
import { useUpdateProfessional } from "@/lib/api/professional";
import { getApiErrorMessage } from "@/lib/api/error-message";
import {
  DEFAULT_WAITING_MESSAGES,
  WAITING_MESSAGE_LABELS,
  WHATSAPP_MESSAGE_MAX,
  WHATSAPP_PLACEHOLDERS,
  peopleLabel,
  type WaitingMessageKind,
  type WhatsAppPlaceholderKey,
} from "@/lib/whatsapp";
import { titleCaseName } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { WaitingRoomWhatsappMessagesDto } from "@/lib/api/generated/model/waitingRoomWhatsappMessagesDto";

const KINDS: WaitingMessageKind[] = ["called", "next", "waiting"];

/** Celular argentino: característica + número, 10 dígitos (igual que el resto de la app). */
const PHONE_DIGITS = 10;

type Drafts = Record<WaitingMessageKind, string>;
type SampleValues = Record<WhatsAppPlaceholderKey, string | number>;

const VAR_LABEL = Object.fromEntries(
  WHATSAPP_PLACEHOLDERS.map((p) => [p.key, p.label]),
) as Record<string, string>;

/** `{clave}` conocida → se muestra como etiqueta; las desconocidas quedan como texto. */
const TOKEN_RE = /\{(\w+)\}/g;

/**
 * Edición de los mensajes de WhatsApp con los que se avisa a quien espera. Vive dentro del modal de
 * configuración de la sala y está pensada para el celular: se edita un mensaje por vez (pestañas),
 * los datos automáticos (nombre, número de turno…) son etiquetas que se agregan con un toque en vez
 * de `{variables}`, y arriba se ve el mensaje tal como le llega al cliente en WhatsApp.
 * Lo que el profesional no cambia sigue siendo el texto por defecto.
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
  const [kind, setKind] = useState<WaitingMessageKind>("called");
  const [savedOk, setSavedOk] = useState(false);

  const storedPhone =
    typeof publicPageSettings.phone === "string"
      ? publicPageSettings.phone
      : "";
  const isDirty = (k: WaitingMessageKind) =>
    (drafts[k].trim() || DEFAULT_WAITING_MESSAGES[k]) !== effective(k);
  const dirty = KINDS.some(isDirty);
  const tooLong = KINDS.some((k) => drafts[k].length > WHATSAPP_MESSAGE_MAX);

  const draft = drafts[kind];
  const isDefault =
    (draft.trim() || DEFAULT_WAITING_MESSAGES[kind]) ===
    DEFAULT_WAITING_MESSAGES[kind];
  const usesPhone = /\{telefono\}/.test(draft);

  function setDraft(text: string) {
    setDrafts((d) => ({ ...d, [kind]: text }));
    setSavedOk(false);
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

  const sample: SampleValues = {
    nombre: "Carla",
    profesional: titleCaseName(staffName),
    numero: 12,
    personas: peopleLabel(2),
    minutos: 20,
    telefono: storedPhone,
  };

  return (
    <>
      <DialogHeader className="pr-14">
        <button
          type="button"
          onClick={onBack}
          className="-ml-1 mb-1 inline-flex min-h-9 items-center gap-1 rounded-md px-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Configuración
        </button>
        <DialogTitle>Mensaje de WhatsApp</DialogTitle>
        <DialogDescription>
          Lo que le escribís a un cliente desde la sala para avisarle. Hay uno
          para cada momento.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 px-6">
        {/* Un mensaje por vez: en el celular, tres editores juntos no entran. */}
        <div
          role="tablist"
          aria-label="Momento del aviso"
          className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1"
        >
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={k === kind}
              onClick={() => setKind(k)}
              className={cn(
                "relative min-h-10 rounded-lg px-1.5 py-2 text-xs font-medium leading-tight transition-colors sm:text-sm",
                k === kind
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {WAITING_MESSAGE_LABELS[k].short}
              {isDirty(k) && (
                <span
                  aria-label="(sin guardar)"
                  className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-accent"
                />
              )}
            </button>
          ))}
        </div>

        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            {WAITING_MESSAGE_LABELS[kind].title}.
          </span>{" "}
          {WAITING_MESSAGE_LABELS[kind].when}
        </p>

        <ChatPreview
          template={draft.trim() || DEFAULT_WAITING_MESSAGES[kind]}
          sample={sample}
        />

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label id="wa-editor-label">Tu mensaje</Label>
            {!isDefault && (
              <button
                type="button"
                onClick={() => setDraft(DEFAULT_WAITING_MESSAGES[kind])}
                className="inline-flex min-h-8 items-center gap-1 text-xs font-medium text-accent hover:underline"
              >
                <RotateCcw className="size-3.5" />
                Usar el original
              </button>
            )}
          </div>
          {/* key: al cambiar de pestaña se rearma el editor con el texto de esa situación. */}
          <MessageEditor
            key={kind}
            value={draft}
            onChange={setDraft}
            placeholder="Escribí tu mensaje. Si lo dejás vacío se usa el original."
          />
          {draft.length > WHATSAPP_MESSAGE_MAX * 0.9 && (
            <p
              className={cn(
                "text-right text-xs",
                draft.length > WHATSAPP_MESSAGE_MAX
                  ? "text-destructive"
                  : "text-muted-foreground",
              )}
            >
              {draft.length} / {WHATSAPP_MESSAGE_MAX}
            </p>
          )}
        </div>

        {usesPhone && (
          <PhoneField
            stored={storedPhone}
            publicPageSettings={publicPageSettings}
            save={updatePro}
          />
        )}

        {updateMembership.isError && (
          <p className="text-sm text-destructive">
            {getApiErrorMessage(updateMembership.error)}
          </p>
        )}
      </div>

      {/* Fijo abajo: guardar siempre a mano, aunque el mensaje sea largo o esté el teclado. */}
      <div className="sticky bottom-0 mt-5 flex gap-2 border-t border-border bg-card px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <Button variant="outline" className="flex-1" onClick={onBack}>
          {dirty ? "Cancelar" : "Volver"}
        </Button>
        <Button
          className="flex-[2]"
          onClick={save}
          disabled={!dirty || tooLong || updateMembership.isPending}
        >
          {updateMembership.isPending ? (
            <Spinner />
          ) : (
            <Check className="size-4" />
          )}
          {savedOk && !dirty ? "Guardado" : "Guardar cambios"}
        </Button>
      </div>
    </>
  );
}

/* ---------- Vista previa estilo WhatsApp ---------- */

/** El mensaje como le llega al cliente: con datos de ejemplo resaltados y el link que se agrega solo. */
function ChatPreview({
  template,
  sample,
}: {
  template: string;
  sample: SampleValues;
}) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of template.matchAll(TOKEN_RE)) {
    const key = m[1] as WhatsAppPlaceholderKey;
    if (!(key in VAR_LABEL)) continue; // desconocida: queda como texto
    const idx = m.index ?? 0;
    parts.push(template.slice(last, idx));
    const value = String(sample[key] ?? "");
    parts.push(
      value ? (
        <span key={idx} className="font-semibold">
          {value}
        </span>
      ) : (
        <span key={idx} className="italic opacity-60">
          ({VAR_LABEL[key].toLowerCase()} sin cargar)
        </span>
      ),
    );
    last = idx + m[0].length;
  }
  parts.push(template.slice(last));

  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">
        Así le llega (con datos de ejemplo)
      </p>
      <div className="rounded-xl bg-[#efeae2] p-3 dark:bg-[#0b141a]">
        <div className="relative ml-auto w-fit max-w-[90%] rounded-lg rounded-tr-none bg-[#d9fdd3] px-2.5 pb-1.5 pt-2 text-sm text-[#111b21] shadow-sm dark:bg-[#005c4b] dark:text-[#e9edef]">
          <p className="whitespace-pre-wrap break-words">{parts}</p>
          <p className="mt-2 break-all">
            Seguí tu lugar acá:{" "}
            <span className="text-[#027eb5] underline dark:text-[#53bdeb]">
              https://{PUBLIC_HOST}/sala/t/…
            </span>
          </p>
          <p className="mt-0.5 flex items-center justify-end gap-1 text-[11px] opacity-60">
            12:30
            <CheckCheck className="size-3.5 text-[#53bdeb]" />
          </p>
        </div>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        El link para seguir la fila se agrega solo al final.
      </p>
    </div>
  );
}

/* ---------- Editor con etiquetas ---------- */

const CHIP_CLASS =
  "inline-flex select-none items-center rounded-md bg-accent/15 px-1.5 py-px align-baseline text-[0.9em] font-medium text-accent whitespace-nowrap";

function makeChip(key: string): HTMLSpanElement {
  const chip = document.createElement("span");
  chip.contentEditable = "false";
  chip.dataset.var = key;
  chip.className = CHIP_CLASS;
  chip.textContent = VAR_LABEL[key];
  return chip;
}

/** Texto con saltos de línea → nodos (los `\n` como `<br>`, igual que los que mete el navegador). */
function appendText(target: Node, text: string) {
  text.split("\n").forEach((line, i) => {
    if (i > 0) target.appendChild(document.createElement("br"));
    if (line) target.appendChild(document.createTextNode(line));
  });
}

function templateToFragment(template: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  let last = 0;
  for (const m of template.matchAll(TOKEN_RE)) {
    if (!(m[1] in VAR_LABEL)) continue;
    const idx = m.index ?? 0;
    appendText(frag, template.slice(last, idx));
    frag.appendChild(makeChip(m[1]));
    last = idx + m[0].length;
  }
  appendText(frag, template.slice(last));
  return frag;
}

/** El contenido editable → plantilla `{clave}` que se guarda. */
function serialize(root: HTMLElement): string {
  let out = "";
  const walk = (node: Node) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        out += (child.textContent ?? "").replace(/[​ ]/g, (c) =>
          c === " " ? " " : "",
        );
      } else if (child instanceof HTMLElement) {
        if (child.dataset.var) out += `{${child.dataset.var}}`;
        else if (child.tagName === "BR") out += "\n";
        else {
          // Algunos navegadores arman párrafos con <div>/<p> al tocar Enter.
          const block = child.tagName === "DIV" || child.tagName === "P";
          if (block && out && !out.endsWith("\n")) out += "\n";
          walk(child);
        }
      }
    });
  };
  walk(root);
  return out;
}

/**
 * Campo de texto donde los datos automáticos se ven como etiquetas («Nombre del cliente») en vez
 * de `{nombre}`. Se agregan con los botones de abajo, en el lugar del cursor; se borran como
 * cualquier letra. Es no controlado (contentEditable): solo se rearma cuando el valor cambia desde
 * afuera (p. ej. «Usar el original»), así no salta el cursor mientras se escribe.
 */
function MessageEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const lastEmitted = useRef<string | null>(null);
  const savedRange = useRef<Range | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || value === lastEmitted.current) return;
    el.replaceChildren(templateToFragment(value));
    lastEmitted.current = value;
  }, [value]);

  // Recordar dónde estaba el cursor: en el celular, tocar un botón puede sacar el foco.
  useEffect(() => {
    const onSelection = () => {
      const sel = window.getSelection();
      const el = ref.current;
      if (el && sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
        savedRange.current = sel.getRangeAt(0).cloneRange();
      }
    };
    document.addEventListener("selectionchange", onSelection);
    return () => document.removeEventListener("selectionchange", onSelection);
  }, []);

  // Enter = salto de línea simple (no párrafos con <div>). Con `beforeinput` también anda en Android.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onBeforeInput = (e: InputEvent) => {
      if (e.inputType === "insertParagraph") {
        e.preventDefault();
        document.execCommand("insertLineBreak");
      }
    };
    el.addEventListener("beforeinput", onBeforeInput);
    return () => el.removeEventListener("beforeinput", onBeforeInput);
  }, []);

  function emit() {
    const el = ref.current;
    if (!el) return;
    const next = serialize(el);
    lastEmitted.current = next;
    onChange(next);
  }

  function insertVar(key: string) {
    const el = ref.current;
    if (!el) return;
    const focused = document.activeElement === el;
    let range = savedRange.current;
    if (!range || !el.contains(range.startContainer)) {
      // Sin cursor en el texto: va al final.
      range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
    }
    range.deleteContents();
    const chip = makeChip(key);
    range.insertNode(chip);

    // Espacios para que no quede pegado a la palabra de al lado.
    const prev = chip.previousSibling;
    // (salvo después de un espacio o de signos que van pegados: «#12», «(Carla», «¡Carla».)
    const prevText = prev?.nodeType === Node.TEXT_NODE ? (prev.textContent ?? "") : "";
    if (
      (prevText && !/[\s#(¡¿$@"'«]$/.test(prevText)) ||
      (prev instanceof HTMLElement && prev.dataset.var)
    ) {
      chip.before(document.createTextNode(" "));
    }
    const next = chip.nextSibling;
    let caretAfter: Node = chip;
    if (
      !(
        next?.nodeType === Node.TEXT_NODE &&
        /^[\s.,;:!?)]/.test(next.textContent ?? "")
      )
    ) {
      const space = document.createTextNode(" ");
      chip.after(space);
      caretAfter = space;
    }

    const caret = document.createRange();
    caret.setStartAfter(caretAfter);
    caret.collapse(true);
    savedRange.current = caret;
    if (focused) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(caret);
    }
    emit();
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <div
          ref={ref}
          role="textbox"
          aria-multiline="true"
          aria-labelledby="wa-editor-label"
          contentEditable
          suppressContentEditableWarning
          spellCheck
          onInput={emit}
          // Al salir, lo escrito a mano como {nombre} también pasa a ser etiqueta.
          onBlur={() => {
            const el = ref.current;
            if (el) el.replaceChildren(templateToFragment(serialize(el)));
          }}
          onPaste={(e) => {
            // Solo texto plano: nada de formato copiado de otro lado.
            e.preventDefault();
            document.execCommand(
              "insertText",
              false,
              e.clipboardData.getData("text/plain"),
            );
          }}
          className="min-h-28 w-full whitespace-pre-wrap break-words rounded-xl border border-input bg-card px-3.5 py-3 text-base leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
        />
        {!value.trim() && (
          <p className="pointer-events-none absolute inset-x-3.5 top-3 text-base leading-relaxed text-muted-foreground sm:text-sm">
            {placeholder}
          </p>
        )}
      </div>

      <div>
        <p className="mb-1.5 text-xs text-muted-foreground">
          Tocá un dato para sumarlo donde está el cursor. Se completa solo con
          los datos de cada cliente.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {WHATSAPP_PLACEHOLDERS.map((p) => (
            <button
              key={p.key}
              type="button"
              // Que el toque no saque el foco del texto (ni cierre el teclado).
              onPointerDown={(e) => e.preventDefault()}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertVar(p.key)}
              className="inline-flex min-h-9 items-center gap-1 rounded-full border border-border bg-card px-3 text-sm font-medium transition-colors hover:border-accent/50 hover:text-accent active:bg-accent/10"
            >
              <Plus className="size-3.5 text-accent" />
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Teléfono ---------- */

/**
 * Teléfono / WhatsApp del profesional. Es el mismo que se muestra en la página pública (se guarda en
 * `publicPageSettings.phone`), así que cargarlo acá lo carga allá también. Aparece cuando el
 * mensaje usa «Tu teléfono»: sin número cargado, ese dato queda vacío.
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
      <Label htmlFor="wa-phone">Tu teléfono</Label>
      <p className="mt-1 text-xs text-muted-foreground">
        {missing
          ? "Tu mensaje incluye «Tu teléfono», pero todavía no lo cargaste. Agregalo acá; también se muestra en tu página pública."
          : "Es el que aparece en el mensaje y en tu página pública."}
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
