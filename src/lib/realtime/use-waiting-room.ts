"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import { customInstance } from "@/lib/api/axios-instance";
import { env } from "@/lib/env";
import { RealtimeEvents, WAITING_ROOM_NAMESPACE, type RoomUpdatePayload } from "./events";
import type { WaitingRoomDto } from "@/lib/api/generated/model/waitingRoomDto";
import type { MyWaitingSpotDto } from "@/lib/api/generated/model/myWaitingSpotDto";

export type ConnectionState = "connecting" | "live" | "polling" | "offline";

/** Si en este tiempo el socket no conectó, asumimos que no hay tiempo real y vamos a polling. */
const SOCKET_TIMEOUT_MS = 4500;

/**
 * Suscripción al canal en vivo de una agenda. Devuelve el estado de conexión y
 * llama a `onUpdate` con cada snapshot. Si el socket no conecta (mocks, red del
 * local, proxy sin websockets), avisa para que el consumidor caiga a polling.
 */
function useRoomSocket(staffId: string, onUpdate: (payload: RoomUpdatePayload) => void) {
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const socketRef = useRef<Socket | null>(null);
  // El handler cambia en cada render; lo leemos por ref para no reconectar el socket.
  const handlerRef = useRef(onUpdate);
  handlerRef.current = onUpdate;

  useEffect(() => {
    if (!staffId) return;
    let cancelled = false;

    const socket = io(`${env.socketUrl}${WAITING_ROOM_NAMESPACE}`, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 3,
      timeout: 4000,
      autoConnect: true,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      if (cancelled) return;
      setConnection("live");
      socket.emit(RealtimeEvents.joinStaffRoom, { staffId });
    });

    socket.on(RealtimeEvents.roomUpdate, (payload: RoomUpdatePayload) => {
      if (cancelled || payload.staffId !== staffId) return;
      handlerRef.current(payload);
    });

    const fallbackToPolling = () => {
      if (cancelled) return;
      setConnection((c) => (c === "live" ? c : "polling"));
    };
    socket.on("connect_error", fallbackToPolling);
    socket.io.on("reconnect_failed", fallbackToPolling);
    socket.on("disconnect", () => !cancelled && setConnection("polling"));

    const t = setTimeout(() => {
      if (!cancelled && !socket.connected) setConnection("polling");
    }, SOCKET_TIMEOUT_MS);

    return () => {
      cancelled = true;
      clearTimeout(t);
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [staffId]);

  return connection;
}

const roomKey = (staffId: string, membershipId?: string): QueryKey => [
  "waiting-room",
  staffId,
  membershipId ?? "",
];

/**
 * Sala de espera de una agenda, para el panel del profesional.
 * Trae el snapshot por REST y lo mantiene al día por socket; si no hay socket,
 * refresca por polling.
 */
export function useWaitingRoom(
  staffId: string,
  { membershipId, pollMs = 5000 }: { membershipId?: string; pollMs?: number } = {},
) {
  const qc = useQueryClient();
  const queryKey = roomKey(staffId, membershipId);

  // El socket es anónimo y por eso no trae los pendientes de aprobación (ver
  // `emitWaitingRoom` en el back): acá el evento solo avisa "algo cambió" y se recarga
  // por REST, que sí está autenticado y los incluye.
  const onUpdate = useCallback(
    () => void qc.invalidateQueries({ queryKey }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [qc, staffId, membershipId],
  );
  const connection = useRoomSocket(staffId, onUpdate);

  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      customInstance<WaitingRoomDto>({
        url: `/v1/appointments/waiting-room/${staffId}`,
        method: "GET",
        params: membershipId ? { membershipId } : undefined,
        signal,
      }),
    enabled: !!staffId,
    refetchInterval: connection === "polling" ? pollMs : false,
  });

  return {
    room: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    connection,
    /** Fuerza un refetch del snapshot (tras una acción del profesional). */
    invalidate: () => qc.invalidateQueries({ queryKey }),
  };
}

/**
 * Sala de espera pública de un comercio (la pantalla del QR). Sin auth: solo
 * lectura. `membershipId` es opcional para el comercio-de-uno.
 */
export function usePublicWaitingRoom(
  slug: string,
  membershipId?: string,
  { pollMs = 8000 }: { pollMs?: number } = {},
) {
  const qc = useQueryClient();
  const queryKey: QueryKey = ["public-waiting-room", slug, membershipId ?? ""];

  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      customInstance<WaitingRoomDto>({
        url: membershipId
          ? `/r/${slug}/professionals/${membershipId}/sala`
          : `/r/${slug}/sala`,
        method: "GET",
        signal,
      }),
    enabled: !!slug,
  });

  // El socket se une por staffId, que recién conocemos con el primer snapshot.
  const onUpdate = useCallback(
    (payload: RoomUpdatePayload) => {
      // Un staff puede atender en varios comercios y comparte una sola sala de socket:
      // un evento de OTRO comercio no debe pisar la cola de esta pantalla.
      const current = qc.getQueryData<WaitingRoomDto>(queryKey);
      if (current?.membershipId && payload.room.membershipId !== current.membershipId) return;
      qc.setQueryData(queryKey, payload.room);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [qc, slug, membershipId],
  );
  const connection = useRoomSocket(query.data?.staffId ?? "", onUpdate);

  const polling = connection !== "live";
  useEffect(() => {
    if (!polling || !query.data) return;
    const t = setInterval(() => void query.refetch(), pollMs);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polling, pollMs, !!query.data]);

  return {
    room: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    connection,
  };
}

/**
 * Lugar del cliente en la fila, por el token de su link personal (/sala/t/:token).
 * Público: no requiere sesión.
 */
export function useMyWaitingSpot(token: string, { pollMs = 8000 }: { pollMs?: number } = {}) {
  const qc = useQueryClient();
  const queryKey: QueryKey = ["waiting-spot", token];

  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      customInstance<MyWaitingSpotDto>({ url: `/sala/t/${token}`, method: "GET", signal }),
    enabled: !!token,
  });

  // Ante un cambio en la sala, el lugar propio se recalcula del lado del back.
  const onUpdate = useCallback(
    () => void qc.invalidateQueries({ queryKey }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [qc, token],
  );
  const connection = useRoomSocket(query.data?.room.staffId ?? "", onUpdate);

  const polling = connection !== "live";
  useEffect(() => {
    if (!polling || !query.data) return;
    const t = setInterval(() => void query.refetch(), pollMs);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polling, pollMs, !!query.data]);

  return {
    spot: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    connection,
  };
}
