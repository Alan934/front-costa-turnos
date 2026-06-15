import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type AxiosResponse,
} from "axios";
import { env } from "@/lib/env";
import { emitSubscriptionBlocked, isSubscriptionForbidden } from "@/lib/billing-events";

/**
 * Instancia de axios usada por TODO el cliente generado por orval.
 * - baseURL desde NEXT_PUBLIC_API_URL.
 * - inyecta el access token (bearer) si existe.
 * - withCredentials para soportar cookies de sesión/refresh.
 */
export const axiosInstance = axios.create({
  baseURL: env.apiUrl,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

const TOKEN_KEY = "costa-access-token";
const REFRESH_KEY = "costa-refresh-token";
const EXPIRES_AT_KEY = "costa-token-expires-at"; // epoch ms de expiración del access token

let accessToken: string | null =
  typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;

let refreshToken: string | null =
  typeof window !== "undefined" ? localStorage.getItem(REFRESH_KEY) : null;

/** Setea (o limpia) el bearer token; lo persiste para sobrevivir recargas. */
export function setAccessToken(token: string | null) {
  accessToken = token;
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

/** Setea (o limpia) el refresh token; lo persiste para sobrevivir recargas. */
export function setRefreshToken(token: string | null) {
  refreshToken = token;
  // Sin refresh token no hay nada que renovar: cancelar cualquier timer pendiente.
  if (!token) clearProactiveRefresh();
  if (typeof window === "undefined") return;
  if (token) {
    localStorage.setItem(REFRESH_KEY, token);
  } else {
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(EXPIRES_AT_KEY);
  }
}

/** Guarda ambos tokens de una respuesta de auth en un solo paso y agenda la renovación. */
export function setAuthTokens(tokens: {
  accessToken: string;
  refreshToken?: string | null;
  expiresIn?: string | number | null;
}) {
  setAccessToken(tokens.accessToken);
  if (tokens.refreshToken != null) setRefreshToken(tokens.refreshToken);
  scheduleProactiveRefresh(tokens.expiresIn);
}

/**
 * Renovación proactiva: programa un `POST /auth/refresh` poco antes de que expire el access
 * token, para no esperar al 401. `expiresIn` viene en segundos (p.ej. "3600").
 */
const REFRESH_SKEW_MS = 60_000; // renovar 60s antes de la expiración real
let proactiveTimer: ReturnType<typeof setTimeout> | null = null;

function clearProactiveRefresh() {
  if (proactiveTimer) {
    clearTimeout(proactiveTimer);
    proactiveTimer = null;
  }
}

function triggerProactiveRefresh() {
  // Reusa la cola del 401 para no solapar refreshes; si falla, cierra sesión.
  refreshing = refreshing ?? runRefresh().finally(() => {
    refreshing = null;
  });
  refreshing.then((token) => {
    if (!token) {
      setAccessToken(null);
      setRefreshToken(null);
      onSessionExpired?.();
    }
  });
}

/** Agenda el timer para un instante de expiración absoluto (epoch ms). */
function armProactiveTimer(expiresAt: number) {
  clearProactiveRefresh();
  // Renovar antes del vencimiento; nunca antes de 5s para no atropellar un login recién hecho.
  const delay = Math.max(expiresAt - Date.now() - REFRESH_SKEW_MS, 5_000);
  proactiveTimer = setTimeout(() => {
    proactiveTimer = null;
    triggerProactiveRefresh();
  }, delay);
}

function scheduleProactiveRefresh(expiresIn?: string | number | null) {
  if (typeof window === "undefined") return;
  clearProactiveRefresh();
  if (!refreshToken || expiresIn == null) return;

  const seconds = typeof expiresIn === "number" ? expiresIn : Number(expiresIn);
  if (!Number.isFinite(seconds) || seconds <= 0) return;

  const expiresAt = Date.now() + seconds * 1000;
  localStorage.setItem(EXPIRES_AT_KEY, String(expiresAt));
  armProactiveTimer(expiresAt);
}

/**
 * Reprograma la renovación tras un reload usando el `expiresAt` persistido. Si ya venció (o
 * falta menos que el margen), renueva de inmediato. Lo llama el AuthProvider al montar.
 */
export function initProactiveRefresh() {
  if (typeof window === "undefined" || !refreshToken) return;
  const raw = localStorage.getItem(EXPIRES_AT_KEY);
  const expiresAt = raw ? Number(raw) : NaN;
  if (!Number.isFinite(expiresAt)) return;
  if (expiresAt - Date.now() <= REFRESH_SKEW_MS) triggerProactiveRefresh();
  else armProactiveTimer(expiresAt);
}

export function getAccessToken() {
  return accessToken;
}

export function getRefreshToken() {
  return refreshToken;
}

/** Callback que la app registra para reaccionar a una sesión que ya no se puede renovar. */
let onSessionExpired: (() => void) | null = null;
export function setOnSessionExpired(cb: (() => void) | null) {
  onSessionExpired = cb;
}

axiosInstance.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

/**
 * Renovación de tokens ante un 401.
 *
 * Un solo refresh en vuelo a la vez: si varias requests reciben 401 simultáneamente,
 * todas esperan al mismo `POST /auth/refresh` (cola) y luego se reintentan con el token nuevo.
 * Si el refresh falla (o no hay refresh token), se limpia la sesión y se avisa a la UI.
 */
let refreshing: Promise<string | null> | null = null;

/**
 * Llama a `/auth/refresh` con una instancia de axios "cruda" (sin interceptores) para evitar
 * recursión: si el propio refresh diera 401, no debe intentar refrescarse a sí mismo.
 */
async function runRefresh(): Promise<string | null> {
  if (!refreshToken) return null;
  try {
    const res = await axios.post<{
      accessToken: string;
      refreshToken?: string;
      expiresIn?: string;
    }>(
      "/auth/refresh",
      { refreshToken },
      { baseURL: env.apiUrl, withCredentials: true },
    );
    setAuthTokens(res.data);
    return res.data.accessToken;
  } catch {
    return null;
  }
}

type RetriableConfig = AxiosRequestConfig & { _retry?: boolean };

axiosInstance.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<{ message?: string }>) => {
    const status = error.response?.status;
    const message = error.response?.data?.message;

    if (isSubscriptionForbidden(status, message)) {
      emitSubscriptionBlocked(
        message ?? "Tu prueba o suscripción venció. Aboná para seguir usando el sistema.",
      );
      return Promise.reject(error);
    }

    const original = error.config as RetriableConfig | undefined;
    const isAuthCall =
      typeof original?.url === "string" && original.url.includes("/auth/");

    // 401 en una request normal: intentar renovar token una vez y reintentar.
    if (status === 401 && original && !original._retry && !isAuthCall && refreshToken) {
      original._retry = true;
      refreshing = refreshing ?? runRefresh().finally(() => {
        refreshing = null;
      });
      const newToken = await refreshing;
      if (newToken) {
        original.headers = original.headers ?? {};
        (original.headers as Record<string, string>).Authorization = `Bearer ${newToken}`;
        return axiosInstance(original);
      }
      // No se pudo renovar: cerrar sesión local y avisar a la app.
      setAccessToken(null);
      setRefreshToken(null);
      onSessionExpired?.();
    }

    return Promise.reject(error);
  },
);

/**
 * Mutator que orval invoca por cada operación. Devuelve `response.data`
 * para que los hooks tipados resuelvan al payload, no al AxiosResponse.
 * Se le adjunta `.cancel()` para soportar cancelación de queries.
 *
 * Nota: el contrato ya trae el prefijo `/v1` en cada path versionado (y deja `auth/*`,
 * `health`, `r/:slug/*` y `payments/mp/oauth/*` sin prefijo). Por eso la baseURL es la raíz
 * del backend, sin `/v1`.
 */
export const customInstance = <T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): Promise<T> => {
  const source = axios.CancelToken.source();
  const promise = axiosInstance({
    ...config,
    ...options,
    cancelToken: source.token,
  }).then((res: AxiosResponse<T>) => res.data);

  // @ts-expect-error -- orval espera poder cancelar la promesa.
  promise.cancel = () => {
    source.cancel("Query cancelada por React Query");
  };

  return promise;
};

export type ErrorType<Error> = AxiosError<Error>;
export type BodyType<BodyData> = BodyData;
