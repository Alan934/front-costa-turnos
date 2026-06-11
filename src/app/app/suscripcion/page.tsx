import type { Metadata } from "next";
import { Suspense } from "react";
import { SubscriptionView } from "./subscription-view";

export const metadata: Metadata = {
  title: "Suscripción",
};

export default function Page() {
  return (
    <Suspense>
      <SubscriptionView />
    </Suspense>
  );
}
