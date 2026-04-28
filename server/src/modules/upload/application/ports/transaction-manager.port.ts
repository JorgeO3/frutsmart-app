/**
 * Supported transaction isolation levels.
 *
 * @remarks
 * These levels are based on SQL standards and are crucial for handling concurrency:
 * - READ COMMITTED: Prevents dirty reads (default in PostgreSQL)
 * - REPEATABLE READ: Guarantees consistent reads within a transaction
 * - SERIALIZABLE: Strictest level, simulates serial execution
 */
export type TxIsolationLevel =
	| "READ COMMITTED"
	| "REPEATABLE READ"
	| "SERIALIZABLE";

/**
 * Configurable options for database transactions.
 *
 * @remarks
 * These options allow use cases to optimize or secure specific operations
 * based on their requirements.
 */
export interface TxOptions {
	/** Transaction isolation level */
	isolation?: TxIsolationLevel;
	/**
	 * When true, optimizes the transaction for read-only operations.
	 *
	 * @remarks
	 * Some database systems can significantly improve performance for read-only
	 * transactions by reducing locking and other overhead.
	 */
	readOnly?: boolean;
}

/**
 * Port interface defining the contract for a transaction manager (Unit of Work pattern).
 *
 * @remarks
 * This abstraction enables atomic and consistent execution of multiple operations
 * within a single database transaction. It follows the Unit of Work pattern,
 * ensuring all-or-nothing semantics for business operations.
 */
export const TRANSACTION_MANAGER = "TransactionManager";

export interface ITransactionManager {
	/**
	 * Executes a work function within a database transaction.
	 *
	 * @param work - Function containing operations to execute transactionally.
	 *               Receives a transactional entity manager reference that must be
	 *               passed to repositories to operate within the same transaction.
	 * @param options - Advanced transaction options (isolation level, read-only mode)
	 * @returns Promise resolving to the work function's result
	 *
	 * @remarks
	 * - If the work function succeeds, the transaction is committed automatically
	 * - If the work function throws an error, the transaction is rolled back
	 * - The transactional manager parameter (e.g., TypeORM EntityManager) must be
	 *   propagated to all repository operations for proper transaction handling
	 *
	 * @example
	 * ```typescript
	 * await transactionManager.runInTransaction(async (manager) => {
	 *   await sessionRepo.save(session, manager);
	 *   await itemsRepo.saveMany(items, manager);
	 * });
	 * ```
	 */
	runInTransaction<T>(
		work: (transactionalManager: unknown) => Promise<T>,
		options?: TxOptions,
	): Promise<T>;
}
