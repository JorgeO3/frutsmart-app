import { Injectable } from "@nestjs/common";
import { Model } from "../../../domain/entities/model.entity";
import { Program } from "../../../domain/entities/program.entity";
import { Lot } from "../../../domain/entities/lot.entity";
import { Center } from "../../../domain/entities/center.entity";
import { Provider } from "../../../domain/entities/provider.entity";
import { SubProvider } from "../../../domain/entities/sub-provider.entity";
import { ModelOrmEntity } from "../entities/model.orm-entity";
import { ProgramOrmEntity } from "../entities/program.orm-entity";
import { LotOrmEntity } from "../entities/lot.orm-entity";
import { CenterOrmEntity } from "../entities/center.orm-entity";
import { ProviderOrmEntity } from "../entities/provider.orm-entity";
import { SubProviderOrmEntity } from "../entities/sub-provider.orm-entity";

/**
 * Mapper for converting between domain entities and TypeORM entities
 */
@Injectable()
export class CatalogOrmMapper {
	// Model conversions
	toModelOrm(model: Model): ModelOrmEntity {
		const orm = new ModelOrmEntity();
		orm.id = model.id;
		orm.name = model.name;
		orm.versionTag = model.versionTag;
		orm.type = model.type;
		return orm;
	}

	toModelDomain(orm: ModelOrmEntity): Model {
		return Model.create({
			id: orm.id,
			name: orm.name,
			versionTag: orm.versionTag,
			type: orm.type,
		});
	}

	// Program conversions
	toProgramOrm(program: Program): ProgramOrmEntity {
		const orm = new ProgramOrmEntity();
		orm.id = program.id;
		orm.name = program.name;
		return orm;
	}

	toProgramDomain(orm: ProgramOrmEntity): Program {
		return Program.create({
			id: orm.id,
			name: orm.name,
		});
	}

	// Lot conversions
	toLotOrm(lot: Lot): LotOrmEntity {
		const orm = new LotOrmEntity();
		orm.id = lot.id;
		orm.name = lot.name;
		orm.programId = lot.programId;
		return orm;
	}

	toLotDomain(orm: LotOrmEntity): Lot {
		return Lot.create({
			id: orm.id,
			name: orm.name,
			programId: orm.programId,
		});
	}

	// Center conversions
	toCenterOrm(center: Center): CenterOrmEntity {
		const orm = new CenterOrmEntity();
		orm.id = center.id;
		orm.name = center.name;
		orm.lotId = center.lotId;
		return orm;
	}

	toCenterDomain(orm: CenterOrmEntity): Center {
		return Center.create({
			id: orm.id,
			name: orm.name,
			lotId: orm.lotId,
		});
	}

	// Provider conversions
	toProviderOrm(provider: Provider): ProviderOrmEntity {
		const orm = new ProviderOrmEntity();
		orm.id = provider.id;
		orm.name = provider.name;
		return orm;
	}

	toProviderDomain(orm: ProviderOrmEntity): Provider {
		return Provider.create({
			id: orm.id,
			name: orm.name,
		});
	}

	// SubProvider conversions
	toSubProviderOrm(subProvider: SubProvider): SubProviderOrmEntity {
		const orm = new SubProviderOrmEntity();
		orm.id = subProvider.id;
		orm.name = subProvider.name;
		orm.providerId = subProvider.providerId;
		return orm;
	}

	toSubProviderDomain(orm: SubProviderOrmEntity): SubProvider {
		return SubProvider.create({
			id: orm.id,
			name: orm.name,
			providerId: orm.providerId,
		});
	}
}
