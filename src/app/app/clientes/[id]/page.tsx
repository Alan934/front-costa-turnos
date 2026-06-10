import type { Metadata } from "next";
import { ClientDetail } from "./client-detail";

export const metadata: Metadata = {
  title: "Ficha de cliente",
};

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ClientDetail clientId={id} />;
}
