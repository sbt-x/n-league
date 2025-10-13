import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

export interface RoomState {
  id: string;
  name: string;
  members: Array<{ id: string; name: string; isHost: boolean }>;
}

export function useRoomSocket(roomId: string) {
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io("http://localhost:3000/rooms");
    socketRef.current = socket;
    socket.emit("join", { roomId, memberId: "host" });
    socket.on("roomState", (state: RoomState) => {
      setRoomState(state);
    });
    return () => {
      socket.emit("leave", { roomId, memberId: "host" });
      socket.disconnect();
    };
  }, [roomId]);

  return roomState;
}
