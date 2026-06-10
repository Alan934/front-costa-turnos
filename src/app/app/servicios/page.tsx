import type { Metadata } from "next";
import { ServicesManager } from "./services-manager";

export const metadata: Metadata = {
  title: "Servicios",
};

export default function Page() {
  return <ServicesManager />;
}
