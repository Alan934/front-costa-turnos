import type { Metadata } from "next";
import { AdminMetricsView } from "./admin-metrics-view";

export const metadata: Metadata = {
  title: "Métricas · Admin",
};

export default function Page() {
  return <AdminMetricsView />;
}
