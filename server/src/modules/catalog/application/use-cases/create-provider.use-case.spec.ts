import { CreateProviderUseCase } from "./create-provider.use-case";
import type { IProviderRepository } from "../ports/repositories/provider.repository.port";
import { DuplicateNameError } from "../../domain/errors/duplicate-name.error";
import type { CreateProviderInput } from "../dto/inputs";
import type { ProviderOutput } from "../dto/outputs";

function mockRepo<T extends object>(shape: T): jest.Mocked<T> {
	return shape as jest.Mocked<T>;
}

const uuid = () => "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";

const createInput = (
	o?: Partial<CreateProviderInput>,
): CreateProviderInput => ({
	id: uuid(),
	name: "Provider A",
	...o,
});

describe("CreateProviderUseCase", () => {
	let useCase: CreateProviderUseCase;
	let providerRepo: jest.Mocked<IProviderRepository>;

	beforeEach(() => {
		providerRepo = mockRepo<IProviderRepository>({
			save: jest.fn(),
			findById: jest.fn(),
			existsByName: jest.fn(),
			list: jest.fn(),
		});

		useCase = new CreateProviderUseCase(providerRepo);
	});

	it("CAT-PRV-CRT-001 should create a provider (happy path)", async () => {
		const input = createInput();
		providerRepo.existsByName.mockResolvedValue(false);
		providerRepo.save.mockResolvedValue();

		const result = await useCase.execute(input);

		expect(result).toEqual<ProviderOutput>({
			id: input.id,
			name: input.name,
		});
		expect(providerRepo.save).toHaveBeenCalledTimes(1);
	});

	it("CAT-PRV-CRT-002 should throw DuplicateNameError when name already exists", async () => {
		const input = createInput();
		providerRepo.existsByName.mockResolvedValue(true);

		await expect(useCase.execute(input)).rejects.toBeInstanceOf(
			DuplicateNameError,
		);
		expect(providerRepo.save).not.toHaveBeenCalled();
	});

	it("CAT-PRV-CRT-003 should allow different provider names", async () => {
		const input = createInput({ name: "Provider B" });
		providerRepo.existsByName.mockResolvedValue(false);
		providerRepo.save.mockResolvedValue();

		const result = await useCase.execute(input);

		expect(result.name).toBe("Provider B");
		expect(providerRepo.save).toHaveBeenCalledTimes(1);
	});
});
