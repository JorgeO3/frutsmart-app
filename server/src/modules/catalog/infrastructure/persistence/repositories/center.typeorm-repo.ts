import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { ICenterRepository } from "../../../application/ports/repositories/center.repository.port";
import { Center } from "../../../domain/entities/center.entity";
import type { UUID } from "../../../domain/types";
import { CenterOrmEntity } from "../entities/center.orm-entity";
import { CatalogOrmMapper } from "../mappers/catalog-orm.mapper";

@Injectable()
export class CenterTypeOrmRepository implements ICenterRepository {
	constructor(
		@InjectRepository(CenterOrmEntity)
		private readonly repo: Repository<CenterOrmEntity>,
		private readonly mapper: CatalogOrmMapper,
	) {}

	async save(center: Center): Promise<void> {
		const orm = this.mapper.toCenterOrm(center);
		await this.repo.save(orm);
	}

	async findById(id: UUID): Promise<Center | null> {
		const orm = await this.repo.findOne({ where: { id } });
		return orm ? this.mapper.toCenterDomain(orm) : null;
	}

	async existsByLotAndName(lotId: UUID, name: string): Promise<boolean> {
		const count = await this.repo.count({
			where: { lotId, name },
		});
		return count > 0;
	}

	async list(params?: { lotId?: UUID }): Promise<Center[]> {
		const where = params?.lotId ? { lotId: params.lotId } : {};
		const orms = await this.repo.find({ where });
		return orms.map((orm) => this.mapper.toCenterDomain(orm));
	}
}
