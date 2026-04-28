import { CreateUploadSessionDto } from "../dto/requests/create-upload-session.dto";
import { CreateUploadSessionInput } from "../../../application/dto/create-upload-session/create-upload-session.input";

/**
 * Token for CreateUploadSessionHttpMapper injection
 */
export const CREATE_UPLOAD_SESSION_HTTP_MAPPER = Symbol(
	"CREATE_UPLOAD_SESSION_HTTP_MAPPER",
);

/**
 * Port interface for CreateUploadSessionHttpMapper
 * Maps HTTP DTOs to application DTOs.
 */
export interface ICreateUploadSessionHttpMapper {
	toInput(dto: CreateUploadSessionDto): CreateUploadSessionInput;
}
