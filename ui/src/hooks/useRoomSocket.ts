import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

export interface RoomState {
  id: string;
  name: string;
  members: Array<{ id: string; name: string; isHost: boolean }>;
  meId?: string;
}

export function useRoomSocket(roomId: string, memberId: string) {
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [completedMemberIds, setCompletedMemberIds] = useState<string[]>([]);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io("http://localhost:3000/rooms");
    socketRef.current = socket;
    socket.emit("join", { roomId, memberId });
    socket.on("roomState", (state: RoomState) => {
      setRoomState({ ...state, meId: memberId });
    });
    socket.on("memberCompleted", (completedId: string) => {
      setCompletedMemberIds((prev) =>
        prev.includes(completedId) ? prev : [...prev, completedId]
      );
    });
    return () => {
      socket.emit("leave", { roomId, memberId });
      socket.disconnect();
    };
  }, [roomId, memberId]);

  return { roomState, socket: socketRef.current, completedMemberIds };
}
