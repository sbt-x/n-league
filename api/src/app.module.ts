import { Module } from "@nestjs/common";
import { UsersModule } from "./users/users.module";
import { AuthModule } from "./auth/auth.module";
import { HealthCheckModule } from "./healthcheck/healthcheck.module";
import { RoomsModule } from "./rooms/rooms.module";
import { TokenModule } from "./token/token.module";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env.local"],
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    HealthCheckModule,
    RoomsModule,
    TokenModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
