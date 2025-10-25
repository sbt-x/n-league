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
  // in-memory room game state (phase, rounds, scores) keyed by inviteCode
  private roomGameState: Map<
    string,
    {
      phase: "LOBBY" | "IN_ROUND" | "LOCKED" | "REVEAL" | "RESULT";
      roundIndex: number;
      rounds: Array<{
        index: number;
        snapshots: Record<
          string,
          { pngBase64?: string; updatedAt?: string } | null
        >;
        judgments: Record<string, boolean | null>;
        allCorrect?: boolean;
      }>;
      scores: Record<string, number>; // playerUuid -> score
    }
  > = new Map();
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

  // ensure a game state exists for a room
  private ensureGameState(roomId: string) {
    let gs = this.roomGameState.get(roomId);
    if (!gs) {
      gs = {
        phase: "LOBBY",
        roundIndex: 0,
        rounds: [
          {
            index: 0,
            snapshots: {},
            judgments: {},
          },
        ],
        scores: {},
      };
      this.roomGameState.set(roomId, gs);
    }
    return gs;
  }

  private async isHostClient(client: Socket, roomId: string) {
    try {
      const clientUuid = client.data?.uuid as string | undefined;
      if (!clientUuid) return false;
      const room = await this.roomsService.getRoom(roomId);
      const host = room.members.find((m: any) => m.isHost);
      if (!host) return false;
      return host.uuid === clientUuid;
    } catch (e) {
      return false;
    }
  }

  /**
   * 部屋状態を全員に通知する
   *
   * @param roomId
   */
  async emitRoomState(roomId: string) {
    try {
      let room: any = null;
      try {
        room = await (this.roomsService as any).getRoomWithRounds(roomId);
      } catch (e) {
        room = await this.roomsService.getRoom(roomId);
      }
      // include in-memory completed member UUIDs so clients can initialize
      const completed = Array.from(this.completedMembers.get(roomId) ?? []);
      // merge in-memory game state (phase, roundIndex, rounds, scores) if present
      const gs = this.roomGameState.get(roomId);
      const merged = { ...room, completedMembers: completed };
      if (gs) {
        merged.phase = gs.phase;
        merged.roundIndex = gs.roundIndex;
        merged.rounds = gs.rounds;
        merged.scores = gs.scores;
      }
      this.server.to(roomId).emit("roomState", merged);
    } catch (e) {
      // If room not found or any error occurs while fetching room state,
      // don't let it bubble up. This can happen when emit is triggered with
      // an invite code or stale/invalid id — ignore silently.
    }
  }

  /**
   * クライアントがPNGスナップショットを送信したとき
   */
  @SubscribeMessage("submit-snapshot")
  async handleSubmitSnapshot(
    @MessageBody()
    data: {
      roomId: string;
      playerId?: string; // uuid
      snapshot?: { pngBase64?: string; updatedAt?: string };
    },
    @ConnectedSocket() client: Socket
  ) {
    const uuid = client.data?.uuid as string | undefined;
    if (!uuid) return;
    if (!data || !data.roomId || !data.playerId || !data.snapshot) return;
    try {
      const gs = this.ensureGameState(data.roomId);
      const r = gs.rounds[gs.roundIndex];
      if (!r) return;
      // only accept snapshot when in IN_ROUND or LOCKED (allow late store)
      if (!(gs.phase === "IN_ROUND" || gs.phase === "LOCKED")) return;
      r.snapshots[data.playerId] = data.snapshot;
      // persist via service if available
      try {
        if ((this.roomsService as any).submitSnapshot) {
          await (this.roomsService as any).submitSnapshot(
            data.roomId,
            data.playerId,
            data.snapshot.pngBase64
          );
        }
      } catch (err) {
        // ignore persistence errors for now
      }
      // notify room that snapshots updated
      this.emitRoomState(data.roomId);
    } catch (e) {
      // ignore
    }
  }

  @SubscribeMessage("start-game")
  async handleStartGame(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket
  ) {
    if (!(await this.isHostClient(client, data.roomId))) return;
    const gs = this.ensureGameState(data.roomId);
    gs.phase = "IN_ROUND";
    gs.roundIndex = gs.roundIndex ?? 0;
    // ensure current round exists
    if (!gs.rounds[gs.roundIndex]) {
      gs.rounds[gs.roundIndex] = {
        index: gs.roundIndex,
        snapshots: {},
        judgments: {},
      };
    }
    // Clear in-memory recent strokes and completed markers for a fresh round
    try {
      this.recentStrokes.set(data.roomId, []);
      this.completedMembers.set(data.roomId, new Set<string>());
      // notify clients to clear their canvases
      this.server.to(data.roomId).emit("canvas:clearAll");
    } catch (e) {}

    this.emitRoomState(data.roomId);
  }

  @SubscribeMessage("lock-answers")
  async handleLockAnswers(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket
  ) {
    if (!(await this.isHostClient(client, data.roomId))) return;
    const gs = this.ensureGameState(data.roomId);
    gs.phase = "LOCKED";
    // force-complete any guest who hasn't submitted yet
    try {
      const room = await this.roomsService.getRoom(data.roomId);
      const guestMembers = room.members.filter((m: any) => !m.isHost);
      const set = this.completedMembers.get(data.roomId) ?? new Set<string>();
      for (const m of guestMembers) {
        const uuid = m.uuid;
        if (!set.has(uuid)) {
          set.add(uuid);
          // emit memberCompleted for each forced submission so clients update
          this.server.to(data.roomId).emit("memberCompleted", uuid);
        }
      }
      this.completedMembers.set(data.roomId, set);
    } catch (e) {
      // ignore
    }

    // also notify clients that sends should be disabled
    try {
      this.server.to(data.roomId).emit("answers:locked");
    } catch (e) {}

    this.emitRoomState(data.roomId);
  }

  @SubscribeMessage("judge-player")
  async handleJudgePlayer(
    @MessageBody() data: { roomId: string; playerId: string; correct: boolean },
    @ConnectedSocket() client: Socket
  ) {
    if (!(await this.isHostClient(client, data.roomId))) return;
    if (!data || !data.roomId || !data.playerId) return;
    const gs = this.ensureGameState(data.roomId);
    const r = gs.rounds[gs.roundIndex];
    if (!r) return;
    r.judgments[data.playerId] = data.correct;
    this.emitRoomState(data.roomId);
  }

  @SubscribeMessage("open-answers")
  async handleOpenAnswers(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket
  ) {
    if (!(await this.isHostClient(client, data.roomId))) return;
    const gs = this.ensureGameState(data.roomId);
    const r = gs.rounds[gs.roundIndex];
    if (!r) return;
    // compute allCorrect for connected guests (exclude host)
    try {
      const room = await this.roomsService.getRoom(data.roomId);
      const guestMembers = room.members.filter((m: any) => !m.isHost);
      const connectedGuests = guestMembers.map((m: any) => m.uuid);
      let allCorrect = true;
      for (const uuid of connectedGuests) {
        const judged = r.judgments[uuid];
        if (judged !== true) {
          allCorrect = false;
          break;
        }
      }
      r.allCorrect = allCorrect;
      // update per-player scores: increment if judged true
      for (const uuid of connectedGuests) {
        const isCorrect = r.judgments[uuid] === true;
        if (!gs.scores[uuid]) gs.scores[uuid] = 0;
        if (isCorrect) gs.scores[uuid] += 1;
      }
    } catch (e) {
      // ignore
    }
    gs.phase = "REVEAL";
    this.emitRoomState(data.roomId);
  }

  @SubscribeMessage("next-question")
  async handleNextQuestion(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket
  ) {
    if (!(await this.isHostClient(client, data.roomId))) return;
    const gs = this.ensureGameState(data.roomId);
    gs.roundIndex = (gs.roundIndex ?? 0) + 1;
    gs.rounds[gs.roundIndex] = {
      index: gs.roundIndex,
      snapshots: {},
      judgments: {},
    };
    gs.phase = "IN_ROUND";
    // clear in-memory strokes and completed markers so guests start fresh
    try {
      this.recentStrokes.set(data.roomId, []);
      this.completedMembers.set(data.roomId, new Set<string>());
      this.server.to(data.roomId).emit("canvas:clearAll");
    } catch (e) {
      // ignore
    }
    this.emitRoomState(data.roomId);
  }

  @SubscribeMessage("end-quiz")
  async handleEndQuiz(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket
  ) {
    if (!(await this.isHostClient(client, data.roomId))) return;
    const gs = this.ensureGameState(data.roomId);
    gs.phase = "RESULT";
    this.emitRoomState(data.roomId);
  }

  @SubscribeMessage("restart-game")
  async handleRestartGame(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket
  ) {
    if (!(await this.isHostClient(client, data.roomId))) return;
    // reset in-memory game state for the room so points do not carry over
    this.roomGameState.set(data.roomId, {
      phase: "LOBBY",
      roundIndex: 0,
      rounds: [
        {
          index: 0,
          snapshots: {},
          judgments: {},
        },
      ],
      scores: {},
    });
    // clear completed marks as well
    this.completedMembers.set(data.roomId, new Set<string>());
    this.recentStrokes.set(data.roomId, []);
    this.emitRoomState(data.roomId);
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
