import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { IProviderRepository } from "../../../application/ports/repositories/provider.repository.port";
import { Provider } from "../../../domain/entities/provider.entity";
import type { UUID } from "../../../domain/types";
import { ProviderOrmEntity } from "../entities/provider.orm-entity";
import { CatalogOrmMapper } from "../mappers/catalog-orm.mapper";

@Injectable()
export class ProviderTypeOrmRepository implements IProviderRepository {
	constructor(
		@InjectRepository(ProviderOrmEntity)
		private readonly repo: Repository<ProviderOrmEntity>,
		private readonly mapper: CatalogOrmMapper,
	) {}

	async save(provider: Provider): Promise<void> {
		const orm = this.mapper.toProviderOrm(provider);
		await this.repo.save(orm);
	}

	async findById(id: UUID): Promise<Provider | null> {
		const orm = await this.repo.findOne({ where: { id } });
		return orm ? this.mapper.toProviderDomain(orm) : null;
	}

	async existsByName(name: string): Promise<boolean> {
		const count = await this.repo.count({ where: { name } });
		return count > 0;
	}

	async list(): Promise<Provider[]> {
		const orms = await this.repo.find();
		return orms.map((orm) => this.mapper.toProviderDomain(orm));
	}
}
