import type { Metadata } from "next";
import { ManageAppointmentView } from "./manage-appointment-view";

export const metadata: Metadata = {
  title: "Tu turno",
  // Link personal: no debe indexarse ni filtrar el token por Referer al salir del sitio.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ r?: string }>;
}) {
  const { token } = await params;
  const { r } = await searchParams;
  // ?r=si / ?r=no: llegó desde los botones "Confirmo" / "No puedo ir" del recordatorio.
  const intent = r === "si" ? "confirm" : r === "no" ? "decline" : null;
  return <ManageAppointmentView token={token} intent={intent} />;
}
