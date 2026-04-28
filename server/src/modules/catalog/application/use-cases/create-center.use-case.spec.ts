import { CreateCenterUseCase } from "./create-center.use-case";
import type { ICenterRepository } from "../ports/repositories/center.repository.port";
import type { ILotRepository } from "../ports/repositories/lot.repository.port";
import { DuplicateNameError } from "../../domain/errors/duplicate-name.error";
import { ForeignNotFoundError } from "../../domain/errors/foreign-not-found.error";
import type { CreateCenterInput } from "../dto/inputs";
import type { CenterOutput } from "../dto/outputs";

function mockRepo<T extends object>(shape: T): jest.Mocked<T> {
	return shape as jest.Mocked<T>;
}
const uuid = () => "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

const createInput = (o?: Partial<CreateCenterInput>): CreateCenterInput => ({
	id: uuid(),
	name: "Center 1",
	lotId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
	...o,
});

describe("CreateCenterUseCase", () => {
	let useCase: CreateCenterUseCase;
	let centerRepo: jest.Mocked<ICenterRepository>;
	let lotRepo: jest.Mocked<ILotRepository>;

	beforeEach(() => {
		centerRepo = mockRepo<ICenterRepository>({
			save: jest.fn(),
			findById: jest.fn(),
			existsByLotAndName: jest.fn(),
			list: jest.fn(),
		});
		lotRepo = mockRepo<ILotRepository>({
			save: jest.fn(),
			findById: jest.fn(),
			existsByProgramAndName: jest.fn(),
			list: jest.fn(),
		});

		useCase = new CreateCenterUseCase(centerRepo, lotRepo);
	});

	it("CAT-CEN-CRT-001 should create center (happy path)", async () => {
		const input = createInput();
		lotRepo.findById.mockResolvedValue({
			id: input.lotId,
			name: "Lot X",
			programId: uuid(),
		} as never);
		centerRepo.existsByLotAndName.mockResolvedValue(false);
		centerRepo.save.mockResolvedValue();

		const result = await useCase.execute(input);
		expect(result).toEqual<CenterOutput>({
			id: input.id,
			name: input.name,
			lotId: input.lotId,
		});
		expect(centerRepo.save).toHaveBeenCalledTimes(1);
	});

	it("CAT-CEN-CRT-002 should throw ForeignNotFoundError when lot doesn't exist", async () => {
		const input = createInput();
		lotRepo.findById.mockResolvedValue(null);

		await expect(useCase.execute(input)).rejects.toBeInstanceOf(
			ForeignNotFoundError,
		);
		expect(centerRepo.save).not.toHaveBeenCalled();
	});

	it("CAT-CEN-CRT-003 should throw DuplicateNameError on (lotId,name) conflict", async () => {
		const input = createInput();
		lotRepo.findById.mockResolvedValue({
			id: input.lotId,
			name: "Lot X",
			programId: uuid(),
		} as never);
		centerRepo.existsByLotAndName.mockResolvedValue(true);

		await expect(useCase.execute(input)).rejects.toBeInstanceOf(
			DuplicateNameError,
		);
		expect(centerRepo.save).not.toHaveBeenCalled();
	});
});
