import {
  LayoutDashboard,
  CalendarDays,
  Radio,
  Users,
  Building2,
  Scissors,
  Clock,
  BarChart3,
  Settings,
  Wallet,
  CreditCard,
  Calculator,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Navegación principal del panel del profesional. */
export const APP_NAV: NavItem[] = [
  { href: "/app", label: "Inicio", icon: LayoutDashboard },
  { href: "/app/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/app/sala", label: "Sala de espera", icon: Radio },
  { href: "/app/clientes", label: "Clientes", icon: Users },
  { href: "/app/comercios", label: "Mis comercios", icon: Building2 },
  { href: "/app/servicios", label: "Servicios", icon: Scissors },
  { href: "/app/horarios", label: "Horarios", icon: Clock },
  { href: "/app/metricas", label: "Métricas", icon: BarChart3 },
  { href: "/app/caja", label: "Cierre de caja", icon: Calculator },
  { href: "/ajustes/pagos", label: "Cobros", icon: Wallet },
  { href: "/app/suscripcion", label: "Suscripción", icon: CreditCard },
  { href: "/app/configuracion", label: "Configuración", icon: Settings },
];
