import type { MeResponse } from "@/mocks/contract-extensions";
import { homeForUser } from "@/lib/auth-routing";
import { safeNextPath } from "@/lib/safe-redirect";

/**
 * "Intención" de quien se está registrando/ingresando, guardada en el navegador.
 *
 * Hace falta porque el login con Google sale del sitio y vuelve a /auth/callback sin
 * contexto: ahí no sabríamos que la persona eligió "Soy profesional" ni a dónde quería
 * volver (`next`). También cubre al que se registra y abandona el asistente a mitad de
 * camino: al volver a ingresar lo retomamos en /onboarding en vez de dejarlo como cliente.
 */
export interface AuthIntent {
  /** Eligió registrarse como profesional y todavía no creó su negocio. */
  role?: "profesional";
  /** Destino final (p. ej. la invitación de un comercio). */
  next?: string;
  /** Email de la cuenta dueña de la intención (se completa al autenticarse). */
  email?: string;
  /** Epoch ms en que se guardó. */
  at: number;
}

const KEY = "costa-auth-intent";
/** Sin cuenta asociada (se fue a Google y no volvió) la intención vence rápido. */
const UNCLAIMED_TTL_MS = 30 * 60_000;

export function getAuthIntent(): AuthIntent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const intent = JSON.parse(raw) as AuthIntent;
    if (!intent.email && Date.now() - (intent.at ?? 0) > UNCLAIMED_TTL_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return intent;
  } catch {
    return null;
  }
}

export function saveAuthIntent(intent: Omit<AuthIntent, "at">) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...intent, at: Date.now() }));
  } catch {
    // almacenamiento no disponible (modo privado): se pierde la intención, nada más
  }
}

export function clearAuthIntent() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // idem
  }
}

/**
 * A dónde mandar a un usuario recién autenticado. Si tiene pendiente crear su negocio va al
 * asistente (y el `next` queda guardado para el final); si no, a `next` o a su inicio por rol.
 */
export function resolvePostAuthPath(user: MeResponse, next?: string | null): string {
  const intent = getAuthIntent();
  const email = user.email.toLowerCase();
  const mine = !!intent && (!intent.email || intent.email === email);

  if (intent && mine && intent.role === "profesional" && !user.professionalId) {
    saveAuthIntent({ role: "profesional", next: next ?? intent.next, email });
    return "/onboarding";
  }

  const dest = next ?? (mine ? safeNextPath(intent?.next) : null) ?? homeForUser(user);
  if (intent && mine) clearAuthIntent();
  return dest;
}

/** Al terminar el asistente: consume la intención y devuelve el destino final. */
export function finishOnboardingPath(): string {
  const next = safeNextPath(getAuthIntent()?.next);
  clearAuthIntent();
  return next ?? "/app";
}
