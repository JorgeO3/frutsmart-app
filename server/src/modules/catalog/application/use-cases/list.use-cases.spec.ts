import {
	ListModelsUseCase,
	ListProgramsUseCase,
	ListLotsUseCase,
	ListCentersUseCase,
	ListProvidersUseCase,
	ListSubProvidersUseCase,
} from "./list.use-cases";
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

describe("ListModelsUseCase", () => {
	let useCase: ListModelsUseCase;
	let modelRepo: jest.Mocked<IModelRepository>;

	beforeEach(() => {
		modelRepo = mockRepo<IModelRepository>({
			save: jest.fn(),
			findById: jest.fn(),
			existsByNameAndVersionTag: jest.fn(),
			list: jest.fn(),
		});

		useCase = new ListModelsUseCase(modelRepo);
	});

	it("CAT-MOD-LST-001 should list all models (happy path)", async () => {
		const models = [
			{
				id: uuid(),
				name: "YOLOv8",
				versionTag: "v1.0.0",
				type: "detection" as ModelType,
			},
			{
				id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
				name: "ResNet50",
				versionTag: "v2.1.0",
				type: "external_classification" as ModelType,
			},
		];
		modelRepo.list.mockResolvedValue(models as never);

		const result = await useCase.execute();

		expect(result).toHaveLength(2);
		expect(result[0]).toEqual<ModelOutput>(models[0]);
		expect(result[1]).toEqual<ModelOutput>(models[1]);
		expect(modelRepo.list).toHaveBeenCalledWith(undefined);
	});

	it("CAT-MOD-LST-002 should list models filtered by type", async () => {
		const models = [
			{
				id: uuid(),
				name: "YOLOv8",
				versionTag: "v1.0.0",
				type: "detection" as ModelType,
			},
		];
		modelRepo.list.mockResolvedValue(models as never);

		const result = await useCase.execute({ type: "detection" });

		expect(result).toHaveLength(1);
		expect(result[0].type).toBe("detection");
		expect(modelRepo.list).toHaveBeenCalledWith({ type: "detection" });
	});

	it("CAT-MOD-LST-003 should return empty array when no models exist", async () => {
		modelRepo.list.mockResolvedValue([]);

		const result = await useCase.execute();

		expect(result).toEqual([]);
		expect(modelRepo.list).toHaveBeenCalledTimes(1);
	});
});

describe("ListProgramsUseCase", () => {
	let useCase: ListProgramsUseCase;
	let programRepo: jest.Mocked<IProgramRepository>;

	beforeEach(() => {
		programRepo = mockRepo<IProgramRepository>({
			save: jest.fn(),
			findById: jest.fn(),
			existsByName: jest.fn(),
			list: jest.fn(),
		});

		useCase = new ListProgramsUseCase(programRepo);
	});

	it("CAT-PRG-LST-001 should list all programs (happy path)", async () => {
		const programs = [
			{ id: uuid(), name: "Program Alpha" },
			{ id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", name: "Program Beta" },
		];
		programRepo.list.mockResolvedValue(programs as never);

		const result = await useCase.execute();

		expect(result).toHaveLength(2);
		expect(result[0]).toEqual<ProgramOutput>(programs[0]);
		expect(result[1]).toEqual<ProgramOutput>(programs[1]);
		expect(programRepo.list).toHaveBeenCalledTimes(1);
	});

	it("CAT-PRG-LST-002 should return empty array when no programs exist", async () => {
		programRepo.list.mockResolvedValue([]);

		const result = await useCase.execute();

		expect(result).toEqual([]);
	});
});

describe("ListLotsUseCase", () => {
	let useCase: ListLotsUseCase;
	let lotRepo: jest.Mocked<ILotRepository>;

	beforeEach(() => {
		lotRepo = mockRepo<ILotRepository>({
			save: jest.fn(),
			findById: jest.fn(),
			existsByProgramAndName: jest.fn(),
			list: jest.fn(),
		});

		useCase = new ListLotsUseCase(lotRepo);
	});

	it("CAT-LOT-LST-001 should list all lots (happy path)", async () => {
		const lots = [
			{
				id: uuid(),
				name: "Lot A",
				programId: "cccccccc-cccc-cccc-cccc-cccccccccccc",
			},
			{
				id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
				name: "Lot B",
				programId: "cccccccc-cccc-cccc-cccc-cccccccccccc",
			},
		];
		lotRepo.list.mockResolvedValue(lots as never);

		const result = await useCase.execute();

		expect(result).toHaveLength(2);
		expect(result[0]).toEqual<LotOutput>(lots[0]);
		expect(lotRepo.list).toHaveBeenCalledWith(undefined);
	});

	it("CAT-LOT-LST-002 should list lots filtered by programId", async () => {
		const programId = "cccccccc-cccc-cccc-cccc-cccccccccccc";
		const lots = [
			{ id: uuid(), name: "Lot A", programId },
			{ id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", name: "Lot B", programId },
		];
		lotRepo.list.mockResolvedValue(lots as never);

		const result = await useCase.execute({ programId });

		expect(result).toHaveLength(2);
		expect(result.every((lot) => lot.programId === programId)).toBe(true);
		expect(lotRepo.list).toHaveBeenCalledWith({ programId });
	});

	it("CAT-LOT-LST-003 should return empty array when no lots exist", async () => {
		lotRepo.list.mockResolvedValue([]);

		const result = await useCase.execute();

		expect(result).toEqual([]);
	});
});

describe("ListCentersUseCase", () => {
	let useCase: ListCentersUseCase;
	let centerRepo: jest.Mocked<ICenterRepository>;

	beforeEach(() => {
		centerRepo = mockRepo<ICenterRepository>({
			save: jest.fn(),
			findById: jest.fn(),
			existsByLotAndName: jest.fn(),
			list: jest.fn(),
		});

		useCase = new ListCentersUseCase(centerRepo);
	});

	it("CAT-CEN-LST-001 should list all centers (happy path)", async () => {
		const centers = [
			{
				id: uuid(),
				name: "Center 1",
				lotId: "dddddddd-dddd-dddd-dddd-dddddddddddd",
			},
			{
				id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
				name: "Center 2",
				lotId: "dddddddd-dddd-dddd-dddd-dddddddddddd",
			},
		];
		centerRepo.list.mockResolvedValue(centers as never);

		const result = await useCase.execute();

		expect(result).toHaveLength(2);
		expect(result[0]).toEqual<CenterOutput>(centers[0]);
		expect(centerRepo.list).toHaveBeenCalledWith(undefined);
	});

	it("CAT-CEN-LST-002 should list centers filtered by lotId", async () => {
		const lotId = "dddddddd-dddd-dddd-dddd-dddddddddddd";
		const centers = [
			{ id: uuid(), name: "Center 1", lotId },
			{ id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", name: "Center 2", lotId },
		];
		centerRepo.list.mockResolvedValue(centers as never);

		const result = await useCase.execute({ lotId });

		expect(result).toHaveLength(2);
		expect(result.every((c) => c.lotId === lotId)).toBe(true);
		expect(centerRepo.list).toHaveBeenCalledWith({ lotId });
	});

	it("CAT-CEN-LST-003 should return empty array when no centers exist", async () => {
		centerRepo.list.mockResolvedValue([]);

		const result = await useCase.execute();

		expect(result).toEqual([]);
	});
});

describe("ListProvidersUseCase", () => {
	let useCase: ListProvidersUseCase;
	let providerRepo: jest.Mocked<IProviderRepository>;

	beforeEach(() => {
		providerRepo = mockRepo<IProviderRepository>({
			save: jest.fn(),
			findById: jest.fn(),
			existsByName: jest.fn(),
			list: jest.fn(),
		});

		useCase = new ListProvidersUseCase(providerRepo);
	});

	it("CAT-PRV-LST-001 should list all providers (happy path)", async () => {
		const providers = [
			{ id: uuid(), name: "Provider A" },
			{ id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", name: "Provider B" },
		];
		providerRepo.list.mockResolvedValue(providers as never);

		const result = await useCase.execute();

		expect(result).toHaveLength(2);
		expect(result[0]).toEqual<ProviderOutput>(providers[0]);
		expect(providerRepo.list).toHaveBeenCalledTimes(1);
	});

	it("CAT-PRV-LST-002 should return empty array when no providers exist", async () => {
		providerRepo.list.mockResolvedValue([]);

		const result = await useCase.execute();

		expect(result).toEqual([]);
	});
});

describe("ListSubProvidersUseCase", () => {
	let useCase: ListSubProvidersUseCase;
	let subProviderRepo: jest.Mocked<ISubProviderRepository>;

	beforeEach(() => {
		subProviderRepo = mockRepo<ISubProviderRepository>({
			save: jest.fn(),
			findById: jest.fn(),
			existsByProviderAndName: jest.fn(),
			list: jest.fn(),
		});

		useCase = new ListSubProvidersUseCase(subProviderRepo);
	});

	it("CAT-SUB-LST-001 should list all sub-providers (happy path)", async () => {
		const subProviders = [
			{
				id: uuid(),
				name: "SubProvider 1",
				providerId: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
			},
			{
				id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
				name: "SubProvider 2",
				providerId: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
			},
		];
		subProviderRepo.list.mockResolvedValue(subProviders as never);

		const result = await useCase.execute();

		expect(result).toHaveLength(2);
		expect(result[0]).toEqual<SubProviderOutput>(subProviders[0]);
		expect(subProviderRepo.list).toHaveBeenCalledWith(undefined);
	});

	it("CAT-SUB-LST-002 should list sub-providers filtered by providerId", async () => {
		const providerId = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
		const subProviders = [
			{ id: uuid(), name: "SubProvider 1", providerId },
			{
				id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
				name: "SubProvider 2",
				providerId,
			},
		];
		subProviderRepo.list.mockResolvedValue(subProviders as never);

		const result = await useCase.execute({ providerId });

		expect(result).toHaveLength(2);
		expect(result.every((sp) => sp.providerId === providerId)).toBe(true);
		expect(subProviderRepo.list).toHaveBeenCalledWith({ providerId });
	});

	it("CAT-SUB-LST-003 should return empty array when no sub-providers exist", async () => {
		subProviderRepo.list.mockResolvedValue([]);

		const result = await useCase.execute();

		expect(result).toEqual([]);
	});
});
