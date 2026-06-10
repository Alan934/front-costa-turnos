import type { Metadata } from "next";
import { MetricsView } from "./metrics-view";

export const metadata: Metadata = {
  title: "Métricas",
};

export default function Page() {
  return <MetricsView />;
}
