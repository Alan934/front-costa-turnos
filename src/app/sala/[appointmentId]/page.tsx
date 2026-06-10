import type { Metadata } from "next";
import { ClientWaitingRoom } from "./client-waiting-room";

export const metadata: Metadata = {
  title: "Sala de espera",
};

export default async function Page({
  params,
}: {
  params: Promise<{ appointmentId: string }>;
}) {
  const { appointmentId } = await params;
  return <ClientWaitingRoom appointmentId={appointmentId} />;
}
