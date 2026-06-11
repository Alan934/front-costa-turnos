import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyEmail } from "./verify-email";

export const metadata: Metadata = {
  title: "Verificar email",
};

export default function Page() {
  return (
    <Suspense>
      <VerifyEmail />
    </Suspense>
  );
}
