"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  customInstance,
  setAccessToken,
  getAccessToken,
} from "@/lib/api/axios-instance";
import type { AuthTokensDto } from "@/lib/api/generated/model/authTokensDto";
import type { LoginDto } from "@/lib/api/generated/model/loginDto";
import type { RegisterDto } from "@/lib/api/generated/model/registerDto";
import type { MeResponse, AccountRole } from "@/mocks/contract-extensions";

interface AuthContextValue {
  user: MeResponse | null;
  /** Carga inicial de sesión en curso. */
  loading: boolean;
  isAuthenticated: boolean;
  roles: AccountRole[];
  hasRole: (r: AccountRole) => boolean;
  login: (dto: LoginDto) => Promise<MeResponse>;
  register: (dto: RegisterDto) => Promise<MeResponse>;
  logout: () => Promise<void>;
  /** Re-lee /auth/me (tras reclamar cuenta, etc.). */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * `GET /auth/me` no tiene schema en el contrato (devuelve `void`, ver API-GAPS §1) y el
 * backend lo describe como "{ sub, email, rol, tenant }". Normalizamos las variantes de
 * nombre más probables para que el ruteo por rol funcione contra el back real.
 */
function normalizeMe(raw: Record<string, unknown>): MeResponse {
  const roleAlias: Record<string, AccountRole> = {
    admin: "admin",
    platform_admin: "admin",
    superadmin: "admin",
    professional: "professional",
    owner: "professional",
    staff: "professional",
    client: "client",
    customer: "client",
  };
  const rawRoles = Array.isArray(raw.roles)
    ? (raw.roles as unknown[])
    : raw.role != null
      ? [raw.role]
      : [];
  const roles = rawRoles
    .map((r) => roleAlias[String(r).toLowerCase()] ?? (String(r) as AccountRole))
    .filter((r, i, a) => a.indexOf(r) === i);

  const professionalId =
    (raw.professionalId as string) ??
    (raw.tenantId as string) ??
    (raw.tenant as string) ??
    null;

  // Solo definimos emailVerified si el back lo manda; si no, queda undefined (sin aviso).
  const verifiedRaw =
    raw.emailVerified ?? raw.isEmailVerified ?? raw.verified ?? raw.emailVerifiedAt;
  const emailVerified =
    verifiedRaw === undefined || verifiedRaw === null
      ? undefined
      : typeof verifiedRaw === "boolean"
        ? verifiedRaw
        : Boolean(verifiedRaw); // p.ej. emailVerifiedAt (fecha) => verificado

  return {
    id: String(raw.id ?? raw.sub ?? ""),
    email: String(raw.email ?? ""),
    fullName: String(raw.fullName ?? raw.name ?? ""),
    roles,
    professionalId,
    emailVerified,
  };
}

async function fetchMe(): Promise<MeResponse | null> {
  if (!getAccessToken()) return null;
  try {
    const raw = await customInstance<Record<string, unknown>>({ url: "/auth/me", method: "GET" });
    return normalizeMe(raw ?? {});
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [user, setUser] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchMe().then((u) => {
      if (active) {
        setUser(u);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const afterAuth = useCallback(async () => {
    const u = await fetchMe();
    setUser(u);
    return u;
  }, []);

  const login = useCallback(
    async (dto: LoginDto) => {
      const tokens = await customInstance<AuthTokensDto>({
        url: "/auth/login",
        method: "POST",
        data: dto,
      });
      setAccessToken(tokens.accessToken);
      const u = await afterAuth();
      if (!u) throw new Error("No se pudo cargar la sesión");
      return u;
    },
    [afterAuth],
  );

  const register = useCallback(
    async (dto: RegisterDto) => {
      const tokens = await customInstance<AuthTokensDto>({
        url: "/auth/register",
        method: "POST",
        data: dto,
      });
      setAccessToken(tokens.accessToken);
      const u = await afterAuth();
      if (!u) throw new Error("No se pudo cargar la sesión");
      return u;
    },
    [afterAuth],
  );

  const logout = useCallback(async () => {
    try {
      await customInstance({ url: "/auth/logout", method: "POST" });
    } catch {
      // ignorar errores de red en logout
    }
    setAccessToken(null);
    setUser(null);
    qc.clear();
  }, [qc]);

  const refresh = useCallback(async () => {
    await afterAuth();
  }, [afterAuth]);

  const roles = user?.roles ?? [];

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        roles,
        hasRole: (r) => roles.includes(r),
        login,
        register,
        logout,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
