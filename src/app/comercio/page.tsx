import type { Metadata } from "next";
import { ComercioPanel } from "./comercio-panel";

export const metadata: Metadata = {
  title: "Mi comercio",
};

export default function Page() {
  return <ComercioPanel />;
}
