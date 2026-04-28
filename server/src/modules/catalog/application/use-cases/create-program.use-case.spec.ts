import { CreateProgramUseCase } from "./create-program.use-case";
import type { IProgramRepository } from "../ports/repositories/program.repository.port";
import { DuplicateNameError } from "../../domain/errors/duplicate-name.error";
import type { CreateProgramInput } from "../dto/inputs";
import type { ProgramOutput } from "../dto/outputs";

function mockRepo<T extends object>(shape: T): jest.Mocked<T> {
	return shape as jest.Mocked<T>;
}

const uuid = () => "dddddddd-dddd-dddd-dddd-dddddddddddd";

const createInput = (o?: Partial<CreateProgramInput>): CreateProgramInput => ({
	id: uuid(),
	name: "Program Alpha",
	...o,
});

describe("CreateProgramUseCase", () => {
	let useCase: CreateProgramUseCase;
	let programRepo: jest.Mocked<IProgramRepository>;

	beforeEach(() => {
		programRepo = mockRepo<IProgramRepository>({
			save: jest.fn(),
			findById: jest.fn(),
			existsByName: jest.fn(),
			list: jest.fn(),
		});

		useCase = new CreateProgramUseCase(programRepo);
	});

	it("CAT-PRG-CRT-001 should create a program (happy path)", async () => {
		const input = createInput();
		programRepo.existsByName.mockResolvedValue(false);
		programRepo.save.mockResolvedValue();

		const result = await useCase.execute(input);

		expect(result).toEqual<ProgramOutput>({
			id: input.id,
			name: input.name,
		});
		expect(programRepo.save).toHaveBeenCalledTimes(1);
	});

	it("CAT-PRG-CRT-002 should throw DuplicateNameError when name already exists", async () => {
		const input = createInput();
		programRepo.existsByName.mockResolvedValue(true);

		await expect(useCase.execute(input)).rejects.toBeInstanceOf(
			DuplicateNameError,
		);
		expect(programRepo.save).not.toHaveBeenCalled();
	});

	it("CAT-PRG-CRT-003 should reject duplicate name case-sensitively", async () => {
		const input = createInput({ name: "Program Alpha" });
		programRepo.existsByName.mockResolvedValue(true);

		await expect(useCase.execute(input)).rejects.toBeInstanceOf(
			DuplicateNameError,
		);
	});
});
