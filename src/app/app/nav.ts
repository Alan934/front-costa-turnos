import {
  LayoutDashboard,
  CalendarDays,
  Radio,
  Users,
  Scissors,
  Clock,
  BarChart3,
  Settings,
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
  { href: "/app/servicios", label: "Servicios", icon: Scissors },
  { href: "/app/horarios", label: "Horarios", icon: Clock },
  { href: "/app/metricas", label: "Métricas", icon: BarChart3 },
  { href: "/app/configuracion", label: "Configuración", icon: Settings },
];
