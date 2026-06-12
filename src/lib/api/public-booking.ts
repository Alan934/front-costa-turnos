/**
 * Wrappers tipados sobre el cliente generado para la reserva pública.
 * El contrato deja `GET /r/{slug}` y `/slots` como `void` (ver API-GAPS §1); acá
 * adaptamos los hooks generados a los tipos provisionales (PublicPage, Slot) para que
 * las pantallas trabajen tipadas. Cuando el back tipe el spec, esto se simplifica.
 */
import { useQuery, useMutation } from "@tanstack/react-query";
import { customInstance } from "@/lib/api/axios-instance";
import type { BookWithDepositDto } from "@/lib/api/generated/model/bookWithDepositDto";
import type { Service } from "@/lib/api/generated/model/service";
import type { PublicPage, Slot, StaffPublic, BookWithDepositResult } from "@/mocks/contract-extensions";

const asObject = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};
const asArray = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const asString = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);
const asNumber = (v: unknown, d = 0): number => (typeof v === "number" ? v : d);

/**
 * Normaliza `GET /r/{slug}` a nuestro `PublicPage`. El contrato lo deja `void` y la respuesta
 * real es plana (`{ businessName, slug, timezone, settings, services }`, sin `professional`
 * anidado y sin `staff` garantizado). Toleramos ambas formas y completamos faltantes para no
 * romper si el negocio es nuevo (sin servicios/staff).
 */
function normalizePublicPage(raw: unknown): PublicPage {
  const root = asObject(raw);
  const pro = asObject(root.professional ?? root);
  const settings = asObject(root.settings ?? pro.publicPageSettings ?? pro.branding ?? root.branding);

  // Probamos varios nombres posibles para staff/servicios (el contrato no los tipa).
  const rawServices = root.services ?? pro.services ?? settings.services;
  const rawStaff =
    root.staff ?? pro.staff ?? root.staffMembers ?? root.professionals ?? root.team ?? settings.staff;

  if (process.env.NODE_ENV !== "production") {
    const nS = asArray(rawServices).length;
    const nStaff = asArray(rawStaff).length;
    if (nS === 0 || nStaff === 0) {
      // Si falta algo, dejamos a la vista la respuesta cruda para diagnosticar la forma.
      console.warn(
        `[/r/:slug] servicios=${nS} staff=${nStaff}. Si el negocio está configurado, el back ` +
          `probablemente no devuelve "staff" (o "services") en /r/:slug. Respuesta cruda:`,
        raw,
      );
    }
  }

  return {
    professional: {
      id: asString(pro.id ?? root.id),
      businessName: asString(pro.businessName ?? root.businessName),
      slug: asString(pro.slug ?? root.slug),
      timezone: asString(pro.timezone ?? root.timezone, "America/Argentina/Buenos_Aires"),
      defaultDepositMode: (pro.defaultDepositMode ?? root.defaultDepositMode ?? "none") as PublicPage["professional"]["defaultDepositMode"],
      cancellationWindowHours: asNumber(pro.cancellationWindowHours ?? root.cancellationWindowHours, 24),
      branding: {
        accentColor: asString(settings.accentColor) || undefined,
        coverImageUrl: asString(settings.coverImageUrl) || undefined,
        logoFileId: asString(settings.logoFileId) || undefined,
        bio: asString(settings.bio) || undefined,
        // address pasó a ser top-level del professional (no en settings).
        address: asString(root.address ?? pro.address ?? settings.address) || undefined,
        phone: asString(settings.phone) || undefined,
      },
    },
    services: asArray<Service>(rawServices),
    staff: asArray<StaffPublic>(rawStaff),
  };
}

export function usePublicPage(slug: string) {
  return useQuery({
    queryKey: ["public-page", slug],
    queryFn: async ({ signal }) => {
      const raw = await customInstance<unknown>({ url: `/r/${slug}`, method: "GET", signal });
      return normalizePublicPage(raw);
    },
    enabled: !!slug,
  });
}

export interface SlotsQuery {
  staffId: string;
  serviceId: string;
  from: string;
  to: string;
}

export function usePublicSlots(slug: string, params: SlotsQuery | null) {
  return useQuery({
    queryKey: ["public-slots", slug, params],
    queryFn: ({ signal }) =>
      customInstance<Slot[]>({
        url: `/r/${slug}/slots`,
        method: "GET",
        params: params ?? undefined,
        signal,
      }),
    enabled: !!slug && !!params,
  });
}

/**
 * Reserva con seña desde la página pública. Devuelve `{ appointment, payment, mpInitPoint? }`.
 * orval tipa la respuesta como `void` (el contrato no la describe), así que la tipamos acá.
 */
export function useBookPublicWithDeposit(slug: string) {
  return useMutation({
    mutationFn: (data: BookWithDepositDto) =>
      customInstance<BookWithDepositResult>({
        url: `/r/${slug}/book-with-deposit`,
        method: "POST",
        data,
      }),
  });
}
