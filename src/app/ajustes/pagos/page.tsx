import type { Metadata } from "next";
import { Suspense } from "react";
import { RequireAuth } from "@/components/require-auth";
import { PaymentsSettings } from "./payments-settings";

export const metadata: Metadata = {
  title: "Cobros · MercadoPago",
};

export default function Page() {
  return (
    <RequireAuth role="professional">
      <Suspense>
        <PaymentsSettings />
      </Suspense>
    </RequireAuth>
  );
}
