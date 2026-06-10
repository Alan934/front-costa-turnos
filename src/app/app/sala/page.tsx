import type { Metadata } from "next";
import { StaffWaitingRoomControl } from "./staff-waiting-room-control";

export const metadata: Metadata = {
  title: "Sala de espera",
};

// Nota: por ahora es una página autónoma. Cuando exista el shell de /app
// (dashboard/agenda), se integra a su layout con la topbar y navegación.
export default function Page() {
  return <StaffWaitingRoomControl />;
}
