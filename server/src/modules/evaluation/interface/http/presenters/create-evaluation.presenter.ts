import { Injectable } from "@nestjs/common";
import { CreateEvaluationInput } from "../../../application/dto/create-evaluation/create-evaluation.input";
import { CreateEvaluationOutput } from "../../../application/dto/create-evaluation/create-evaluation.output";
import { CreateEvaluationDto } from "../dto/requests/create-evaluation.dto";
import {
	CreateEvaluationResponse,
	type StepSummaryDto,
} from "../dto/responses/create-evaluation.response";
import { ICreateEvaluationPresenter } from "./create-evaluation.presenter.port";

/**
 * Presenter for CreateEvaluation endpoint.
 * Maps between HTTP DTOs and application DTOs.
 */
@Injectable()
export class CreateEvaluationPresenter implements ICreateEvaluationPresenter {
	/**
	 * Map HTTP request DTO to application input DTO.
	 */
	toInput(dto: CreateEvaluationDto): CreateEvaluationInput {
		return {
			id: dto.id,
			type: dto.type,
			creationTimestamp: new Date(dto.creationTimestamp),
			uploadSessionId: dto.uploadSessionId,
			qrCode: dto.qrCode,
			consecutiveNumber: dto.consecutiveNumber,
			deviceWeather: dto.deviceWeather,
			harvestObservation: dto.harvestObservation,
			providerKind: dto.providerKind,
			truckPlate: dto.truckPlate,
			providerId: dto.providerId,
			subProviderId: dto.subProviderId,
			programId: dto.programId,
			lotId: dto.lotId,
			centerId: dto.centerId,
			deviceTimeOfDay: dto.deviceTimeOfDay,
			deviceHasInternet: dto.deviceHasInternet,
			geoLatitude: dto.geoLatitude,
			geoLongitude: dto.geoLongitude,
			harvestCriteriaJson: dto.harvestCriteriaJson,
			modelDetectionId: dto.modelDetectionId,
			modelExternalId: dto.modelExternalId,
			modelInternalId: dto.modelInternalId,
			steps: dto.steps?.map((step) => ({
				id: step.id,
				kind: step.kind,
				iterationIndex: step.iterationIndex,
				result: step.result
					? {
							id: step.result.id,
							aiClassName: step.result.aiClassName,
							aiConfidence: step.result.aiConfidence,
							aiRawConfidencesJson: step.result.aiRawConfidencesJson,
							hfIsCorrect: step.result.hfIsCorrect,
							hfCorrectedClassName: step.result.hfCorrectedClassName,
							hfObservation: step.result.hfObservation,
						}
					: undefined,
				photos: step.photos?.map((photo) => ({
					id: photo.id,
					role: photo.role,
					uploadItemId: photo.uploadItemId,
				})),
				segments: step.segments?.map((segment) => ({
					id: segment.id,
					uploadItemId: segment.uploadItemId,
					bestClassName: segment.bestClassName,
					bestConfidence: segment.bestConfidence,
					confidencesJson: segment.confidencesJson,
				})),
			})),
		};
	}

	/**
	 * Map application output DTO to HTTP response DTO.
	 */
	toHttp(output: CreateEvaluationOutput): CreateEvaluationResponse {
		const response = new CreateEvaluationResponse();
		response.id = output.id;
		response.type = output.type;
		response.isFinalized = output.isFinalized;
		response.createdAt = output.createdAt;
		response.totalSteps = output.totalSteps;
		response.totalPhotos = output.totalPhotos;
		response.totalSegments = output.totalSegments;
		response.stepsSummary = output.stepsSummary.map((summary) => {
			const dto: StepSummaryDto = {
				kind: summary.kind,
				iterationIndex: summary.iterationIndex,
				hasResult: summary.hasResult,
				photoCount: summary.photoCount,
				segmentCount: summary.segmentCount,
			};
			return dto;
		});
		return response;
	}
}
