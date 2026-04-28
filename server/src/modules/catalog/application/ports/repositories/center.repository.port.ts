import type { Center } from "../../../domain/entities/center.entity";
import type { UUID } from "../../../domain/types";

export const CENTER_REPOSITORY = Symbol("CENTER_REPOSITORY");

export interface ICenterRepository {
	save(center: Center): Promise<void>;
	findById(id: UUID): Promise<Center | null>;
	existsByLotAndName(lotId: UUID, name: string): Promise<boolean>;
	list(params?: { lotId?: UUID }): Promise<Center[]>;
}
