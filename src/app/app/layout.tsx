import { AppShell } from "./app-shell";
import { RequireAuth } from "@/components/require-auth";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth role="professional">
      <AppShell>{children}</AppShell>
    </RequireAuth>
  );
}
