import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { RoomsService } from "./rooms.service";
import { OnEvent } from "@nestjs/event-emitter";

@WebSocketGateway({
  namespace: "/rooms",
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
})
export class RoomsGateway {
  @WebSocketServer()
  server: Server;

  constructor(private readonly roomsService: RoomsService) {}

  // クライアントが部屋にjoin
  @SubscribeMessage("join")
  handleJoin(
    @MessageBody() data: { roomId: string; memberId: string },
    @ConnectedSocket() client: Socket
  ) {
    client.join(data.roomId);
    this.emitRoomState(data.roomId);
  }

  // クライアントが部屋からleave
  @SubscribeMessage("leave")
  handleLeave(
    @MessageBody() data: { roomId: string; memberId: string },
    @ConnectedSocket() client: Socket
  ) {
    client.leave(data.roomId);
    this.emitRoomState(data.roomId);
  }

  // 部屋状態を全員に通知
  emitRoomState(roomId: string) {
    const room = this.roomsService.getRoom(roomId);
    this.server.to(roomId).emit("roomState", room);
  }

  @OnEvent("room.stateChanged")
  handleRoomStateChanged(roomId: string) {
    this.emitRoomState(roomId);
  }
}
