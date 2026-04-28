import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { IProgramRepository } from "../../../application/ports/repositories/program.repository.port";
import { Program } from "../../../domain/entities/program.entity";
import type { UUID } from "../../../domain/types";
import { ProgramOrmEntity } from "../entities/program.orm-entity";
import { CatalogOrmMapper } from "../mappers/catalog-orm.mapper";

@Injectable()
export class ProgramTypeOrmRepository implements IProgramRepository {
	constructor(
		@InjectRepository(ProgramOrmEntity)
		private readonly repo: Repository<ProgramOrmEntity>,
		private readonly mapper: CatalogOrmMapper,
	) {}

	async save(program: Program): Promise<void> {
		const orm = this.mapper.toProgramOrm(program);
		await this.repo.save(orm);
	}

	async findById(id: UUID): Promise<Program | null> {
		const orm = await this.repo.findOne({ where: { id } });
		return orm ? this.mapper.toProgramDomain(orm) : null;
	}

	async existsByName(name: string): Promise<boolean> {
		const count = await this.repo.count({ where: { name } });
		return count > 0;
	}

	async list(): Promise<Program[]> {
		const orms = await this.repo.find();
		return orms.map((orm) => this.mapper.toProgramDomain(orm));
	}
}
