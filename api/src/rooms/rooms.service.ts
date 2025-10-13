import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { CreateRoomDto } from "./dto/create-room.dto";
import { JoinRoomDto } from "./dto/join-room.dto";
import { nanoid } from "nanoid";
import { EventEmitter2 } from "@nestjs/event-emitter";

@Injectable()
export class RoomsService {
  private rooms: Record<string, any> = {};
  constructor(private readonly eventEmitter: EventEmitter2) {}

  createRoom(dto: CreateRoomDto) {
    const roomId = nanoid(8);
    const hostId = nanoid(12);
    this.rooms[roomId] = {
      roomId,
      hostId,
      hostName: dto.hostName,
      maxPlayers: dto.maxPlayers,
      members: [{ id: hostId, name: dto.hostName, isHost: true }],
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

  joinRoom(roomId: string, dto: JoinRoomDto) {
    const room = this.rooms[roomId];
    if (!room) throw new NotFoundException("Room not found");
    if (room.members.length >= room.maxPlayers)
      throw new BadRequestException("Room is full");
    const memberId = nanoid(12);
    room.members.push({ id: memberId, name: dto.name, isHost: false });
    this.eventEmitter.emit("room.stateChanged", roomId);
    return { memberId, isHost: false };
  }

  leaveRoom(roomId: string, memberId: string) {
    const room = this.rooms[roomId];
    if (!room) throw new NotFoundException("Room not found");
    const idx = room.members.findIndex((m: any) => m.id === memberId);
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
  kickMember(roomId: string, dto: { hostId: string; memberId: string }) {
    const room = this.rooms[roomId];
    if (!room) throw new NotFoundException("Room not found");
    if (room.hostId !== dto.hostId)
      throw new BadRequestException("Only host can kick");
    const idx = room.members.findIndex((m: any) => m.id === dto.memberId);
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
    return { success: true, kicked: dto.memberId };
  }
}
