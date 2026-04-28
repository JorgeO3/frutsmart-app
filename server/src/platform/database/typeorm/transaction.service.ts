import { Injectable } from "@nestjs/common";
import { DataSource, EntityManager, QueryRunner } from "typeorm";

// Isolation levels soportados por Postgres
export type TxIsolation = "READ COMMITTED" | "REPEATABLE READ" | "SERIALIZABLE";

export type TxOptions = {
	isolation?: TxIsolation; // default: 'READ COMMITTED'
	readOnly?: boolean; // default: false
	statementTimeoutMs?: number; // default: undefined (usa el de la conexión)
	maxRetries?: number; // default: 2
	backoffBaseMs?: number; // default: 100
};

const TRANSIENT_PG_CODES = new Set(["40001", "40P01"]); // serialization_failure, deadlock_detected

@Injectable()
export class TransactionService {
	constructor(private readonly dataSource: DataSource) {}

	/**
	 * Ejecuta una función en transacción con opciones avanzadas.
	 * - Retrys automáticos para errores transitorios (40001 / 40P01).
	 * - Soporte de isolation level, readOnly y statement_timeout por TX.
	 */
	async withTransaction<T>(
		fn: (manager: EntityManager) => Promise<T>,
		opts: TxOptions = {},
	): Promise<T> {
		const {
			isolation = "READ COMMITTED",
			readOnly = false,
			statementTimeoutMs,
			maxRetries = 2,
			backoffBaseMs = 100,
		} = opts;

		let attempt = 0;
		// Estrategia: si necesitamos setear GUCs (statement_timeout / readOnly) o isolation,
		// usamos QueryRunner manual; si no, podemos usar dataSource.transaction para menos boilerplate.
		const requiresRunner =
			readOnly || statementTimeoutMs != null || isolation !== "READ COMMITTED";

		while (true) {
			try {
				if (requiresRunner) {
					return await this.runWithQueryRunner(fn, {
						isolation,
						readOnly,
						statementTimeoutMs,
					});
				} else {
					// camino sencillo
					return await this.dataSource.transaction(async (manager) =>
						fn(manager),
					);
				}
			} catch (e: unknown) {
				const code: string | undefined = (e as { code?: string })?.code;
				const canRetry = TRANSIENT_PG_CODES.has(code ?? "");
				if (canRetry && attempt < maxRetries) {
					const delay = backoffBaseMs * 2 ** attempt;
					await new Promise((r) => setTimeout(r, delay));
					attempt++;
					continue;
				}
				throw e;
			}
		}
	}

	private async runWithQueryRunner<T>(
		fn: (manager: EntityManager) => Promise<T>,
		opts: {
			isolation: TxIsolation;
			readOnly: boolean;
			statementTimeoutMs?: number;
		},
	): Promise<T> {
		const runner: QueryRunner = this.dataSource.createQueryRunner();
		try {
			await runner.connect();
			await runner.startTransaction(opts.isolation);

			// Ajustes por transacción (session-local)
			if (opts.statementTimeoutMs != null) {
				await runner.query(
					`SET LOCAL statement_timeout = ${Math.max(1, Math.floor(opts.statementTimeoutMs))}`,
				);
			}
			if (opts.readOnly) {
				await runner.query(`SET TRANSACTION READ ONLY`);
			}

			const res = await fn(runner.manager);
			await runner.commitTransaction();
			return res;
		} catch (err) {
			try {
				await runner.rollbackTransaction();
			} catch {}
			throw err;
		} finally {
			try {
				await runner.release();
			} catch {}
		}
	}
}
