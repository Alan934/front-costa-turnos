/**
 * Links `wa.me` para escribirle a un cliente desde el celular del profesional. No envía nada solo:
 * abre WhatsApp con el mensaje escrito y el profesional toca "Enviar".
 */

/**
 * Los celulares se guardan como 10 dígitos argentinos (característica + número, sin 0/15/+54), pero
 * `wa.me` necesita el número internacional: 54 9 + los 10 dígitos. Sin eso el link no encuentra
 * la cuenta. Si ya viene con código de país, se respeta.
 */
export function toWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `549${digits}`;
  return digits;
}

export function whatsAppLink(phone: string, text?: string): string {
  const base = `https://wa.me/${toWhatsAppNumber(phone)}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

/* ---------- Mensajes de la sala de espera ---------- */

/** Situación del cliente en la fila: define qué mensaje se le manda. */
export type WaitingMessageKind = "called" | "next" | "waiting";

/** Variables que el profesional puede usar en sus mensajes, escritas entre llaves. */
export const WHATSAPP_PLACEHOLDERS = [
  { key: "nombre", label: "Nombre", help: "Nombre del cliente" },
  { key: "profesional", label: "Profesional", help: "Tu nombre en la sala" },
  { key: "numero", label: "Número", help: "Número de turno del cliente" },
  {
    key: "personas",
    label: "Personas",
    help: "Cuánta gente hay antes, ej. «2 personas»",
  },
  { key: "minutos", label: "Minutos", help: "Espera estimada en minutos" },
  { key: "telefono", label: "Teléfono", help: "Tu teléfono / WhatsApp" },
] as const;

/** Largo máximo que acepta el backend por mensaje. */
export const WHATSAPP_MESSAGE_MAX = 1000;

/** Los textos de siempre: lo que se manda mientras el profesional no los cambie. */
export const DEFAULT_WAITING_MESSAGES: Record<WaitingMessageKind, string> = {
  called:
    "¡Hola {nombre}! {profesional} te está llamando. Pasá ahora, tu número es el #{numero}.",
  next: "¡Hola {nombre}! Sos el siguiente con {profesional}. Andá acercándote.",
  waiting:
    "¡Hola {nombre}! Hay {personas} antes que vos con {profesional} (aprox. {minutos} min). Andá acercándote.",
};

export const WAITING_MESSAGE_LABELS: Record<
  WaitingMessageKind,
  { title: string; when: string }
> = {
  called: {
    title: "Cuando lo llamás",
    when: "Ya le tocó y todavía no se acercó.",
  },
  next: { title: "Cuando es el siguiente", when: "No hay nadie antes que él." },
  waiting: {
    title: "Cuando todavía espera",
    when: "Hay gente antes en la fila.",
  },
};

/**
 * Reemplaza `{variable}` por su valor. Una variable desconocida se deja tal cual (así el
 * profesional ve el error de tipeo en la vista previa); una conocida sin valor (p. ej. `{telefono}`
 * sin teléfono cargado) queda vacía.
 */
export function renderWhatsAppMessage(
  template: string,
  vars: Partial<
    Record<
      (typeof WHATSAPP_PLACEHOLDERS)[number]["key"],
      string | number | null
    >
  >,
): string {
  return template
    .replace(/\{(\w+)\}/g, (whole, key: string) =>
      key in vars ? String(vars[key as keyof typeof vars] ?? "") : whole,
    )
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** "1 persona" / "3 personas": va en `{personas}` para que el texto concuerde. */
export function peopleLabel(n: number): string {
  return `${n} ${n === 1 ? "persona" : "personas"}`;
}
