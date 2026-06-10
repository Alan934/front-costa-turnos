import type { Metadata } from "next";
import { SubscriptionView } from "./subscription-view";

export const metadata: Metadata = {
  title: "Suscripción",
};

export default function Page() {
  return <SubscriptionView />;
}
