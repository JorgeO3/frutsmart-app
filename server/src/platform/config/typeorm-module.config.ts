import { ConfigService } from "@nestjs/config";
import { TypeOrmModuleAsyncOptions } from "@nestjs/typeorm";
import { AllConfigType } from "./config.type";

export const typeOrmModuleOptions: TypeOrmModuleAsyncOptions = {
  inject: [ConfigService],
  useFactory: (config: ConfigService<AllConfigType>) => {
    const db = config.getOrThrow("database", { infer: true });

    // Reglas: si hay URL -> modo URL; si no -> modo campos sueltos.
    const useUrl = !!db.url;

    if (!useUrl && !db.host) {
      throw new Error("Either DATABASE_URL or DATABASE_HOST must be provided");
    }

    // Base común
    const base = {
      type: "postgres" as const,
      synchronize: false,
      dropSchema: false,
      migrationsRun: false,
      logging: db.logging ?? false,
      retryAttempts: db.retryAttempts ?? 3,
      retryDelay: db.retryDelay ?? 2000,
      entities: ["dist/modules/**/infrastructure/**/*.orm-entity.js"],
      migrations: ["dist/platform/database/migrations/*{.ts,.js}"],
      extra: {
        max: db.maxConnections ?? 10,
        connectionTimeoutMillis: db.connectTimeoutMS ?? 10000,
        acquireTimeoutMillis: db.acquireTimeoutMS ?? 10000,
        // statement timeout del lado del cliente (node-postgres)
        statement_timeout: db.timeout ?? undefined,
      },
    };

    if (useUrl) {
      return {
        ...base,
        url: db.url,
        // SSL: para Azure PG suele requerirse
        ssl: db.ssl ?? { rejectUnauthorized: false }, // o true si subes el CA
      };
    }

    // Fallback sin URL (solo si de verdad lo necesitas)
    return {
      ...base,
      host: db.host,
      port: db.port ?? 5432,
      username: db.username,
      password: db.password,
      database: db.database,
      ssl: db.ssl ?? { rejectUnauthorized: false },
    };
  },
};
