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
  // ?r=si / ?r=no: llegó desde los botones "Confirmo" / "No puedo ir" del recordatorio por email.
  // ?r=c: link del recordatorio por WhatsApp; muestra los botones sin confirmar solo (la vista
  // previa que arma WhatsApp abre el link y no debe confirmar por el cliente).
  const intent = r === "si" ? "confirm" : r === "no" ? "decline" : r === "c" ? "ask" : null;
  return <ManageAppointmentView token={token} intent={intent} />;
}
