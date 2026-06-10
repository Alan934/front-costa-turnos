import type { Metadata } from "next";
import { PublicBookingPage } from "./public-booking-page";

export const metadata: Metadata = {
  title: "Reservar turno",
};

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <PublicBookingPage slug={slug} />;
}
