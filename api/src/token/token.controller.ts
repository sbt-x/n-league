import { Controller, Get } from "@nestjs/common";
import { RoomsService } from "../rooms/rooms.service";

@Controller("token")
export class TokenController {
  constructor(private readonly roomsService: RoomsService) {}

  /**
   * JWT発行API: GET /token
   */
  @Get()
  issueToken() {
    return this.roomsService.issueUserToken();
  }
}
