import { AppShell } from "./app-shell";
import { RequireAuth } from "@/components/require-auth";
import { RequireOnboarded } from "@/components/require-onboarded";
import { ComercioProvider } from "@/components/comercio-context";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth role="professional">
      <RequireOnboarded>
        <ComercioProvider>
          <AppShell>{children}</AppShell>
        </ComercioProvider>
      </RequireOnboarded>
    </RequireAuth>
  );
}
