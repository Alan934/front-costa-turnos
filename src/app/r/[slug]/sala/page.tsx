import { Suspense } from "react";
import type { Metadata } from "next";
import { PublicWaitingRoomPage } from "./public-waiting-room";

export const metadata: Metadata = {
  title: "Sala de espera",
};

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // La vista lee `?pro=` y `?tv=` con useSearchParams: Next exige el Suspense.
  return (
    <Suspense>
      <PublicWaitingRoomPage slug={slug} />
    </Suspense>
  );
}
