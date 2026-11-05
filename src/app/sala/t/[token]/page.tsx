import type { Metadata } from "next";
import { ClientWaitingSpot } from "./client-waiting-spot";

export const metadata: Metadata = {
  title: "Mi lugar en la fila",
};

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ClientWaitingSpot token={token} />;
}
