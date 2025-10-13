import { Module } from "@nestjs/common";
import { UsersModule } from "./users/users.module";
import { AuthModule } from "./auth/auth.module";
import { HealthCheckModule } from "./healthcheck/healthcheck.module";
import { RoomsModule } from "./rooms/rooms.module";

@Module({
  imports: [UsersModule, AuthModule, HealthCheckModule, RoomsModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
