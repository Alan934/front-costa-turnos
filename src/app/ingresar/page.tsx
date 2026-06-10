import type { Metadata } from "next";
import { LoginRegister } from "./login-register";

export const metadata: Metadata = {
  title: "Ingresar",
};

export default function Page() {
  return <LoginRegister />;
}
