import {
  LayoutDashboard,
  CalendarDays,
  Radio,
  Hourglass,
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

export interface NavGroup {
  /** Título del grupo; `null` = el grupo principal (el día a día), sin título. */
  label: string | null;
  items: NavItem[];
}

const inicio: NavItem = { href: "/app", label: "Inicio", icon: LayoutDashboard };
const agenda: NavItem = { href: "/app/agenda", label: "Agenda", icon: CalendarDays };
const sala: NavItem = { href: "/app/sala", label: "Sala de espera", icon: Radio };
const clientes: NavItem = { href: "/app/clientes", label: "Clientes", icon: Users };

/** Navegación del panel del profesional, agrupada por para qué se usa. */
export const APP_NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [
      inicio,
      agenda,
      sala,
      { href: "/app/lista-espera", label: "Lista de espera", icon: Hourglass },
      clientes,
    ],
  },
  {
    label: "Negocio",
    items: [
      { href: "/app/servicios", label: "Servicios", icon: Scissors },
      { href: "/app/horarios", label: "Horarios", icon: Clock },
      { href: "/app/comercios", label: "Mis comercios", icon: Building2 },
    ],
  },
  {
    label: "Plata",
    items: [
      { href: "/app/caja", label: "Cierre de caja", icon: Calculator },
      { href: "/app/cobros", label: "Cobros", icon: Wallet },
      { href: "/app/metricas", label: "Métricas", icon: BarChart3 },
    ],
  },
  {
    label: "Cuenta",
    items: [
      { href: "/app/suscripcion", label: "Suscripción", icon: CreditCard },
      { href: "/app/configuracion", label: "Configuración", icon: Settings },
    ],
  },
];

/** Todas las secciones, en orden. */
export const APP_NAV: NavItem[] = APP_NAV_GROUPS.flatMap((g) => g.items);

/** Barra inferior en el celular: lo que se usa todo el día en el local. El resto va en "Más". */
export const MOBILE_TABS: NavItem[] = [
  inicio,
  agenda,
  { ...sala, label: "Sala" },
  clientes,
];

/** ¿Esta sección es la de la ruta actual? */
export function isNavActive(href: string, pathname: string): boolean {
  return href === "/app" ? pathname === "/app" : pathname.startsWith(href);
}
