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
  // in-memory recent strokes per room; keys are roomId -> { authorId?: string, stroke: any }[]
  private recentStrokes: Map<
    string,
    Array<{ authorId?: string; stroke: any }>
  > = new Map();
  // track which members have completed per room (in-memory)
  // keys are roomId -> Set<uuid>
  private completedMembers: Map<string, Set<string>> = new Map();
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
    // mark completed in-memory
    try {
      const set = this.completedMembers.get(data.roomId) ?? new Set<string>();
      set.add(uuid);
      this.completedMembers.set(data.roomId, set);
    } catch (e) {
      // ignore
    }
    this.server.to(data.roomId).emit("memberCompleted", uuid);
  }

  /**
   * クライアントがストロークを送信したとき
   */
  @SubscribeMessage("draw:stroke")
  handleDrawStroke(
    @MessageBody() data: { roomId: string; stroke: any },
    @ConnectedSocket() client: Socket
  ) {
    const uuid = client.data?.uuid as string | undefined;
    if (!uuid) return;
    if (!data || !data.roomId || !data.stroke) return;

    // store to recent strokes (bounded list)
    try {
      const list = this.recentStrokes.get(data.roomId) ?? [];
      list.push({ authorId: uuid, stroke: data.stroke });
      // keep only last 200 strokes to bound memory
      if (list.length > 200) list.splice(0, list.length - 200);
      this.recentStrokes.set(data.roomId, list);
    } catch (e) {
      // ignore storage failures
    }

    // broadcast to room
    try {
      this.server
        .to(data.roomId)
        .emit("draw:broadcast", { authorId: uuid, stroke: data.stroke });
    } catch (e) {
      // ignore
    }
  }

  @SubscribeMessage("canvas:sync:request")
  handleCanvasSyncRequest(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket
  ) {
    const uuid = client.data?.uuid as string | undefined;
    if (!uuid) return;
    if (!data || !data.roomId) return;
    const list = this.recentStrokes.get(data.roomId) ?? [];
    // convert to strokesByAuthor map
    const strokesByAuthor: Record<string, any[]> = {};
    for (const item of list) {
      const author = item.authorId ?? "unknown";
      if (!strokesByAuthor[author]) strokesByAuthor[author] = [];
      strokesByAuthor[author].push(item.stroke);
    }
    client.emit("canvas:sync:state", { strokesByAuthor });
  }

  /**
   * クライアントがキャンバスをクリアしたとき
   */
  @SubscribeMessage("canvas:clear")
  handleCanvasClear(
    @MessageBody() data: { roomId: string; authorId?: string },
    @ConnectedSocket() client: Socket
  ) {
    const uuid = client.data?.uuid as string | undefined;
    if (!uuid) return;
    if (!data || !data.roomId || !data.authorId) return;

    // remove recent strokes from in-memory store for that author
    try {
      const list = this.recentStrokes.get(data.roomId) ?? [];
      const filtered = list.filter((item) => item.authorId !== data.authorId);
      this.recentStrokes.set(data.roomId, filtered);
    } catch (e) {
      // ignore
    }

    // broadcast clear event to room so hosts can update their view
    try {
      this.server
        .to(data.roomId)
        .emit("canvas:clear", { authorId: data.authorId });
    } catch (e) {
      // ignore
    }
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
    // remove from completed set
    try {
      const set = this.completedMembers.get(data.roomId);
      if (set) {
        set.delete(uuid);
        this.completedMembers.set(data.roomId, set);
      }
    } catch (e) {
      // ignore
    }
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
    // remove any completed marker for this uuid in this room
    try {
      const set = this.completedMembers.get(data.roomId);
      if (set) {
        set.delete(uuid);
        this.completedMembers.set(data.roomId, set);
      }
    } catch (e) {
      // ignore
    }
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
        // remove from completed set for this room if present
        try {
          const set = this.completedMembers.get(roomId);
          if (set) {
            set.delete(uuid);
            this.completedMembers.set(roomId, set);
          }
        } catch (e) {
          // ignore
        }
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
  async emitRoomState(roomId: string) {
    try {
      const room = await this.roomsService.getRoom(roomId);
  // include in-memory completed member UUIDs so clients can initialize
  const completed = Array.from(this.completedMembers.get(roomId) ?? []);
  this.server.to(roomId).emit("roomState", { ...room, completedMembers: completed });
    } catch (e) {
      // If room not found or any error occurs while fetching room state,
      // don't let it bubble up. This can happen when emit is triggered with
      // an invite code or stale/invalid id — ignore silently.
    }
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
