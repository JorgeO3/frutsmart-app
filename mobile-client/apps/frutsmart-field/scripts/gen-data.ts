#!/usr/bin/env -S deno run --allow-all

// @ts-nocheck

/**
 * Script to create and seed a SQLite database for the Quality Assurance app.
 * It uses Deno, node:sqlite for database interaction, and Faker.js for mock data generation.
 *
 * --- How to Run ---
 * 1. Make sure you have the 'schema.sql' file in the same directory.
 * 2. Execute the following command in your terminal:
 * deno run --allow-read --allow-write seed.ts
 */

import { DatabaseSync } from "node:sqlite";
import { faker } from "npm:@faker-js/faker@8.4.1";
import { resolve } from "jsr:@std/path";

// --- Configuration ---
const DB_FILE = "frutsmart.db";
const NUM_LOTS = 5;
const NUM_CENTERS_PER_LOT = 50;
const NUM_USERS = 200;
const NUM_CLASSIFICATIONS = 10000;
const MODEL_ARCHITECTURES = ["YOLOv11", "ResNet50", "EfficientNetV2"];

/**
 * ============================================================
 * Main Script Logic
 * ============================================================
 */

/**
 * Reads the database schema from the 'schema.sql' file.
 * @returns The SQL schema as a string.
 */
function readSchema(): string {
  try {
    const schemaPath = resolve("./frutsmart.sql");
    return Deno.readTextFileSync(schemaPath);
  } catch (error) {
    console.error(
      "Error: Could not find 'schema.sql'. Make sure it exists in the same directory as this script.",
    );
    console.error(error instanceof Error ? error.message : error);
    Deno.exit(1);
  }
}

/**
 * The main function to set up and seed the database.
 */
function main() {
  // 1. Clean up old database file for a fresh start
  try {
    Deno.removeSync(DB_FILE);
    console.log(`🧹 Old database file '${DB_FILE}' removed.`);
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      throw error;
    }
    // If it doesn't exist, we do nothing.
  }

  // 2. Open or create the database
  const db = new DatabaseSync(DB_FILE);
  console.log(`✅ Database '${DB_FILE}' opened/created.`);

  // 3. Apply the schema
  const schema = readSchema();
  db.exec(schema);
  console.log("🚀 Database schema applied successfully.");

  // 4. Prepare all INSERT statements for performance
  const insertUser = db.prepare(
    "INSERT INTO users (id, name, role) VALUES (?, ?, ?)",
  );
  const insertModel = db.prepare(
    "INSERT INTO models (id, name, version_tag, type) VALUES (?, ?, ?, ?)",
  );
  const insertLot = db.prepare("INSERT INTO lots (id, name) VALUES (?, ?)");
  const insertCenter = db.prepare(
    "INSERT INTO centers (id, name, lot_id) VALUES (?, ?, ?)",
  );
  const insertClassification = db.prepare(
    `INSERT INTO quality_classifications (quality_classification_id, creation_timestamp, lot_id, center_id, applicator_id, verifier_id, device_time_of_day, device_weather, device_has_internet, geo_latitude, geo_longitude, model_detection_id, model_external_id, model_internal_id, harvest_assigned_criterion, harvest_number_of_applications, harvest_observation)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertPhoto = db.prepare(
    "INSERT INTO classification_photos (id, quality_classification_id, classification_type, photo_type, uri, raw_inference_output_json) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const insertResult = db.prepare(
    `INSERT INTO classification_results (id, quality_classification_id, classification_type, ai_predicted_class_name, ai_confidence, ai_raw_inference_output_json, human_feedback_is_correct, human_feedback_corrected_class, human_feedback_observation)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  // 5. Generate and insert data within a single transaction for atomicity and speed
  let transactionStarted = false;
  try {
    db.exec("BEGIN TRANSACTION");
    transactionStarted = true;
    console.log("\n🌱 Seeding catalog data...");

    // --- Users ---
    const users = Array.from({ length: NUM_USERS }, () => ({
      id: `user_${faker.string.uuid()}`,
      name: faker.person.fullName(),
      role: faker.helpers.arrayElement(["applicator", "verifier"]),
    }));
    for (const { id, name, role } of users) {
      insertUser.run(id, name, role);
    }
    console.log(`   - ${NUM_USERS} users created.`);

    // --- Models ---
    const models = [
      "detection",
      "external_classification",
      "internal_classification",
    ].map((type) => ({
      id: `model_${faker.string.uuid()}`,
      name: faker.helpers.arrayElement(MODEL_ARCHITECTURES),
      version_tag: `v${faker.system.semver()}`,
      type,
    }));
    for (const model of models) {
      insertModel.run(model.id, model.name, model.version_tag, model.type);
    }
    console.log(`   - ${models.length} models created.`);

    // --- Lots ---
    const lots = Array.from({ length: NUM_LOTS }, () => ({
      id: `lot_${faker.string.alphanumeric(6)}`,
      name: `IS${faker.number.int({ min: 100, max: 999 })}`,
    }));
    for (const lot of lots) {
      insertLot.run(lot.id, lot.name);
    }
    console.log(`   - ${NUM_LOTS} lots created.`);

    // --- Centers ---
    const centers = lots.flatMap((lot) =>
      Array.from({ length: NUM_CENTERS_PER_LOT }, () => ({
        id: `center_${faker.string.alphanumeric(8)}`,
        name: `CS${faker.number.int({ min: 100, max: 999 })}`,
        lot_id: lot.id,
      })),
    );
    for (const center of centers) {
      insertCenter.run(center.id, center.name, center.lot_id);
    }
    console.log(`   - ${centers.length} centers created.`);

    console.log("\n🌿 Seeding transactional data...");
    const applicators = users.filter((u) => u.role === "applicator");
    const verifiers = users.filter((u) => u.role === "verifier");

    for (let i = 0; i < NUM_CLASSIFICATIONS; i++) {
      const lot = faker.helpers.arrayElement(lots);
      const center = faker.helpers.arrayElement(
        centers.filter((c) => c.lot_id === lot.id),
      );
      const classificationId = `qc_${faker.string.uuid()}`;

      // --- Main Classification Record ---
      insertClassification.run(
        classificationId,
        faker.date.past({ years: 1 }).toISOString(),
        lot.id,
        center.id,
        faker.helpers.arrayElement(applicators).id,
        faker.helpers.arrayElement(verifiers).id,
        faker.helpers.arrayElement(["day", "night"]),
        faker.helpers.arrayElement(["sunny", "cloudy", "rainy"]),
        faker.datatype.boolean() ? 1 : 0,
        faker.location.latitude(),
        faker.location.longitude(),
        models.find((m) => m.type === "detection")?.id ?? null,
        models.find((m) => m.type === "external_classification")?.id ?? null,
        models.find((m) => m.type === "internal_classification")?.id ?? null,
        faker.helpers.arrayElement(["RB", "SG", "MT"]),
        faker.number.int({ min: 1, max: 5 }),
        faker.lorem.sentence(),
      );

      // --- External Classification Photos & Result ---
      for (let j = 0; j < 3; j++) {
        const rawPhotoId = `photo_ext_raw_${classificationId}_${j}`;
        const segPhotoId = `photo_ext_seg_${classificationId}_${j}`;
        insertPhoto.run(
          rawPhotoId,
          classificationId,
          "external",
          "raw",
          // `file:///photos/${rawPhotoId}.jpg`,
          "file:///data/user/0/com.anonymous.frutosmart/cache/reports/assets/clase1.jpeg",
          null,
        );
        insertPhoto.run(
          segPhotoId,
          classificationId,
          "external",
          "segmented",
          `file:///photos/${segPhotoId}.jpg`,
          // "file:///data/user/0/com.anonymous.frutosmart/cache/reports/assets/clase1.jpeg",
          JSON.stringify({ mask: "..." }),
        );
      }
      insertResult.run(
        `res_ext_${classificationId}`,
        classificationId,
        "external",
        `Class ${faker.number.int({ min: 1, max: 4 })}`,
        faker.number.float({ min: 0.75, max: 0.98, multipleOf: 0.001 }),
        JSON.stringify({ scores: "..." }),
        faker.datatype.boolean(0.8) ? 1 : 0,
        null,
        faker.lorem.sentence(),
      );

      // --- Internal Classification Photos & Result ---
      const intRawPhotoId = `photo_int_raw_${classificationId}`;
      const intSegPhotoId = `photo_int_seg_${classificationId}`;
      insertPhoto.run(
        intRawPhotoId,
        classificationId,
        "internal",
        "raw",
        // `file:///photos/${intRawPhotoId}.jpg`,
        "file:///data/user/0/com.anonymous.frutosmart/cache/reports/assets/tipoa.jpeg", // necesito probar una funcionalidad
        null,
      );
      insertPhoto.run(
        intSegPhotoId,
        classificationId,
        "internal",
        "segmented",
        `file:///photos/${intSegPhotoId}.jpg`,
        // "file:///data/user/0/com.anonymous.frutosmart/cache/reports/assets/tipoa.jpeg",
        JSON.stringify({ mask: "..." }),
      );
      insertResult.run(
        `res_int_${classificationId}`,
        classificationId,
        "internal",
        `Type ${faker.helpers.arrayElement(["A", "B", "C"])}`,
        faker.number.float({ min: 0.85, max: 0.99, multipleOf: 0.001 }),
        JSON.stringify({ scores: "..." }),
        faker.datatype.boolean(0.9) ? 1 : 0,
        null,
        "",
      );
    }
    console.log(`   - ${NUM_CLASSIFICATIONS} quality classifications created.`);

    db.exec("COMMIT TRANSACTION");
    transactionStarted = false;
    console.log("\n✅ Transaction committed successfully.");
  } catch (err) {
    if (transactionStarted) {
      db.exec("ROLLBACK TRANSACTION");
      console.error("\n❌ Transaction rolled back due to an error.");
    }
    console.error(
      err instanceof Error
        ? `Error: ${err.message}`
        : "An unexpected error occurred.",
    );
  } finally {
    // 6. Close the database connection
    db.close();
    console.log("\n✨ Process complete. The database connection is closed.");
  }
}

// Run the main script
main();
