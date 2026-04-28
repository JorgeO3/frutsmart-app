import { CreateLotUseCase } from "./create-lot.use-case";
import type { ILotRepository } from "../ports/repositories/lot.repository.port";
import type { IProgramRepository } from "../ports/repositories/program.repository.port";
import { DuplicateNameError } from "../../domain/errors/duplicate-name.error";
import { ForeignNotFoundError } from "../../domain/errors/foreign-not-found.error";
import type { CreateLotInput } from "../dto/inputs";
import type { LotOutput } from "../dto/outputs";

function mockRepo<T extends object>(shape: T): jest.Mocked<T> {
	return shape as jest.Mocked<T>;
}

const uuid = () => "11111111-1111-1111-1111-111111111111";

const createInput = (o?: Partial<CreateLotInput>): CreateLotInput => ({
	id: uuid(),
	name: "Lote A",
	programId: "22222222-2222-2222-2222-222222222222",
	...o,
});

describe("CreateLotUseCase", () => {
	let useCase: CreateLotUseCase;
	let lotRepo: jest.Mocked<ILotRepository>;
	let programRepo: jest.Mocked<IProgramRepository>;

	beforeEach(() => {
		lotRepo = mockRepo<ILotRepository>({
			save: jest.fn(),
			findById: jest.fn(),
			existsByProgramAndName: jest.fn(),
			list: jest.fn(),
		});

		programRepo = mockRepo<IProgramRepository>({
			save: jest.fn(),
			findById: jest.fn(),
			existsByName: jest.fn(),
			list: jest.fn(),
		});

		useCase = new CreateLotUseCase(lotRepo, programRepo);
	});

	it("CAT-LOT-CRT-001 should create a lot (happy path)", async () => {
		const input = createInput();
		programRepo.findById.mockResolvedValue({
			id: input.programId,
			name: "Program X",
		} as never);
		lotRepo.existsByProgramAndName.mockResolvedValue(false);
		lotRepo.save.mockResolvedValue();

		const result = await useCase.execute(input);

		expect(result).toEqual<LotOutput>({
			id: input.id,
			name: input.name,
			programId: input.programId,
		});
		expect(lotRepo.save).toHaveBeenCalledTimes(1);
	});

	it("CAT-LOT-CRT-002 should throw ForeignNotFoundError when program does not exist", async () => {
		const input = createInput();
		programRepo.findById.mockResolvedValue(null);

		await expect(useCase.execute(input)).rejects.toBeInstanceOf(
			ForeignNotFoundError,
		);
		expect(lotRepo.save).not.toHaveBeenCalled();
	});

	it("CAT-LOT-CRT-003 should throw DuplicateNameError when (programId,name) already exists", async () => {
		const input = createInput();
		programRepo.findById.mockResolvedValue({
			id: input.programId,
			name: "Program X",
		} as never);
		lotRepo.existsByProgramAndName.mockResolvedValue(true);

		await expect(useCase.execute(input)).rejects.toBeInstanceOf(
			DuplicateNameError,
		);
		expect(lotRepo.save).not.toHaveBeenCalled();
	});
});
