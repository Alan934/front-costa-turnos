import type { Metadata } from "next";
import { ClientsAdmin } from "./clients-admin";

export const metadata: Metadata = {
  title: "Clientes · Admin",
};

export default function Page() {
  return <ClientsAdmin />;
}
