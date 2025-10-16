import {
  Controller,
  Post,
  Body,
  Param,
  Get,
  Headers,
  UnauthorizedException,
} from "@nestjs/common";
import { KickRoomDto } from "./dto/kick-room.dto";
import { CreateRoomDto } from "./dto/create-room.dto";
import { JoinRoomDto } from "./dto/join-room.dto";
import { RoomsService } from "./rooms.service";

@Controller("rooms")
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post()
  createRoom(
    @Body() dto: CreateRoomDto,
    @Headers("authorization") auth?: string
  ) {
    const token = auth?.replace(/^Bearer\s+/i, "");
    if (!token) throw new UnauthorizedException("Authorization token required");
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
  leaveRoom(
    @Param("roomId") roomId: string,
    @Headers("authorization") auth?: string
  ) {
    const token = auth?.replace(/^Bearer\s+/i, "");
    return this.roomsService.leaveRoom(roomId, token);
  }

  @Post(":roomId/kick")
  kickMember(
    @Param("roomId") roomId: string,
    @Body() dto: KickRoomDto,
    @Headers("authorization") auth?: string
  ) {
    const token = auth?.replace(/^Bearer\s+/i, "");
    if (!token) throw new UnauthorizedException("Authorization token required");
    return this.roomsService.kickMember(roomId, dto, token);
  }
}
