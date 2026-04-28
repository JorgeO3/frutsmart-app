import { UploadSession } from "../../../domain/entities/upload-session.entity";
import { UploadSessionEntity } from "../entities/upload-session.orm-entity";

/**
 * Token for UploadSessionOrmMapper injection
 */
export const UPLOAD_SESSION_ORM_MAPPER = Symbol("UPLOAD_SESSION_ORM_MAPPER");

/**
 * Port interface for UploadSessionOrmMapper
 * Maps between domain entities and TypeORM entities.
 */
export interface IUploadSessionOrmMapper {
	/**
	 * Map TypeORM entity to domain aggregate.
	 */
	toDomain(ormEntity: UploadSessionEntity): UploadSession;

	/**
	 * Map domain aggregate to TypeORM entity.
	 */
	toPersistence(session: UploadSession): UploadSessionEntity;
}
