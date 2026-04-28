import { Injectable } from "@nestjs/common";
import { CreateUploadSessionDto } from "../dto/requests/create-upload-session.dto";
import { CreateUploadSessionInput } from "../../../application/dto/create-upload-session/create-upload-session.input";
import { ICreateUploadSessionHttpMapper } from "./create-upload-session.mapper.port";

/**
 * Mapper for CreateUploadSession endpoint.
 * Transforms HTTP Request DTO to Application Use Case Input.
 */
@Injectable()
export class CreateUploadSessionHttpMapper
	implements ICreateUploadSessionHttpMapper
{
	/**
	 * Maps HTTP DTO to application layer input.
	 *
	 * @param dto - Validated HTTP request DTO
	 * @returns Application use case input
	 */
	toInput(dto: CreateUploadSessionDto): CreateUploadSessionInput {
		return {
			clientBatchId: dto.clientBatchId,
			domain: dto.domain,
			files: dto.files.map((file) => ({
				clientItemId: file.clientItemId,
				fileName: file.fileName,
				fileSizeBytes: file.fileSizeBytes,
				contentType: file.contentType,
				md5: file.md5,
			})),
		};
	}
}
