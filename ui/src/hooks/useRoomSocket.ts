import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { getCookie } from "../utils/cookie";
import { jwtDecode } from "jwt-decode";

export interface RoomState {
  roomId: string;
  hostId: string;
  hostName: string;
  maxPlayers?: number;
  // how/when players' answers should be revealed to others
  revealMode?: "realtime" | "onDecision";
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
    // listen for a cross-window event that notifies we just created a DB member
    const handleJoinedEvent = (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail as
          | { roomId?: string }
          | undefined;
        if (!detail) return;
        const joinedRoomId = detail.roomId;
        if (joinedRoomId && socketRef.current) {
          socketRef.current.emit("join", { roomId: joinedRoomId });
        }
      } catch (err) {
        // ignore
      }
    };
    window.addEventListener("joinedRoom", handleJoinedEvent as EventListener);
    // send only inviteCode as roomId; server uses validated uuid from handshake
    socket.emit("join", { roomId });
    socket.on("roomState", (state: RoomState) => {
      // roomState from server may include completedMembers (UUIDs) - merge into client state
      // Note: RoomState type in this file doesn't declare completedMembers to avoid tight coupling with server types
      const anyState = state as any;
      setRoomState({ ...state, meId: memberId });
      if (
        anyState?.completedMembers &&
        Array.isArray(anyState.completedMembers)
      ) {
        setCompletedMemberIds(anyState.completedMembers as string[]);
      }
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
      window.removeEventListener(
        "joinedRoom",
        handleJoinedEvent as EventListener
      );
      socket.disconnect();
    };
  }, [roomId, memberId]);

  // provide a getter to access the latest socket (socketRef.current may change
  // without re-rendering consumers). Keep backward-compatible `socket` field
  // (may be null on first render) and add `getSocket()` for robust access.
  return {
    roomState,
    socket: socketRef.current,
    completedMemberIds,
    getSocket: () => socketRef.current,
  };
}
