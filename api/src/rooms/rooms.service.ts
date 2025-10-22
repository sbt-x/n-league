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
import { PrismaService } from "../prisma/prisma.service";
import { Role } from "@prisma/client";

@Injectable()
export class RoomsService {
  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly tokenService: TokenService,
    private readonly prisma: PrismaService
  ) {}

  /**
   * Resolve a room by its inviteCode.
   * Returns the room with members included or null if not found.
   */
  private async findRoomByInviteCode(inviteCode: string): Promise<any | null> {
    const room = await this.prisma.room.findUnique({
      where: { inviteCode },
      include: { members: true },
    });
    return room;
  }

  /**
   * JWTトークンを検証し、UUIDを取得
   */
  verifyUserToken(token: string): string | null {
    return this.tokenService.verifyUserToken(token);
  }

  /**
   * ルームを作成する
   *
   * @param dto
   * @param token
   * @returns
   */
  async createRoom(dto: CreateRoomDto, token?: string) {
    // トークンが提供され、有効であればホストのUUIDを取得
    let hostUuid: string | undefined = undefined;
    if (token) {
      hostUuid = this.tokenService.verifyUserToken(token) ?? undefined;
    }
    if (!hostUuid) {
      throw new BadRequestException("Invalid token");
    }

    // generate short inviteCode and retry if unique constraint conflict occurs
    const maxAttempts = 5;
    let createdRoom: any = null;
    let inviteCode: string | undefined = undefined;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      inviteCode = nanoid(8);
      try {
        createdRoom = await this.prisma.room.create({
          data: {
            name: dto.name,
            maxPlayers: dto.maxPlayers ?? 6,
            inviteCode,
            members: {
              create: {
                name: dto.name,
                uuid: hostUuid,
                role: Role.host,
              },
            },
          },
          include: { members: true },
        });
        break;
      } catch (e: any) {
        // Prisma unique constraint error code P2002
        if (e?.code === "P2002") {
          // collision on inviteCode, retry
          continue;
        }
        throw e;
      }
    }
    if (!createdRoom) {
      throw new BadRequestException("Failed to generate unique invite code");
    }

    const roomId = createdRoom.id;
    const hostMember = createdRoom.members[0];

    // no in-memory cache: DB is source-of-truth

    const result = {
      roomId,
      hostId: hostMember.id,
      inviteCode,
    };
    // emit using inviteCode so websocket gateway can lookup and broadcast to
    // the same room clients joined (clients join by inviteCode)
    this.eventEmitter.emit("room.stateChanged", inviteCode);
    return result;
  }

  /**
   * ルーム情報を取得する
   *
   * @param roomId
   * @returns
   */
  async getRoom(inviteCode: string) {
    const room = await this.findRoomByInviteCode(inviteCode);
    if (!room) throw new NotFoundException("Room not found");

    const members = room.members.map((m) => ({
      id: m.id,
      name: m.name,
      isHost: m.role === Role.host,
      uuid: m.uuid,
    }));

    const host = members.find((m) => m.isHost);

    // Interpret room.maxPlayers as the number of guests allowed (exclude host)
    const guestCount = members.filter((m) => !m.isHost).length;

    return {
      roomId: room.id,
      hostId: host?.id,
      roomName: room.name,
      maxPlayers: room.maxPlayers,
      members,
      isFull: guestCount >= room.maxPlayers,
    };
  }

  /**
   * ルームに入室する
   *
   * @param roomId
   * @param dto
   * @param token
   * @returns
   */
  async joinRoom(inviteCode: string, dto: JoinRoomDto, token?: string) {
    // 指定された inviteCode のルームをDBから取得し存在チェック
    const room = await this.findRoomByInviteCode(inviteCode);
    if (!room) throw new NotFoundException("Room not found");

    // ルームが定員に達していないか確認する
    // Note: room.maxPlayers represents allowed guests (host excluded)
    const guestMembers = room.members.filter((m: any) => m.role !== Role.host);
    if (guestMembers.length >= room.maxPlayers) {
      throw new BadRequestException("Room is full");
    }

    // トークンが渡されていれば検証してユーザーの UUID を取得する
    let memberUuid: string | undefined = undefined;
    if (token) {
      memberUuid = this.tokenService.verifyUserToken(token) ?? undefined;
    }

    // 認証されていないゲストの場合、DB の非 NULL 制約を満たすために内部 UUID を生成する
    if (!memberUuid) {
      memberUuid = nanoid(12);
    }

    // member レコードを DB に作成する
    let createdMember: any;
    try {
      createdMember = await this.prisma.member.create({
        data: {
          name: dto.name,
          uuid: memberUuid,
          role: Role.guest,
          room: { connect: { id: room.id } },
        },
      });
    } catch (e: any) {
      // P2002: 一意制約違反の場合は既存の member を検索してそれを使用する
      if (e?.code === "P2002") {
        const existing = await this.prisma.member.findFirst({
          where: { roomId: room.id, uuid: memberUuid },
        });
        if (existing) {
          createdMember = existing;
        } else {
          throw e;
        }
      } else {
        throw e;
      }
    }

    // emit state changed so gateways fetch fresh state from DB
    // emit using canonical room id
    // notify listeners using inviteCode (clients are joined by inviteCode)
    this.eventEmitter.emit("room.stateChanged", inviteCode);

    return {
      memberId: createdMember.id,
      memberUuid: createdMember.uuid,
      isHost: createdMember.role === Role.host,
    };
  }

  /**
   * ルームを退室する
   *
   * @param roomId
   * @param token
   * @returns
   */
  async leaveRoom(inviteCode: string, token?: string) {
    if (!token) throw new BadRequestException("Authorization token required");
    const uuid = this.tokenService.verifyUserToken(token);
    if (!uuid) throw new BadRequestException("Invalid token");
    // resolve room by inviteCode
    const room = await this.findRoomByInviteCode(inviteCode);
    if (!room) throw new NotFoundException("Room not found");

    // find member in DB by roomId + uuid
    const member = await this.prisma.member.findFirst({
      where: { roomId: room.id, uuid },
    });
    if (!member) throw new NotFoundException("Member not found");

    const wasHost = member.role === Role.host;

    // delete member
    try {
      await this.prisma.member.delete({ where: { id: member.id } });
    } catch (e: any) {
      // ignore if already deleted
    }

    if (wasHost) {
      const remaining = await this.prisma.member.findMany({
        where: { roomId: room.id },
        orderBy: { createdAt: "asc" },
      });
      if (remaining.length > 0) {
        const newHost = remaining[0];
        await this.prisma.member.update({
          where: { id: newHost.id },
          data: { role: Role.host },
        });
      } else {
        // no remaining members: delete room
        try {
          await this.prisma.room.delete({ where: { id: room.id } });
        } catch (e: any) {}
      }
    }
    // use inviteCode to notify websocket gateway
    this.eventEmitter.emit("room.stateChanged", inviteCode);
    return { success: true };
  }

  /**
   * メンバーをキックする
   *
   * @param roomId
   * @param dto
   * @param token
   * @returns
   */
  async kickMember(
    inviteCode: string,
    dto: { hostId: string; memberId?: string; memberUuid?: string },
    token?: string
  ) {
    // DB-driven kick: verify token owner is current host in this room
    if (!token) throw new BadRequestException("Authorization token required");
    const tokenUuid = this.tokenService.verifyUserToken(token);
    if (!tokenUuid) throw new BadRequestException("Invalid token");

    // resolve room by inviteCode
    const room = await this.findRoomByInviteCode(inviteCode);
    if (!room) throw new NotFoundException("Room not found");

    // verify token owner is host of the room
    const caller = await this.prisma.member.findFirst({
      where: { roomId: room.id, uuid: tokenUuid },
    });
    if (!caller || caller.role !== Role.host) {
      throw new BadRequestException("Only host can kick");
    }

    // determine target member
    let target: any = null;
    if (dto.memberUuid) {
      target = await this.prisma.member.findFirst({
        where: { roomId: room.id, uuid: dto.memberUuid },
      });
    }
    if (!target && dto.memberId) {
      target = await this.prisma.member.findUnique({
        where: { id: dto.memberId },
      });
      if (target && target.roomId !== room.id) target = null;
    }
    if (!target) throw new NotFoundException("Member not found");

    const wasHost = target.role === Role.host;

    try {
      await this.prisma.member.delete({ where: { id: target.id } });
    } catch (e: any) {
      // ignore
    }

    if (wasHost) {
      const remaining = await this.prisma.member.findMany({
        where: { roomId: room.id },
        orderBy: { createdAt: "asc" },
      });
      if (remaining.length > 0) {
        const newHost = remaining[0];
        await this.prisma.member.update({
          where: { id: newHost.id },
          data: { role: Role.host },
        });
      } else {
        try {
          await this.prisma.room.delete({ where: { id: room.id } });
        } catch (e: any) {}
      }
    }

    // notify via inviteCode so gateway can emit to the joined sockets
    this.eventEmitter.emit("room.stateChanged", inviteCode);
    return { success: true, kicked: target.id };
  }

  /**
   * ルーム設定を更新する（現状は maxPlayers のみ）
   */
  async updateRoom(
    inviteCode: string,
    dto: { maxPlayers?: number },
    token?: string
  ) {
    if (!token) throw new BadRequestException("Authorization token required");
    const uuid = this.verifyUserToken(token);
    if (!uuid) throw new BadRequestException("Invalid token");

    const room = await this.findRoomByInviteCode(inviteCode);
    if (!room) throw new NotFoundException("Room not found");

    // verify caller is host
    const caller = await this.prisma.member.findFirst({
      where: { roomId: room.id, uuid },
    });
    if (!caller || caller.role !== Role.host) {
      throw new BadRequestException("Only host can update room");
    }

    const updateData: any = {};
    if (typeof dto.maxPlayers === "number") {
      // Ensure we don't set maxPlayers less than the current guest count
      const guestCount = room.members.filter(
        (m: any) => m.role !== Role.host
      ).length;
      if (dto.maxPlayers < guestCount) {
        throw new BadRequestException(
          "maxPlayers cannot be less than current guest count"
        );
      }
      updateData.maxPlayers = dto.maxPlayers;
    }

    if (Object.keys(updateData).length === 0) return { success: true };

    await this.prisma.room.update({ where: { id: room.id }, data: updateData });
    this.eventEmitter.emit("room.stateChanged", room.id);
    return { success: true };
  }
}
