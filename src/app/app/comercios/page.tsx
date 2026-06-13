import type { Metadata } from "next";
import { MyComerciosView } from "./my-comercios-view";

export const metadata: Metadata = {
  title: "Mis comercios",
};

export default function Page() {
  return <MyComerciosView />;
}
