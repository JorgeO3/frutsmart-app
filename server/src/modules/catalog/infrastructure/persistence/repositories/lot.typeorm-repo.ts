import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { ILotRepository } from "../../../application/ports/repositories/lot.repository.port";
import { Lot } from "../../../domain/entities/lot.entity";
import type { UUID } from "../../../domain/types";
import { LotOrmEntity } from "../entities/lot.orm-entity";
import { CatalogOrmMapper } from "../mappers/catalog-orm.mapper";

@Injectable()
export class LotTypeOrmRepository implements ILotRepository {
	constructor(
		@InjectRepository(LotOrmEntity)
		private readonly repo: Repository<LotOrmEntity>,
		private readonly mapper: CatalogOrmMapper,
	) {}

	async save(lot: Lot): Promise<void> {
		const orm = this.mapper.toLotOrm(lot);
		await this.repo.save(orm);
	}

	async findById(id: UUID): Promise<Lot | null> {
		const orm = await this.repo.findOne({ where: { id } });
		return orm ? this.mapper.toLotDomain(orm) : null;
	}

	async existsByProgramAndName(
		programId: UUID,
		name: string,
	): Promise<boolean> {
		const count = await this.repo.count({
			where: { programId, name },
		});
		return count > 0;
	}

	async list(params?: { programId?: UUID }): Promise<Lot[]> {
		const where = params?.programId ? { programId: params.programId } : {};
		const orms = await this.repo.find({ where });
		return orms.map((orm) => this.mapper.toLotDomain(orm));
	}
}
