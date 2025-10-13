import { Controller, Get } from "@nestjs/common";

@Controller()
export class HealthCheckController {
  @Get("/hc")
  getHealthCheck(): string {
    return "ok";
  }

  @Get("/hc2")
  getHealthCheck2() {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  }
}
