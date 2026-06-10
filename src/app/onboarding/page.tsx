import type { Metadata } from "next";
import { RequireAuth } from "@/components/require-auth";
import { OnboardingView } from "./onboarding-view";

export const metadata: Metadata = {
  title: "Configurá tu negocio",
};

export default function Page() {
  // Sin rol fijo: el onboarding es el acto de "volverse profesional"; el backend autoriza
  // la creación del tenant. Así no rebota a una cuenta recién registrada cuyo rol aún no sea
  // "professional".
  return (
    <RequireAuth>
      <OnboardingView />
    </RequireAuth>
  );
}
