import { CreateSubProviderUseCase } from "./create-sub-provider.use-case";
import type { ISubProviderRepository } from "../ports/repositories/sub-provider.repository.port";
import type { IProviderRepository } from "../ports/repositories/provider.repository.port";
import { DuplicateNameError } from "../../domain/errors/duplicate-name.error";
import { ForeignNotFoundError } from "../../domain/errors/foreign-not-found.error";
import type { CreateSubProviderInput } from "../dto/inputs";
import type { SubProviderOutput } from "../dto/outputs";

function mockRepo<T extends object>(shape: T): jest.Mocked<T> {
	return shape as jest.Mocked<T>;
}

const uuid = () => "ffffffff-ffff-ffff-ffff-ffffffffffff";

const createInput = (
	o?: Partial<CreateSubProviderInput>,
): CreateSubProviderInput => ({
	id: uuid(),
	name: "SubProvider 1",
	providerId: "12121212-1212-1212-1212-121212121212",
	...o,
});

describe("CreateSubProviderUseCase", () => {
	let useCase: CreateSubProviderUseCase;
	let subProviderRepo: jest.Mocked<ISubProviderRepository>;
	let providerRepo: jest.Mocked<IProviderRepository>;

	beforeEach(() => {
		subProviderRepo = mockRepo<ISubProviderRepository>({
			save: jest.fn(),
			findById: jest.fn(),
			existsByProviderAndName: jest.fn(),
			list: jest.fn(),
		});

		providerRepo = mockRepo<IProviderRepository>({
			save: jest.fn(),
			findById: jest.fn(),
			existsByName: jest.fn(),
			list: jest.fn(),
		});

		useCase = new CreateSubProviderUseCase(subProviderRepo, providerRepo);
	});

	it("CAT-SUB-CRT-001 should create a sub-provider (happy path)", async () => {
		const input = createInput();
		providerRepo.findById.mockResolvedValue({
			id: input.providerId,
			name: "Main Provider",
		} as never);
		subProviderRepo.existsByProviderAndName.mockResolvedValue(false);
		subProviderRepo.save.mockResolvedValue();

		const result = await useCase.execute(input);

		expect(result).toEqual<SubProviderOutput>({
			id: input.id,
			name: input.name,
			providerId: input.providerId,
		});
		expect(subProviderRepo.save).toHaveBeenCalledTimes(1);
	});

	it("CAT-SUB-CRT-002 should throw ForeignNotFoundError when provider doesn't exist", async () => {
		const input = createInput();
		providerRepo.findById.mockResolvedValue(null);

		await expect(useCase.execute(input)).rejects.toBeInstanceOf(
			ForeignNotFoundError,
		);
		expect(subProviderRepo.save).not.toHaveBeenCalled();
	});

	it("CAT-SUB-CRT-003 should throw DuplicateNameError on (providerId,name) conflict", async () => {
		const input = createInput();
		providerRepo.findById.mockResolvedValue({
			id: input.providerId,
			name: "Main Provider",
		} as never);
		subProviderRepo.existsByProviderAndName.mockResolvedValue(true);

		await expect(useCase.execute(input)).rejects.toBeInstanceOf(
			DuplicateNameError,
		);
		expect(subProviderRepo.save).not.toHaveBeenCalled();
	});

	it("CAT-SUB-CRT-004 should allow same name under different providers", async () => {
		const input = createInput({
			providerId: "99999999-9999-9999-9999-999999999999",
		});
		providerRepo.findById.mockResolvedValue({
			id: input.providerId,
			name: "Another Provider",
		} as never);
		subProviderRepo.existsByProviderAndName.mockResolvedValue(false);
		subProviderRepo.save.mockResolvedValue();

		const result = await useCase.execute(input);

		expect(result.providerId).toBe("99999999-9999-9999-9999-999999999999");
		expect(subProviderRepo.save).toHaveBeenCalledTimes(1);
	});
});
