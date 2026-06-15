import type { Metadata } from "next";
import { ComerciosAdmin } from "./comercios-admin";

export const metadata: Metadata = {
  title: "Comercios · Admin",
};

export default function Page() {
  return <ComerciosAdmin />;
}
