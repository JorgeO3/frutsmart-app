import { NotFoundException } from "@nestjs/common";
import {
	GetModelByIdUseCase,
	GetProgramByIdUseCase,
	GetLotByIdUseCase,
	GetCenterByIdUseCase,
	GetProviderByIdUseCase,
	GetSubProviderByIdUseCase,
} from "./get-by-id.use-cases";
import type { IModelRepository } from "../ports/repositories/model.repository.port";
import type { IProgramRepository } from "../ports/repositories/program.repository.port";
import type { ILotRepository } from "../ports/repositories/lot.repository.port";
import type { ICenterRepository } from "../ports/repositories/center.repository.port";
import type { IProviderRepository } from "../ports/repositories/provider.repository.port";
import type { ISubProviderRepository } from "../ports/repositories/sub-provider.repository.port";
import type {
	ModelOutput,
	ProgramOutput,
	LotOutput,
	CenterOutput,
	ProviderOutput,
	SubProviderOutput,
} from "../dto/outputs";
import type { ModelType } from "../../domain/types";

function mockRepo<T extends object>(shape: T): jest.Mocked<T> {
	return shape as jest.Mocked<T>;
}

const uuid = () => "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

describe("GetModelByIdUseCase", () => {
	let useCase: GetModelByIdUseCase;
	let modelRepo: jest.Mocked<IModelRepository>;

	beforeEach(() => {
		modelRepo = mockRepo<IModelRepository>({
			save: jest.fn(),
			findById: jest.fn(),
			existsByNameAndVersionTag: jest.fn(),
			list: jest.fn(),
		});

		useCase = new GetModelByIdUseCase(modelRepo);
	});

	it("CAT-MOD-GET-001 should return model by id (happy path)", async () => {
		const id = uuid();
		modelRepo.findById.mockResolvedValue({
			id,
			name: "YOLOv8",
			versionTag: "v1.0.0",
			type: "detection" as ModelType,
		} as never);

		const result = await useCase.execute(id);

		expect(result).toEqual<ModelOutput>({
			id,
			name: "YOLOv8",
			versionTag: "v1.0.0",
			type: "detection",
		});
		expect(modelRepo.findById).toHaveBeenCalledWith(id);
	});

	it("CAT-MOD-GET-002 should throw NotFoundException when model doesn't exist", async () => {
		const id = uuid();
		modelRepo.findById.mockResolvedValue(null);

		await expect(useCase.execute(id)).rejects.toBeInstanceOf(NotFoundException);
		expect(modelRepo.findById).toHaveBeenCalledWith(id);
	});
});

describe("GetProgramByIdUseCase", () => {
	let useCase: GetProgramByIdUseCase;
	let programRepo: jest.Mocked<IProgramRepository>;

	beforeEach(() => {
		programRepo = mockRepo<IProgramRepository>({
			save: jest.fn(),
			findById: jest.fn(),
			existsByName: jest.fn(),
			list: jest.fn(),
		});

		useCase = new GetProgramByIdUseCase(programRepo);
	});

	it("CAT-PRG-GET-001 should return program by id (happy path)", async () => {
		const id = uuid();
		programRepo.findById.mockResolvedValue({
			id,
			name: "Program Alpha",
		} as never);

		const result = await useCase.execute(id);

		expect(result).toEqual<ProgramOutput>({ id, name: "Program Alpha" });
		expect(programRepo.findById).toHaveBeenCalledWith(id);
	});

	it("CAT-PRG-GET-002 should throw NotFoundException when program doesn't exist", async () => {
		const id = uuid();
		programRepo.findById.mockResolvedValue(null);

		await expect(useCase.execute(id)).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe("GetLotByIdUseCase", () => {
	let useCase: GetLotByIdUseCase;
	let lotRepo: jest.Mocked<ILotRepository>;

	beforeEach(() => {
		lotRepo = mockRepo<ILotRepository>({
			save: jest.fn(),
			findById: jest.fn(),
			existsByProgramAndName: jest.fn(),
			list: jest.fn(),
		});

		useCase = new GetLotByIdUseCase(lotRepo);
	});

	it("CAT-LOT-GET-001 should return lot by id (happy path)", async () => {
		const id = uuid();
		const programId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
		lotRepo.findById.mockResolvedValue({
			id,
			name: "Lot A",
			programId,
		} as never);

		const result = await useCase.execute(id);

		expect(result).toEqual<LotOutput>({ id, name: "Lot A", programId });
		expect(lotRepo.findById).toHaveBeenCalledWith(id);
	});

	it("CAT-LOT-GET-002 should throw NotFoundException when lot doesn't exist", async () => {
		const id = uuid();
		lotRepo.findById.mockResolvedValue(null);

		await expect(useCase.execute(id)).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe("GetCenterByIdUseCase", () => {
	let useCase: GetCenterByIdUseCase;
	let centerRepo: jest.Mocked<ICenterRepository>;

	beforeEach(() => {
		centerRepo = mockRepo<ICenterRepository>({
			save: jest.fn(),
			findById: jest.fn(),
			existsByLotAndName: jest.fn(),
			list: jest.fn(),
		});

		useCase = new GetCenterByIdUseCase(centerRepo);
	});

	it("CAT-CEN-GET-001 should return center by id (happy path)", async () => {
		const id = uuid();
		const lotId = "cccccccc-cccc-cccc-cccc-cccccccccccc";
		centerRepo.findById.mockResolvedValue({
			id,
			name: "Center 1",
			lotId,
		} as never);

		const result = await useCase.execute(id);

		expect(result).toEqual<CenterOutput>({ id, name: "Center 1", lotId });
		expect(centerRepo.findById).toHaveBeenCalledWith(id);
	});

	it("CAT-CEN-GET-002 should throw NotFoundException when center doesn't exist", async () => {
		const id = uuid();
		centerRepo.findById.mockResolvedValue(null);

		await expect(useCase.execute(id)).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe("GetProviderByIdUseCase", () => {
	let useCase: GetProviderByIdUseCase;
	let providerRepo: jest.Mocked<IProviderRepository>;

	beforeEach(() => {
		providerRepo = mockRepo<IProviderRepository>({
			save: jest.fn(),
			findById: jest.fn(),
			existsByName: jest.fn(),
			list: jest.fn(),
		});

		useCase = new GetProviderByIdUseCase(providerRepo);
	});

	it("CAT-PRV-GET-001 should return provider by id (happy path)", async () => {
		const id = uuid();
		providerRepo.findById.mockResolvedValue({
			id,
			name: "Provider A",
		} as never);

		const result = await useCase.execute(id);

		expect(result).toEqual<ProviderOutput>({ id, name: "Provider A" });
		expect(providerRepo.findById).toHaveBeenCalledWith(id);
	});

	it("CAT-PRV-GET-002 should throw NotFoundException when provider doesn't exist", async () => {
		const id = uuid();
		providerRepo.findById.mockResolvedValue(null);

		await expect(useCase.execute(id)).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe("GetSubProviderByIdUseCase", () => {
	let useCase: GetSubProviderByIdUseCase;
	let subProviderRepo: jest.Mocked<ISubProviderRepository>;

	beforeEach(() => {
		subProviderRepo = mockRepo<ISubProviderRepository>({
			save: jest.fn(),
			findById: jest.fn(),
			existsByProviderAndName: jest.fn(),
			list: jest.fn(),
		});

		useCase = new GetSubProviderByIdUseCase(subProviderRepo);
	});

	it("CAT-SUB-GET-001 should return sub-provider by id (happy path)", async () => {
		const id = uuid();
		const providerId = "dddddddd-dddd-dddd-dddd-dddddddddddd";
		subProviderRepo.findById.mockResolvedValue({
			id,
			name: "SubProvider 1",
			providerId,
		} as never);

		const result = await useCase.execute(id);

		expect(result).toEqual<SubProviderOutput>({
			id,
			name: "SubProvider 1",
			providerId,
		});
		expect(subProviderRepo.findById).toHaveBeenCalledWith(id);
	});

	it("CAT-SUB-GET-002 should throw NotFoundException when sub-provider doesn't exist", async () => {
		const id = uuid();
		subProviderRepo.findById.mockResolvedValue(null);

		await expect(useCase.execute(id)).rejects.toBeInstanceOf(NotFoundException);
	});
});
