import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginRegister } from "./login-register";

export const metadata: Metadata = {
  title: "Ingresar",
};

export default function Page() {
  return (
    <Suspense>
      <LoginRegister />
    </Suspense>
  );
}
