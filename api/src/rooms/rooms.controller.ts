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

  @Get(":roomId")
  getRoom(@Param("roomId") roomId: string) {
    return this.roomsService.getRoom(roomId);
  }

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
