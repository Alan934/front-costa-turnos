import type { Metadata } from "next";
import { CashClosingView } from "./cash-closing-view";

export const metadata: Metadata = {
  title: "Cierre de caja",
};

export default function Page() {
  return <CashClosingView />;
}
