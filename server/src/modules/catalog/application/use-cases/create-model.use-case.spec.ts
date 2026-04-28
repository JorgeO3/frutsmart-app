import { CreateModelUseCase } from "./create-model.use-case";
import type { IModelRepository } from "../ports/repositories/model.repository.port";
import { DuplicateNameError } from "../../domain/errors/duplicate-name.error";
import type { CreateModelInput } from "../dto/inputs";
import type { ModelOutput } from "../dto/outputs";
import type { ModelType } from "../../domain/types";

function mockRepo<T extends object>(shape: T): jest.Mocked<T> {
	return shape as jest.Mocked<T>;
}

const uuid = () => "cccccccc-cccc-cccc-cccc-cccccccccccc";

const createInput = (o?: Partial<CreateModelInput>): CreateModelInput => ({
	id: uuid(),
	name: "YOLOv8",
	versionTag: "v1.0.0",
	type: "detection" as ModelType,
	...o,
});

describe("CreateModelUseCase", () => {
	let useCase: CreateModelUseCase;
	let modelRepo: jest.Mocked<IModelRepository>;

	beforeEach(() => {
		modelRepo = mockRepo<IModelRepository>({
			save: jest.fn(),
			findById: jest.fn(),
			existsByNameAndVersionTag: jest.fn(),
			list: jest.fn(),
		});

		useCase = new CreateModelUseCase(modelRepo);
	});

	it("CAT-MOD-CRT-001 should create a model (happy path)", async () => {
		const input = createInput();
		modelRepo.existsByNameAndVersionTag.mockResolvedValue(false);
		modelRepo.save.mockResolvedValue();

		const result = await useCase.execute(input);

		expect(result).toEqual<ModelOutput>({
			id: input.id,
			name: input.name,
			versionTag: input.versionTag,
			type: input.type,
		});
		expect(modelRepo.save).toHaveBeenCalledTimes(1);
	});

	it("CAT-MOD-CRT-002 should throw DuplicateNameError when (name,versionTag) already exists", async () => {
		const input = createInput();
		modelRepo.existsByNameAndVersionTag.mockResolvedValue(true);

		await expect(useCase.execute(input)).rejects.toBeInstanceOf(
			DuplicateNameError,
		);
		expect(modelRepo.save).not.toHaveBeenCalled();
	});

	it("CAT-MOD-CRT-003 should allow same name with different version", async () => {
		const input = createInput({ versionTag: "v2.0.0" });
		modelRepo.existsByNameAndVersionTag.mockResolvedValue(false);
		modelRepo.save.mockResolvedValue();

		const result = await useCase.execute(input);

		expect(result.versionTag).toBe("v2.0.0");
		expect(modelRepo.save).toHaveBeenCalledTimes(1);
	});
});
