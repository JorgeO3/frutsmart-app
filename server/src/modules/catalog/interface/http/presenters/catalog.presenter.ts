import { Injectable } from "@nestjs/common";
import type {
	ModelOutput,
	ProgramOutput,
	LotOutput,
	CenterOutput,
	ProviderOutput,
	SubProviderOutput,
} from "../../../application/dto/outputs";
import {
	ModelResponse,
	ProgramResponse,
	LotResponse,
	CenterResponse,
	ProviderResponse,
	SubProviderResponse,
} from "../dto/responses/catalog.response";

@Injectable()
export class CatalogPresenter {
	toModelResponse(output: ModelOutput): ModelResponse {
		return {
			id: output.id,
			name: output.name,
			versionTag: output.versionTag,
			type: output.type,
		};
	}

	toProgramResponse(output: ProgramOutput): ProgramResponse {
		return {
			id: output.id,
			name: output.name,
		};
	}

	toLotResponse(output: LotOutput): LotResponse {
		return {
			id: output.id,
			name: output.name,
			programId: output.programId,
		};
	}

	toCenterResponse(output: CenterOutput): CenterResponse {
		return {
			id: output.id,
			name: output.name,
			lotId: output.lotId,
		};
	}

	toProviderResponse(output: ProviderOutput): ProviderResponse {
		return {
			id: output.id,
			name: output.name,
		};
	}

	toSubProviderResponse(output: SubProviderOutput): SubProviderResponse {
		return {
			id: output.id,
			name: output.name,
			providerId: output.providerId,
		};
	}

	toModelListResponse(outputs: ModelOutput[]): ModelResponse[] {
		return outputs.map((o) => this.toModelResponse(o));
	}

	toProgramListResponse(outputs: ProgramOutput[]): ProgramResponse[] {
		return outputs.map((o) => this.toProgramResponse(o));
	}

	toLotListResponse(outputs: LotOutput[]): LotResponse[] {
		return outputs.map((o) => this.toLotResponse(o));
	}

	toCenterListResponse(outputs: CenterOutput[]): CenterResponse[] {
		return outputs.map((o) => this.toCenterResponse(o));
	}

	toProviderListResponse(outputs: ProviderOutput[]): ProviderResponse[] {
		return outputs.map((o) => this.toProviderResponse(o));
	}

	toSubProviderListResponse(
		outputs: SubProviderOutput[],
	): SubProviderResponse[] {
		return outputs.map((o) => this.toSubProviderResponse(o));
	}
}
