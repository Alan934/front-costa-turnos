import type { Metadata } from "next";
import { ClaimAccount } from "./claim-account";

export const metadata: Metadata = {
  title: "Reclamar cuenta",
};

export default function Page() {
  return <ClaimAccount />;
}
