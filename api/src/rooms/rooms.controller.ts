import { Controller, Post, Body, Param, Get } from "@nestjs/common";
import { KickRoomDto } from "./dto/kick-room.dto";
import { CreateRoomDto } from "./dto/create-room.dto";
import { JoinRoomDto } from "./dto/join-room.dto";
import { RoomsService } from "./rooms.service";

@Controller("rooms")
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post()
  createRoom(@Body() dto: CreateRoomDto) {
    return this.roomsService.createRoom(dto);
  }

  @Get(":roomId")
  getRoom(@Param("roomId") roomId: string) {
    return this.roomsService.getRoom(roomId);
  }

  @Post(":roomId/join")
  joinRoom(@Param("roomId") roomId: string, @Body() dto: JoinRoomDto) {
    return this.roomsService.joinRoom(roomId, dto);
  }

  @Post(":roomId/leave")
  leaveRoom(
    @Param("roomId") roomId: string,
    @Body("memberId") memberId: string
  ) {
    return this.roomsService.leaveRoom(roomId, memberId);
  }

  @Post(":roomId/kick")
  kickMember(@Param("roomId") roomId: string, @Body() dto: KickRoomDto) {
    return this.roomsService.kickMember(roomId, dto);
  }
}
