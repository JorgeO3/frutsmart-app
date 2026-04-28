import type { Lot } from "../../../domain/entities/lot.entity";
import type { UUID } from "../../../domain/types";

export const LOT_REPOSITORY = Symbol("LOT_REPOSITORY");

export interface ILotRepository {
	save(lot: Lot): Promise<void>;
	findById(id: UUID): Promise<Lot | null>;
	existsByProgramAndName(programId: UUID, name: string): Promise<boolean>;
	list(params?: { programId?: UUID }): Promise<Lot[]>;
}
