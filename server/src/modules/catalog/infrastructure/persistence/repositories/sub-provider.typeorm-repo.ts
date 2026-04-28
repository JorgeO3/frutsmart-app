import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { ISubProviderRepository } from "../../../application/ports/repositories/sub-provider.repository.port";
import { SubProvider } from "../../../domain/entities/sub-provider.entity";
import type { UUID } from "../../../domain/types";
import { SubProviderOrmEntity } from "../entities/sub-provider.orm-entity";
import { CatalogOrmMapper } from "../mappers/catalog-orm.mapper";

@Injectable()
export class SubProviderTypeOrmRepository implements ISubProviderRepository {
	constructor(
		@InjectRepository(SubProviderOrmEntity)
		private readonly repo: Repository<SubProviderOrmEntity>,
		private readonly mapper: CatalogOrmMapper,
	) {}

	async save(subProvider: SubProvider): Promise<void> {
		const orm = this.mapper.toSubProviderOrm(subProvider);
		await this.repo.save(orm);
	}

	async findById(id: UUID): Promise<SubProvider | null> {
		const orm = await this.repo.findOne({ where: { id } });
		return orm ? this.mapper.toSubProviderDomain(orm) : null;
	}

	async existsByProviderAndName(
		providerId: UUID,
		name: string,
	): Promise<boolean> {
		const count = await this.repo.count({
			where: { providerId, name },
		});
		return count > 0;
	}

	async list(params?: { providerId?: UUID }): Promise<SubProvider[]> {
		const where = params?.providerId ? { providerId: params.providerId } : {};
		const orms = await this.repo.find({ where });
		return orms.map((orm) => this.mapper.toSubProviderDomain(orm));
	}
}
