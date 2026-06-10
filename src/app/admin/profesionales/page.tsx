import type { Metadata } from "next";
import { ProfessionalsAdmin } from "./professionals-admin";

export const metadata: Metadata = {
  title: "Profesionales · Admin",
};

export default function Page() {
  return <ProfessionalsAdmin />;
}
