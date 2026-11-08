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
