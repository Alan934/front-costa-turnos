import type { Metadata } from "next";
import { Suspense } from "react";
import { PaymentsSettings } from "./payments-settings";

export const metadata: Metadata = {
  title: "Cobros · MercadoPago",
};

export default function Page() {
  // Suspense: PaymentsSettings lee ?mp= (resultado del callback de MercadoPago) con useSearchParams.
  return (
    <Suspense>
      <PaymentsSettings />
    </Suspense>
  );
}
