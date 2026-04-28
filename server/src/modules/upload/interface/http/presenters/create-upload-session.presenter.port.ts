import { CreateUploadSessionOutput } from "../../../application/dto/create-upload-session/create-upload-session.output";
import { CreateUploadSessionResponse } from "../dto/responses/create-upload-session.response";

/**
 * Token for CreateUploadSessionPresenter injection
 */
export const CREATE_UPLOAD_SESSION_PRESENTER = Symbol(
	"CREATE_UPLOAD_SESSION_PRESENTER",
);

/**
 * Port interface for CreateUploadSessionPresenter
 * Maps application output to HTTP response.
 */
export interface ICreateUploadSessionPresenter {
	toResponse(output: CreateUploadSessionOutput): CreateUploadSessionResponse;
}
