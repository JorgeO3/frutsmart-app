import { Injectable } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import { IUuidGenerator } from "../../application/ports/uuid-generator.port";

/**
 * Adapter that provides UUID v4 generation for the Upload module.
 * Implements the application port `IUuidGenerator` so the application
 * layer stays decoupled from the uuid library.
 */
@Injectable()
export class UuidGeneratorAdapter implements IUuidGenerator {
	generate(): string {
		return uuidv4();
	}
}
