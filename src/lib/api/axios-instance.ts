import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type AxiosResponse,
} from "axios";
import { env } from "@/lib/env";

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

let accessToken: string | null =
  typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;

/** Setea (o limpia) el bearer token; lo persiste para sobrevivir recargas. */
export function setAccessToken(token: string | null) {
  accessToken = token;
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getAccessToken() {
  return accessToken;
}

axiosInstance.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

/**
 * Mutator que orval invoca por cada operación. Devuelve `response.data`
 * para que los hooks tipados resuelvan al payload, no al AxiosResponse.
 * Se le adjunta `.cancel()` para soportar cancelación de queries.
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
