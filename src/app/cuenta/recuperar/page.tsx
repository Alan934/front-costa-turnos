import type { Metadata } from "next";
import { RecoverPassword } from "./recover-password";

export const metadata: Metadata = {
  title: "Recuperar contraseña",
};

export default function Page() {
  return <RecoverPassword />;
}
