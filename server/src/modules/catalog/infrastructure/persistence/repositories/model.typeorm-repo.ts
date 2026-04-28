import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { IModelRepository } from "../../../application/ports/repositories/model.repository.port";
import { Model } from "../../../domain/entities/model.entity";
import type { ModelType, UUID } from "../../../domain/types";
import { ModelOrmEntity } from "../entities/model.orm-entity";
import { CatalogOrmMapper } from "../mappers/catalog-orm.mapper";

@Injectable()
export class ModelTypeOrmRepository implements IModelRepository {
	constructor(
		@InjectRepository(ModelOrmEntity)
		private readonly repo: Repository<ModelOrmEntity>,
		private readonly mapper: CatalogOrmMapper,
	) {}

	async save(model: Model): Promise<void> {
		const orm = this.mapper.toModelOrm(model);
		await this.repo.save(orm);
	}

	async findById(id: UUID): Promise<Model | null> {
		const orm = await this.repo.findOne({ where: { id } });
		return orm ? this.mapper.toModelDomain(orm) : null;
	}

	async existsByNameAndVersionTag(
		name: string,
		versionTag: string,
	): Promise<boolean> {
		const count = await this.repo.count({
			where: { name, versionTag },
		});
		return count > 0;
	}

	async list(params?: { type?: ModelType }): Promise<Model[]> {
		const where = params?.type ? { type: params.type } : {};
		const orms = await this.repo.find({ where });
		return orms.map((orm) => this.mapper.toModelDomain(orm));
	}
}
