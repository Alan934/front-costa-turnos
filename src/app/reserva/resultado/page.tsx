import type { Metadata } from "next";
import { Suspense } from "react";
import { BookingResultView } from "./booking-result-view";

export const metadata: Metadata = {
  title: "Resultado de tu reserva",
};

export default function Page() {
  return (
    <Suspense>
      <BookingResultView />
    </Suspense>
  );
}
