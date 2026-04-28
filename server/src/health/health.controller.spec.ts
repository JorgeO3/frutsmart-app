import { Test, type TestingModule } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { TerminusModule } from "@nestjs/terminus";
import { HealthController } from "./health.controller";

describe("HealthController", () => {
	let controller: HealthController;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			imports: [
				ConfigModule.forRoot({
					isGlobal: true,
				}),
				TerminusModule,
			],
			controllers: [HealthController],
		}).compile();

		controller = module.get<HealthController>(HealthController);
	});

	it("should be defined", () => {
		expect(controller).toBeDefined();
	});

	it("should have health check method", () => {
		expect(typeof controller.check).toBe("function");
	});

	it("should have readiness check method", () => {
		expect(typeof controller.getReady).toBe("function");
	});

	it("should have liveness check method", () => {
		expect(typeof controller.getLiveness).toBe("function");
	});
});
