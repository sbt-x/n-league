import { Test, TestingModule } from "@nestjs/testing";
import { HealthCheckController } from "./healthcheck.controller";

describe("HealthCheckController", () => {
  let controller: HealthCheckController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthCheckController],
    }).compile();

    controller = module.get<HealthCheckController>(HealthCheckController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  it("/hc", () => {
    // 実装に合わせて修正してください
    expect(controller.getHealthCheck()).toEqual("ok");
  });

  it("/hc2", () => {
    // 実装に合わせて修正: statusとtimestampを持つオブジェクトを検証
    const result = controller.getHealthCheck2();
    expect(result).toHaveProperty("status", "ok");
    expect(result).toHaveProperty("timestamp");
    expect(typeof result.timestamp).toBe("string");
  });
});
