import type { Metadata } from "next";
import { RequireAuth } from "@/components/require-auth";
import { MyAppointmentsView } from "./my-appointments-view";

export const metadata: Metadata = {
  title: "Mis turnos",
};

export default function Page() {
  return (
    <RequireAuth role="client">
      <MyAppointmentsView />
    </RequireAuth>
  );
}
