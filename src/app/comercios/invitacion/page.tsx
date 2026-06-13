import type { Metadata } from "next";
import { Suspense } from "react";
import { AcceptInvitation } from "./accept-invitation";

export const metadata: Metadata = {
  title: "Aceptar invitación",
};

export default function Page() {
  return (
    <Suspense>
      <AcceptInvitation />
    </Suspense>
  );
}
