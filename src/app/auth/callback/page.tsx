import { Suspense } from "react";
import { AuthCallback } from "./auth-callback";

export default function Page() {
  return (
    <Suspense fallback={<CallbackSplash />}>
      <AuthCallback />
    </Suspense>
  );
}

function CallbackSplash() {
  return (
    <div className="grid min-h-dvh place-items-center bg-background">
      <p className="text-sm text-muted-foreground">Iniciando sesión…</p>
    </div>
  );
}
