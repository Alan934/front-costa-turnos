import type { Metadata } from "next";
import { WaitlistView } from "./waitlist-view";

export const metadata: Metadata = {
  title: "Lista de espera",
};

export default function Page() {
  return <WaitlistView />;
}
