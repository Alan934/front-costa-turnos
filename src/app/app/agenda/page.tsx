import type { Metadata } from "next";
import { AgendaView } from "./agenda-view";

export const metadata: Metadata = {
  title: "Agenda",
};

export default function Page() {
  return <AgendaView />;
}
