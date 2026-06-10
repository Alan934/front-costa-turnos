"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import { customInstance } from "@/lib/api/axios-instance";
import { env } from "@/lib/env";
import { RealtimeEvents, type RoomUpdatePayload } from "./events";
import type { WaitingRoom } from "@/mocks/contract-extensions";

export type ConnectionState = "connecting" | "live" | "polling" | "offline";

const queryKey = (staffId: string) => ["waiting-room", staffId];

function fetchRoom(staffId: string, signal?: AbortSignal) {
  return customInstance<WaitingRoom>({
    url: `/v1/appointments/waiting-room/${staffId}`,
    method: "GET",
    signal,
  });
}

/**
 * Estado de la sala de espera en vivo para un staff.
 * - Trae el snapshot por REST (tipado, base para SSR/primera carga).
 * - Intenta una conexión Socket.IO; ante `roomUpdate` actualiza la query.
 * - Si el socket no conecta (p. ej. mocks), cae a polling cada `pollMs`.
 */
export function useWaitingRoom(staffId: string, { pollMs = 5000 } = {}) {
  const qc = useQueryClient();
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const socketRef = useRef<Socket | null>(null);

  const query = useQuery({
    queryKey: queryKey(staffId),
    queryFn: ({ signal }) => fetchRoom(staffId, signal),
    enabled: !!staffId,
    // Si caímos a polling, refrescamos en intervalo; si hay socket, no hace falta.
    refetchInterval: connection === "polling" ? pollMs : false,
  });

  useEffect(() => {
    if (!staffId) return;
    let cancelled = false;

    const socket = io(env.socketUrl, {
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
      qc.setQueryData(queryKey(staffId), payload.room);
    });

    const fallbackToPolling = () => {
      if (cancelled) return;
      // Sin tiempo real disponible: usamos polling sobre REST.
      setConnection((c) => (c === "live" ? c : "polling"));
    };
    socket.on("connect_error", fallbackToPolling);
    socket.io.on("reconnect_failed", fallbackToPolling);
    socket.on("disconnect", () => !cancelled && setConnection("polling"));

    // Si en 4.5s no conectó, asumimos polling (caso mocks sin socket server).
    const t = setTimeout(() => {
      if (!cancelled && !socket.connected) setConnection("polling");
    }, 4500);

    return () => {
      cancelled = true;
      clearTimeout(t);
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [staffId, qc]);

  return {
    room: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    connection,
    /** Fuerza un refetch del snapshot (tras una acción del profesional). */
    invalidate: () => qc.invalidateQueries({ queryKey: queryKey(staffId) }),
  };
}
