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
import { TokenService } from "../token/token.service";

@WebSocketGateway({
  namespace: "/rooms",
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
})
export class RoomsGateway {
  // プレイヤーが完了ボタンを押したとき
  @SubscribeMessage("complete")
  handleComplete(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket
  ) {
    // サーバで検証済みの uuid を利用して通知
    const uuid = client.data?.uuid as string | undefined;
    if (!uuid) return;
    this.server.to(data.roomId).emit("memberCompleted", uuid);
  }

  // プレイヤーが送信取り消しボタンを押したとき
  @SubscribeMessage("cancelComplete")
  handleCancelComplete(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket
  ) {
    const uuid = client.data?.uuid as string | undefined;
    if (!uuid) return;
    this.server.to(data.roomId).emit("memberCancelled", uuid);
  }
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly roomsService: RoomsService,
    private readonly tokenService: TokenService
  ) {}

  // クライアントが部屋にjoin
  @SubscribeMessage("join")
  handleJoin(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket
  ) {
    const uuid = client.data?.uuid as string | undefined;
    if (!uuid) return;
    client.join(data.roomId);
    this.emitRoomState(data.roomId);
  }

  // クライアントが部屋からleave
  @SubscribeMessage("leave")
  handleLeave(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket
  ) {
    const uuid = client.data?.uuid as string | undefined;
    if (!uuid) return;
    client.leave(data.roomId);
    this.emitRoomState(data.roomId);
  }

  // 接続時に JWT を検証して client.data.uuid に保存する
  async handleConnection(client: Socket) {
    try {
      const token = (client.handshake?.auth as any)?.token as
        | string
        | undefined;
      if (!token) {
        client.disconnect(true);
        return;
      }
      const uuid = this.tokenService.verifyUserToken(token);
      if (!uuid) {
        client.disconnect(true);
        return;
      }
      client.data.uuid = uuid;
    } catch (e) {
      client.disconnect(true);
    }
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
