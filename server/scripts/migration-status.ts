#!/usr/bin/env ts-node

/**
 * Migration Status Checker
 *
 * This script provides a detailed view of the current migration status,
 * including pending migrations and migration history.
 */

import { AppDataSource } from "../src/platform/database/data-source";
import path from "node:path";

async function checkMigrationStatus() {
  console.log("🔍 Checking migration status...\n");

  try {
    // Initialize the data source
    await AppDataSource.initialize();

    // Get all migrations (both run and pending)
    const queryRunner = AppDataSource.createQueryRunner();

    // Check if migrations table exists
    const migrationTableExists =
      await queryRunner.hasTable("typeorm_migrations");

    if (!migrationTableExists) {
      console.log(
        "❗ Migration table does not exist. No migrations have been run yet.",
      );
      console.log(
        '   Run "npm run migration:run" to apply pending migrations.\n',
      );
      return;
    }

    // Get executed migrations
    const executedMigrations = await queryRunner.query(`
            SELECT name, timestamp 
            FROM typeorm_migrations 
            ORDER BY timestamp DESC
        `);

    console.log("✅ Executed Migrations:");
    if (executedMigrations.length === 0) {
      console.log("   No migrations have been executed yet.");
    } else {
      executedMigrations.forEach((migration: any, index: number) => {
        const date = new Date(parseInt(migration.timestamp, 10)).toISOString();
        console.log(`   ${index + 1}. ${migration.name} (${date})`);
      });
    }

    console.log("\n📋 Migration Files Available:");

    // Get all migration files from the filesystem
    const fs = require("node:fs");
    const appDir = process.cwd();
    const isProduction = process.env.BACKEND_NODE_ENV === "production";
    const srcOrDist = isProduction ? "dist" : "src";
    const migrationsDir = path.join(appDir, srcOrDist, "database/migrations");
    let migrationFiles: string[] = [];

    if (fs.existsSync(migrationsDir)) {
      migrationFiles = fs
        .readdirSync(migrationsDir)
        .filter((file: string) => file.endsWith(".ts") || file.endsWith(".js"))
        .sort();

      if (migrationFiles.length === 0) {
        console.log("   No migration files found.");
      } else {
        migrationFiles.forEach((file: string, index: number) => {
          const migrationName = file.replace(/\.(ts|js)$/, "");
          // The database stores full migration names, so we need to match against them
          const isExecuted = executedMigrations.some(
            (m: any) =>
              m.name === migrationName ||
              m.name.includes(migrationName.split("-")[0]),
          );
          const status = isExecuted ? "✅ EXECUTED" : "⏳ PENDING";
          console.log(`   ${index + 1}. ${migrationName} - ${status}`);
        });
      }
    } else {
      console.log("   Migrations directory not found.");
    }

    // Get pending migrations count
    const pendingCount = migrationFiles.filter((file: string) => {
      const migrationName = file.replace(/\.(ts|js)$/, "");
      return !executedMigrations.some(
        (m: any) =>
          m.name === migrationName ||
          m.name.includes(migrationName.split("-")[0]),
      );
    }).length;

    console.log(`\n📊 Summary:`);
    console.log(`   • Total migration files: ${migrationFiles.length}`);
    console.log(`   • Executed migrations: ${executedMigrations.length}`);
    console.log(`   • Pending migrations: ${pendingCount}`);

    if (pendingCount > 0) {
      console.log("\n💡 Next steps:");
      console.log("   • To apply pending migrations: npm run migration:run");
      console.log("   • To revert last migration: npm run migration:revert");
    }

    await queryRunner.release();
  } catch (error) {
    console.error("❌ Error checking migration status:", error);
    process.exit(1);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

// Run the script
checkMigrationStatus()
  .then(() => {
    console.log("\n✨ Migration status check completed.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
