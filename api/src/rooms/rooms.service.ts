import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { CreateRoomDto } from "./dto/create-room.dto";
import { JoinRoomDto } from "./dto/join-room.dto";
import { nanoid } from "nanoid";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { TokenService } from "../token/token.service";

@Injectable()
export class RoomsService {
  private rooms: Record<string, any> = {};
  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly tokenService: TokenService
  ) {}

  /**
   * JWTトークンを検証し、UUIDを取得
   */
  verifyUserToken(token: string): string | null {
    return this.tokenService.verifyUserToken(token);
  }

  createRoom(dto: CreateRoomDto, token?: string) {
    const roomId = nanoid(8);
    const hostId = nanoid(12);
    // attach uuid to host if token provided and valid
    let hostUuid: string | undefined = undefined;
    if (token) {
      hostUuid = this.tokenService.verifyUserToken(token) ?? undefined;
    }
    const hostMember: any = { id: hostId, name: dto.hostName, isHost: true };
    if (hostUuid) hostMember.uuid = hostUuid;
    this.rooms[roomId] = {
      roomId,
      hostId,
      hostName: dto.hostName,
      maxPlayers: dto.maxPlayers,
      members: [hostMember],
    };
    const result = {
      roomId,
      hostId,
      inviteUrl: `/rooms/${roomId}`,
    };
    this.eventEmitter.emit("room.stateChanged", roomId);
    return result;
  }

  getRoom(roomId: string) {
    const room = this.rooms[roomId];
    if (!room) throw new NotFoundException("Room not found");
    return {
      ...room,
      isFull: room.members.length >= room.maxPlayers,
    };
  }

  joinRoom(roomId: string, dto: JoinRoomDto, token?: string) {
    const room = this.rooms[roomId];
    if (!room) throw new NotFoundException("Room not found");
    if (room.members.length >= room.maxPlayers)
      throw new BadRequestException("Room is full");
    const memberId = nanoid(12);
    const member: any = { id: memberId, name: dto.name, isHost: false };
    if (token) {
      const uuid = this.tokenService.verifyUserToken(token);
      if (uuid) member.uuid = uuid;
    }
    room.members.push(member);
    this.eventEmitter.emit("room.stateChanged", roomId);
    return { memberId, isHost: false };
  }

  leaveRoom(roomId: string, token?: string) {
    const room = this.rooms[roomId];
    if (!room) throw new NotFoundException("Room not found");
    if (!token) throw new BadRequestException("Authorization token required");
    let uuid: string | null = null;
    try {
      uuid = this.tokenService.verifyUserToken(token);
    } catch (e) {
      // verifyUserToken returns null on invalid; keep behavior
    }
    if (!uuid) throw new BadRequestException("Invalid token");
    const idx = room.members.findIndex((m: any) => m.uuid === uuid);
    if (idx === -1) throw new NotFoundException("Member not found");
    const wasHost = room.members[idx].isHost;
    room.members.splice(idx, 1);
    // ホストが抜けた場合は自動で引き継ぎ
    if (wasHost && room.members.length > 0) {
      room.members[0].isHost = true;
      room.hostId = room.members[0].id;
      room.hostName = room.members[0].name;
    }
    this.eventEmitter.emit("room.stateChanged", roomId);
    return { success: true };
  }
  kickMember(
    roomId: string,
    dto: { hostId: string; memberId?: string; memberUuid?: string },
    token?: string
  ) {
    const room = this.rooms[roomId];
    if (!room) throw new NotFoundException("Room not found");
    // verify caller is host: token is required and must match host's uuid if host has uuid
    if (!token) throw new BadRequestException("Authorization token required");
    try {
      const hostMember = room.members.find((m: any) => m.id === room.hostId);
      if (!hostMember) throw new NotFoundException("Host not found");
      // if host has uuid, require token.uuid to match; otherwise disallow kicking without host uuid
      if (hostMember.uuid) {
        if (!this.tokenService.isTokenOwnerOfMember(token, hostMember)) {
          throw new BadRequestException("Only host can kick");
        }
      } else {
        // host has no uuid attached -> do not allow kick by token-less or unknown token
        throw new BadRequestException(
          "Host must be authenticated to perform this action"
        );
      }
    } catch (e) {
      if (e instanceof BadRequestException || e instanceof NotFoundException)
        throw e;
      throw new BadRequestException("Invalid token");
    }
    // まず memberUuid でターゲットを特定し、できない場合は memberId を代わりに使用する
    let idx = -1;
    if (dto.memberUuid) {
      idx = room.members.findIndex((m: any) => m.uuid === dto.memberUuid);
    }
    if (idx === -1 && dto.memberId) {
      idx = room.members.findIndex((m: any) => m.id === dto.memberId);
    }
    if (idx === -1) throw new NotFoundException("Member not found");
    const wasHost = room.members[idx].isHost;
    const removedMember = room.members.splice(idx, 1)[0];
    // ホストが抜けた場合は自動で引き継ぎ
    if (wasHost && room.members.length > 0) {
      room.members[0].isHost = true;
      room.hostId = room.members[0].id;
      room.hostName = room.members[0].name;
    }
    this.eventEmitter.emit("room.stateChanged", roomId);
    return { success: true, kicked: removedMember.id };
  }
}
