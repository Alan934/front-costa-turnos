/**
 * Contratos de eventos de la sala de espera en vivo (Socket.IO).
 * El contrato REST no documenta el canal de tiempo real (ver API-GAPS §4); definimos
 * acá los nombres de evento y payloads que el backend debería implementar. Mientras
 * tanto, el cliente cae a polling sobre GET /appointments/waiting-room/{staffId}.
 */
import type { WaitingRoom } from "@/mocks/contract-extensions";

export const RealtimeEvents = {
  /** El cliente se une a la sala de un staff. */
  joinStaffRoom: "waiting-room:join",
  /** Snapshot completo de la sala (al unirse y ante cada cambio). */
  roomUpdate: "waiting-room:update",
} as const;

export interface RoomUpdatePayload {
  staffId: string;
  room: WaitingRoom;
}
