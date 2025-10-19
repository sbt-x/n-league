import {
  Controller,
  Post,
  Body,
  Param,
  Get,
  Headers,
  UnauthorizedException,
  UseGuards,
  Req,
} from "@nestjs/common";
import { KickRoomDto } from "./dto/kick-room.dto";
import { CreateRoomDto } from "./dto/create-room.dto";
import { JoinRoomDto } from "./dto/join-room.dto";
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
    @Req() req: Request & { uuid?: string }
  ) {
    const token = req.headers["authorization"]?.replace(/^Bearer\s+/i, "") as
      | string
      | undefined;
    return this.roomsService.createRoom(dto, token);
  }

  /**
   * ルーム情報を取得する
   *
   * @param roomId
   * @returns
   */
  @Get(":roomId")
  getRoom(@Param("roomId") roomId: string) {
    return this.roomsService.getRoom(roomId);
  }

  /**
   * ルームに入室する
   *
   * @param roomId
   * @param dto
   * @param auth
   * @returns
   */
  @Post(":roomId/join")
  joinRoom(
    @Param("roomId") roomId: string,
    @Body() dto: JoinRoomDto,
    @Headers("authorization") auth?: string
  ) {
    return this.roomsService.joinRoom(
      roomId,
      dto,
      auth?.replace(/^Bearer\s+/i, "")
    );
  }

  /**
   * ルームを退室する
   *
   * @param roomId
   * @param req
   * @returns
   */
  @Post(":roomId/leave")
  @UseGuards(TokenGuard)
  leaveRoom(
    @Param("roomId") roomId: string,
    @Req() req: Request & { uuid?: string }
  ) {
    const token = req.headers["authorization"]?.replace(/^Bearer\s+/i, "") as
      | string
      | undefined;
    return this.roomsService.leaveRoom(roomId, token);
  }

  /**
   * メンバーをキックする
   *
   * @param roomId
   * @param dto
   * @param req
   * @returns
   */
  @Post(":roomId/kick")
  @UseGuards(TokenGuard)
  kickMember(
    @Param("roomId") roomId: string,
    @Body() dto: KickRoomDto,
    @Req() req: Request & { uuid?: string }
  ) {
    const token = req.headers["authorization"]?.replace(/^Bearer\s+/i, "") as
      | string
      | undefined;
    return this.roomsService.kickMember(roomId, dto, token);
  }
}
