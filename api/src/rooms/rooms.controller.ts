import {
  Controller,
  Post,
  Body,
  Param,
  Get,
  Headers,
  UseGuards,
  Req,
  Patch,
} from "@nestjs/common";
import { KickRoomDto } from "./dto/kick-room.dto";
import { CreateRoomDto } from "./dto/create-room.dto";
import { JoinRoomDto } from "./dto/join-room.dto";
import { JoinByInviteDto } from "./dto/join-by-invite.dto";
import { UpdateRoomDto } from "./dto/update-room.dto";
import { RoomsService } from "./rooms.service";
import { TokenGuard } from "../common/guards/token.guard";
import { Request } from "express";

@Controller("rooms")
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  /**
   * ルームを作成する
   *
   * @param dto
   * @param req
   * @returns
   */
  @Post()
  @UseGuards(TokenGuard)
  createRoom(
    @Body() dto: CreateRoomDto,
    @Req() req: Request & { uuid?: string },
    @Headers("authorization") auth?: string
  ) {
    const token = auth?.replace(/^Bearer\s+/i, "");
    return this.roomsService.createRoom(dto, token);
  }

  /**
   * ルーム情報を取得する (inviteCode ベース)
   *
   * @param inviteCode
   * @returns
   */
  @Get(":inviteCode")
  async getRoom(@Param("inviteCode") inviteCode: string) {
    return await this.roomsService.getRoom(inviteCode);
  }

  /**
   * inviteCode で入室する
   *
   * POST /rooms/join
   */
  @Post("join")
  joinByInvite(
    @Body() dto: JoinByInviteDto,
    @Headers("authorization") auth?: string
  ) {
    // reuse joinRoom service which already accepts id or inviteCode
    return this.roomsService.joinRoom(
      dto.inviteCode,
      { name: dto.name },
      auth?.replace(/^Bearer\s+/i, "")
    );
  }

  /**
   * ルームを退室する (inviteCode ベース)
   *
   * @param inviteCode
   * @param req
   * @returns
   */
  @Post(":inviteCode/leave")
  @UseGuards(TokenGuard)
  leaveRoom(
    @Param("inviteCode") inviteCode: string,
    @Req() req: Request & { uuid?: string },
    @Headers("authorization") auth?: string
  ) {
    const token = auth?.replace(/^Bearer\s+/i, "");
    return this.roomsService.leaveRoom(inviteCode, token);
  }

  /**
   * メンバーをキックする (inviteCode ベース)
   *
   * @param inviteCode
   * @param dto
   * @param req
   * @returns
   */
  @Post(":inviteCode/kick")
  @UseGuards(TokenGuard)
  kickMember(
    @Param("inviteCode") inviteCode: string,
    @Body() dto: KickRoomDto,
    @Req() req: Request & { uuid?: string },
    @Headers("authorization") auth?: string
  ) {
    const token = auth?.replace(/^Bearer\s+/i, "");
    return this.roomsService.kickMember(inviteCode, dto, token);
  }

  /**
   * ルームの設定を更新する（最大人数など）
   */
  @Patch(":inviteCode")
  @UseGuards(TokenGuard)
  updateRoom(
    @Param("inviteCode") inviteCode: string,
    @Body() dto: UpdateRoomDto,
    @Req() req: Request & { uuid?: string },
    @Headers("authorization") auth?: string
  ) {
    const token = auth?.replace(/^Bearer\s+/i, "");
    return this.roomsService.updateRoom(inviteCode, dto, token);
  }
}
