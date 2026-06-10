import type { Metadata } from "next";
import { ScheduleManager } from "./schedule-manager";

export const metadata: Metadata = {
  title: "Horarios",
};

export default function Page() {
  return <ScheduleManager />;
}
