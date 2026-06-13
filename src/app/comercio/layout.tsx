import { RequireAuth } from "@/components/require-auth";
import { ComercioShell } from "./comercio-shell";

export default function ComercioLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth role="comercial">
      <ComercioShell>{children}</ComercioShell>
    </RequireAuth>
  );
}
