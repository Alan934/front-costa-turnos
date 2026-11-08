import type { Metadata } from "next";
import { PublicBookingPage } from "./public-booking-page";
import { comercioBio, getComercioPublicPage } from "@/lib/api/public-page-server";
import { baseOpenGraph } from "@/lib/seo";

/**
 * Título y descripción con el nombre del comercio: es lo que se ve al compartir el link de
 * reservas por WhatsApp (la imagen sale de ./opengraph-image.tsx).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await getComercioPublicPage(slug);
  if (!page) return { title: "Reservar turno" };

  const title = `${page.name} · Reservá tu turno`;
  const bio = comercioBio(page);
  // Siempre una invitación a reservar; la bio del comercio (si tiene) y la dirección suman.
  const description = [
    bio ?? "Elegí el servicio, el día y el horario, y reservá tu turno online en un minuto.",
    page.address && `📍 ${page.address}`,
  ]
    .filter((part): part is string => !!part)
    .map((part) => part.replace(/\.$/, ""))
    .join(" · ");

  return {
    // `absolute`: sin el sufijo "· Costa Turnos", que en la tarjeta de WhatsApp sobra.
    title: { absolute: title },
    description,
    openGraph: { ...baseOpenGraph, title, description, url: `/r/${slug}` },
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <PublicBookingPage slug={slug} />;
}
