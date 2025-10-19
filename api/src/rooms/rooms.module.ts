import { Module } from "@nestjs/common";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { RoomsController } from "./rooms.controller";
import { RoomsService } from "./rooms.service";
import { RoomsGateway } from "./rooms.gateway";
import { AuthModule } from "../auth/auth.module";
import { TokenModule } from "../token/token.module";
import { PrismaModule } from "../prisma/prisma.module";
import { TokenGuard } from "../common/guards/token.guard";

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    AuthModule,
    TokenModule,
    PrismaModule,
  ],
  controllers: [RoomsController],
  providers: [RoomsService, RoomsGateway, TokenGuard],
  exports: [RoomsService],
})
export class RoomsModule {}
