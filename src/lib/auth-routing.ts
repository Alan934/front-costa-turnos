import type { MeResponse } from "@/mocks/contract-extensions";

/** Ruta inicial según el rol del usuario (admin > profesional > comercial > cliente). */
export function homeForUser(user: MeResponse): string {
  if (user.roles.includes("admin")) return "/admin/profesionales";
  if (user.roles.includes("professional")) return user.professionalId ? "/app" : "/onboarding";
  if (user.roles.includes("comercial")) return "/comercio";
  return "/mis-turnos";
}
