import { AppShell } from "./app-shell";
import { RequireAuth } from "@/components/require-auth";
import { RequireOnboarded } from "@/components/require-onboarded";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth role="professional">
      <RequireOnboarded>
        <AppShell>{children}</AppShell>
      </RequireOnboarded>
    </RequireAuth>
  );
}
