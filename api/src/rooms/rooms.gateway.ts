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
  /**
   * プレイヤーが描画送信ボタンを押したとき
   *
   * @param data
   * @param client
   * @returns
   */
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

  /**
   * プレイヤーが描画送信キャンセルボタンを押したとき
   *
   * @param data
   * @param client
   * @returns
   */
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

  /**
   * クライアントが入室したとき
   *
   * @param data
   * @param client
   * @returns
   */
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

  /**
   * クライアントが退室したとき
   *
   * @param data
   * @param client
   * @returns
   */
  @SubscribeMessage("leave")
  handleLeave(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket
  ) {
    const uuid = client.data?.uuid as string | undefined;
    if (!uuid) return;
    client.leave(data.roomId);
    const token = (client.handshake?.auth as any)?.token as string | undefined;
    // persist leave to DB
    this.roomsService.leaveRoom(data.roomId, token).catch(() => {});
    this.emitRoomState(data.roomId);
  }

  async handleDisconnect(client: Socket) {
    // when a socket disconnects, attempt to remove the member from any rooms
    const uuid = client.data?.uuid as string | undefined;
    if (!uuid) return;
    // try to extract token from handshake if available to call leaveRoom
    const token = (client.handshake?.auth as any)?.token as string | undefined;
    // iterate rooms the socket was part of and call leaveRoom to persist
    const rooms = Array.from(client.rooms).filter((r) => r !== client.id);
    for (const roomId of rooms) {
      try {
        await this.roomsService.leaveRoom(roomId, token);
      } catch (e) {
        // ignore errors for now
      }
    }
  }

  /**
   * 接続時に JWT を検証して client.data.uuid に保存する
   *
   * @param client
   * @returns
   */
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

  /**
   * 部屋状態を全員に通知する
   *
   * @param roomId
   */
  emitRoomState(roomId: string) {
    this.roomsService.getRoom(roomId).then((room) => {
      this.server.to(roomId).emit("roomState", room);
    });
  }

  /**
   * 部屋の状態が変更されたとき
   *
   * @param roomId
   */
  @OnEvent("room.stateChanged")
  handleRoomStateChanged(roomId: string) {
    this.emitRoomState(roomId);
  }
}
