import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { getCookie } from "../utils/cookie";
import { jwtDecode } from "jwt-decode";

export interface RoomState {
  roomId: string;
  hostId: string;
  hostName: string;
  maxPlayers?: number;
  members: Array<{ id: string; name: string; isHost: boolean; uuid?: string }>;
  isFull?: boolean;
  meId?: string;
}

export function useRoomSocket(roomId: string, memberId: string) {
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [completedMemberIds, setCompletedMemberIds] = useState<string[]>([]);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = getCookie("userJwt");
    // guard: don't connect if there's no token or it's expired
    if (!token) return;
    try {
      const decoded: any = jwtDecode(token);
      if (decoded?.exp && Date.now() >= decoded.exp * 1000) {
        // expired
        console.info("userJwt is expired; not connecting socket");
        return;
      }
    } catch (e) {
      console.info("failed to decode token; not connecting socket", e);
      return;
    }

    const socket = io(`${import.meta.env.VITE_API_URL}/rooms`, {
      auth: { token },
    });
    socketRef.current = socket;
    // send only roomId; server uses validated uuid from handshake
    socket.emit("join", { roomId });
    socket.on("roomState", (state: RoomState) => {
      setRoomState({ ...state, meId: memberId });
    });
    socket.on("memberCompleted", (completedId: string) => {
      console.log("memberCompleted received:", completedId);
      setCompletedMemberIds((prev) =>
        prev.includes(completedId) ? prev : [...prev, completedId]
      );
    });
    socket.on("memberCancelled", (cancelledId: string) => {
      console.log("memberCancelled received:", cancelledId);
      setCompletedMemberIds((prev) => prev.filter((id) => id !== cancelledId));
    });
    return () => {
      socket.emit("leave", { roomId });
      socket.disconnect();
    };
  }, [roomId, memberId]);

  return { roomState, socket: socketRef.current, completedMemberIds };
}
