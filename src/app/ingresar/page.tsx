import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginRegister } from "./login-register";
import { baseOpenGraph } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Ingresar",
  // Es el link que se le pasa a un profesional para que se sume: la tarjeta lo invita a probar.
  openGraph: {
    ...baseOpenGraph,
    title: "Sumate a Costa Turnos",
    description:
      "Creá tu cuenta y armá tu página de reservas en minutos. Turnos online, fila virtual y cobros con MercadoPago. 15 días gratis, sin tarjeta.",
    url: "/ingresar",
  },
};

export default function Page() {
  return (
    <Suspense>
      <LoginRegister />
    </Suspense>
  );
}
