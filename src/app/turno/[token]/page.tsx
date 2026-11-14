import type { Metadata } from "next";
import { ManageAppointmentView } from "./manage-appointment-view";

export const metadata: Metadata = {
  title: "Tu turno",
  // Link personal: no debe indexarse ni filtrar el token por Referer al salir del sitio.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ManageAppointmentView token={token} />;
}
