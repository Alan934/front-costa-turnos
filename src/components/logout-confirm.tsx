"use client";

import { type ReactNode, useState } from "react";
import { LogOut } from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";

/**
 * Envuelve el botón de cerrar sesión con un diálogo de confirmación.
 * El trigger se pasa como `children` (con DialogTrigger asChild) para
 * respetar el estilo propio de cada panel.
 */
export function LogoutConfirm({ children }: { children: ReactNode }) {
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await logout();
    } finally {
      // Tras cerrar sesión el shell suele desmontarse; igual dejamos el
      // estado consistente por si la vista permanece montada.
      setLoading(false);
      setOpen(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cerrar sesión</DialogTitle>
          <DialogDescription>
            ¿Seguro que querés cerrar sesión? Tendrás que volver a ingresar para usar tu cuenta.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 p-6 pt-3">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleLogout} loading={loading}>
            <LogOut className="size-4" />
            Cerrar sesión
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
