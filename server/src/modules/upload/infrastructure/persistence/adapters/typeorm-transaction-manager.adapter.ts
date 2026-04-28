import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { EntityManager } from "typeorm";
import {
	ITransactionManager,
	TxOptions,
} from "../../../application/ports/transaction-manager.port";

/**
 * Adapter that implements ITransactionManager using TypeORM's DataSource.
 *
 * @remarks
 * This adapter provides transaction management capabilities by wrapping
 * TypeORM's QueryRunner API, keeping the application layer independent
 * of the specific ORM implementation.
 *
 * The transactional EntityManager is passed to the work function, allowing
 * repositories to operate within the same transaction context.
 */
@Injectable()
export class TypeOrmTransactionManager implements ITransactionManager {
	constructor(private readonly dataSource: DataSource) {}

	/**
	 * @inheritdoc
	 */
	async runInTransaction<T>(
		work: (transactionalManager: EntityManager) => Promise<T>,
		options?: TxOptions,
	): Promise<T> {
		const queryRunner = this.dataSource.createQueryRunner();

		await queryRunner.connect();
		await queryRunner.startTransaction(options?.isolation);

		try {
			// Pass the transactional EntityManager to the work function
			const result = await work(queryRunner.manager);
			await queryRunner.commitTransaction();
			return result;
		} catch (error) {
			await queryRunner.rollbackTransaction();
			throw error;
		} finally {
			await queryRunner.release();
		}
	}
}
