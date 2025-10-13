import { Test, TestingModule } from "@nestjs/testing";
import { HealthCheckModule } from "./healthcheck.module";

describe("HealthCheckModule", () => {
  let module: HealthCheckModule;

  beforeEach(async () => {
    const testingModule: TestingModule = await Test.createTestingModule({
      imports: [HealthCheckModule],
    }).compile();

    module = testingModule.get<HealthCheckModule>(HealthCheckModule);
  });

  it("should be defined", () => {
    expect(module).toBeDefined();
  });
});
