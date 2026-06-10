"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState, type ReactNode } from "react";
import { makeQueryClient } from "@/lib/query-client";
import { AuthProvider } from "@/components/auth-provider";
import { SubscriptionGate } from "@/components/subscription-gate";

export function Providers({ children }: { children: ReactNode }) {
  // Un único QueryClient por ciclo de vida del cliente (no recrear en cada render).
  const [queryClient] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {children}
        <SubscriptionGate />
      </AuthProvider>
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      )}
    </QueryClientProvider>
  );
}
