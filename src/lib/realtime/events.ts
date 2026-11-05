/**
 * Contrato del canal de tiempo real de la sala de espera (Socket.IO).
 * El contrato REST no describe el canal, así que los nombres viven acá y están
 * espejados en el gateway del backend (`waiting-room.gateway.ts`).
 */
import type { WaitingRoomDto } from "@/lib/api/generated/model/waitingRoomDto";

/** Namespace del gateway. Sin esto el socket se conecta a "/" y no recibe nada. */
export const WAITING_ROOM_NAMESPACE = "/waiting-room";

export const RealtimeEvents = {
  /** El cliente se une a la sala de un staff. */
  joinStaffRoom: "waiting-room:join",
  /** Snapshot completo de la sala (al unirse y ante cada cambio). */
  roomUpdate: "waiting-room:update",
} as const;

export interface RoomUpdatePayload {
  staffId: string;
  room: WaitingRoomDto;
}
