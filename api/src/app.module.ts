import { Module } from "@nestjs/common";
import { UsersModule } from "./users/users.module";
import { AuthModule } from "./auth/auth.module";

import { HealthCheckModule } from "./healthcheck/healthcheck.module";

@Module({
  imports: [UsersModule, AuthModule, HealthCheckModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
