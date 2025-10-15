import { Module } from "@nestjs/common";
import { TokenController } from "./token.controller";
import { RoomsModule } from "../rooms/rooms.module";

@Module({
  imports: [RoomsModule],
  controllers: [TokenController],
})
export class TokenModule {}
