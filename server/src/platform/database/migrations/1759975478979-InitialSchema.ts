import { MigrationInterface, QueryRunner } from "typeorm";

// biome-ignore format: true
export class InitialSchema1759975478979 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Extensiones
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Esquema
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS core`);

    // ENUMs
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regtype('core.upload_session_status') IS NULL THEN
          CREATE TYPE core.upload_session_status AS ENUM ('OPEN','COMPLETED','FAILED');
        END IF;
        IF to_regtype('core.upload_domain') IS NULL THEN
          CREATE TYPE core.upload_domain AS ENUM ('plant','field');
        END IF;
        IF to_regtype('core.upload_item_status') IS NULL THEN
          CREATE TYPE core.upload_item_status AS ENUM ('PENDING','IN_PROGRESS','UPLOADED','VERIFIED','INCOMPLETE','FAILED','ABORTED');
        END IF;
        IF to_regtype('core.storage_provider') IS NULL THEN
          CREATE TYPE core.storage_provider AS ENUM ('azure','s3','gcs');
        END IF;

        IF to_regtype('core.evaluation_type') IS NULL THEN
          CREATE TYPE core.evaluation_type AS ENUM ('PLANT_ANALYSIS','FIELD_EVENT');
        END IF;
        IF to_regtype('core.provider_kind') IS NULL THEN
          CREATE TYPE core.provider_kind AS ENUM ('own','third-party');
        END IF;
        IF to_regtype('core.classification_kind') IS NULL THEN
          CREATE TYPE core.classification_kind AS ENUM ('external','internal');
        END IF;
        IF to_regtype('core.photo_role') IS NULL THEN
          CREATE TYPE core.photo_role AS ENUM ('raw','segmented','cropped');
        END IF;
        IF to_regtype('core.model_kind') IS NULL THEN
          CREATE TYPE core.model_kind AS ENUM ('detection','external_classification','internal_classification');
        END IF;
        IF to_regtype('core.time_of_day') IS NULL THEN
          CREATE TYPE core.time_of_day AS ENUM ('day','night');
        END IF;
      END$$;
    `);

    // =========================
    // 1) Uploads
    // =========================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS core.upload_sessions (
        id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        client_batch_id  uuid NOT NULL,
        user_id          uuid,
        domain           core.upload_domain NOT NULL,
        status           core.upload_session_status NOT NULL DEFAULT 'OPEN',
        created_at       timestamptz NOT NULL DEFAULT now(),
        updated_at       timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_open_session_by_client_batch_open
        ON core.upload_sessions (domain, client_batch_id)
        WHERE status = 'OPEN'::core.upload_session_status
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS core.upload_items (
        id               uuid PRIMARY KEY,
        session_id       uuid NOT NULL REFERENCES core.upload_sessions(id) ON DELETE CASCADE,
        client_item_id   uuid NOT NULL,
        storage_provider core.storage_provider NOT NULL DEFAULT 'azure',
        blob_container   text NOT NULL,
        blob_name        text NOT NULL,
        content_type     text NOT NULL,
        size_bytes       bigint NOT NULL,
        md5              text NOT NULL,
        status           core.upload_item_status NOT NULL DEFAULT 'PENDING',
        created_at       timestamptz NOT NULL DEFAULT now(),
        updated_at       timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_item_by_session_client UNIQUE (session_id, client_item_id),
        CONSTRAINT uq_item_by_blob UNIQUE (blob_container, blob_name),
        CONSTRAINT ck_size_bytes_positive CHECK (size_bytes > 0)
      )
    `);

    // =========================
    // 2) Catálogos
    // =========================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS core.models (
        id           uuid PRIMARY KEY,
        name         text NOT NULL,
        version_tag  text NOT NULL,
        type         core.model_kind NOT NULL,
        UNIQUE (name, version_tag)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS core.programs (
        id   uuid PRIMARY KEY,
        name text NOT NULL UNIQUE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS core.lots (
        id         uuid PRIMARY KEY,
        name       text NOT NULL,
        program_id uuid NOT NULL REFERENCES core.programs(id) ON DELETE RESTRICT,
        UNIQUE (program_id, name)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS core.centers (
        id     uuid PRIMARY KEY,
        name   text NOT NULL,
        lot_id uuid NOT NULL REFERENCES core.lots(id) ON DELETE RESTRICT,
        UNIQUE (lot_id, name)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS core.providers (
        id   uuid PRIMARY KEY,
        name text NOT NULL UNIQUE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS core.sub_providers (
        id          uuid PRIMARY KEY,
        name        text NOT NULL,
        provider_id uuid NOT NULL REFERENCES core.providers(id) ON DELETE RESTRICT,
        UNIQUE (provider_id, name)
      )
    `);

    // =========================
    // 3) Evaluaciones y lógica
    // =========================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS core.evaluations (
        id                   uuid PRIMARY KEY,
        upload_session_id    uuid REFERENCES core.upload_sessions(id) ON DELETE CASCADE,
        type                 core.evaluation_type NOT NULL,
        creation_timestamp   timestamptz NOT NULL,
        is_finalized         boolean NOT NULL DEFAULT false,
        qr_code              text,
        provider_kind        core.provider_kind,
        truck_plate          text NOT NULL,
        consecutive_number   text NOT NULL,
        provider_id          uuid REFERENCES core.providers(id),
        sub_provider_id      uuid REFERENCES core.sub_providers(id),
        program_id           uuid REFERENCES core.programs(id),
        lot_id               uuid REFERENCES core.lots(id),
        center_id            uuid REFERENCES core.centers(id),
        device_time_of_day   core.time_of_day NOT NULL,
        device_weather       text NOT NULL,
        device_has_internet  boolean NOT NULL,
        geo_latitude         double precision NOT NULL,
        geo_longitude        double precision NOT NULL,
        harvest_criteria_json jsonb NOT NULL,
        harvest_observation  text,
        model_detection_id   uuid REFERENCES core.models(id),
        model_external_id    uuid REFERENCES core.models(id),
        model_internal_id    uuid REFERENCES core.models(id),
        created_at           timestamptz NOT NULL DEFAULT now(),

        CONSTRAINT ck_geolocation_valid CHECK (
          geo_latitude BETWEEN -90 AND 90 AND geo_longitude BETWEEN -180 AND 180
        ),

        CONSTRAINT ck_traceability_logic CHECK (
          (
            -- FIELD_EVENT
            type = 'FIELD_EVENT'
            AND provider_kind IS NULL
            AND program_id IS NOT NULL
            AND lot_id IS NOT NULL
            AND center_id IS NOT NULL
            AND provider_id IS NULL
            AND sub_provider_id IS NULL
          ) OR (
            -- PLANT_ANALYSIS + third-party
            type = 'PLANT_ANALYSIS'
            AND provider_kind = 'third-party'
            AND provider_id IS NOT NULL
            AND sub_provider_id IS NOT NULL
            AND program_id IS NULL
            AND lot_id IS NULL
            AND center_id IS NULL
          ) OR (
            -- PLANT_ANALYSIS + own
            type = 'PLANT_ANALYSIS'
            AND provider_kind = 'own'
            AND program_id IS NOT NULL
            AND provider_id IS NULL
            AND sub_provider_id IS NULL
            AND lot_id IS NULL
            AND center_id IS NULL
          )
        )
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS core.evaluation_lots (
        evaluation_id uuid NOT NULL REFERENCES core.evaluations(id) ON DELETE CASCADE,
        lot_id        uuid NOT NULL REFERENCES core.lots(id) ON DELETE RESTRICT,
        PRIMARY KEY (evaluation_id, lot_id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS core.classification_steps (
        id              uuid PRIMARY KEY,
        evaluation_id   uuid NOT NULL REFERENCES core.evaluations(id) ON DELETE CASCADE,
        kind            core.classification_kind NOT NULL,
        iteration_index integer NOT NULL DEFAULT 0,
        created_at      timestamptz NOT NULL DEFAULT now(),
        UNIQUE (evaluation_id, kind, iteration_index),
        CONSTRAINT ck_iteration_index_range CHECK (iteration_index BETWEEN 0 AND 3)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS core.classification_results (
        id                      uuid PRIMARY KEY,
        step_id                 uuid NOT NULL REFERENCES core.classification_steps(id) ON DELETE CASCADE,
        ai_class_name           text NOT NULL,
        ai_confidence           double precision NOT NULL,
        ai_raw_confidences_json jsonb NOT NULL,
        hf_is_correct           boolean,
        hf_corrected_class_name text,
        hf_observation          text,
        created_at              timestamptz NOT NULL DEFAULT now(),
        UNIQUE (step_id),
        CONSTRAINT ck_ai_confidence_range CHECK (ai_confidence >= 0 AND ai_confidence <= 1)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS core.photos (
        id             uuid PRIMARY KEY,
        step_id        uuid NOT NULL REFERENCES core.classification_steps(id) ON DELETE CASCADE,
        role           core.photo_role NOT NULL,
        upload_item_id uuid NOT NULL REFERENCES core.upload_items(id) ON DELETE CASCADE,
        created_at     timestamptz NOT NULL DEFAULT now(),
        UNIQUE (step_id, upload_item_id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS core.classified_segments (
        id               uuid PRIMARY KEY,
        step_id          uuid NOT NULL REFERENCES core.classification_steps(id) ON DELETE CASCADE,
        upload_item_id   uuid NOT NULL REFERENCES core.upload_items(id) ON DELETE CASCADE,
        best_class_name  text NOT NULL,
        best_confidence  double precision NOT NULL,
        confidences_json jsonb NOT NULL,
        created_at       timestamptz NOT NULL DEFAULT now(),
        UNIQUE (step_id, upload_item_id),
        CONSTRAINT ck_best_confidence_range CHECK (best_confidence >= 0 AND best_confidence <= 1)
      )
    `);

    // =========================
    // Función updated_at + triggers
    // =========================
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION core.set_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at := now();
        RETURN NEW;
      END; $$ LANGUAGE plpgsql
    `);

    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_upload_items_updated_at ON core.upload_items`);
    await queryRunner.query(`
      CREATE TRIGGER trg_upload_items_updated_at
      BEFORE UPDATE ON core.upload_items
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()
    `);

    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_upload_sessions_updated_at ON core.upload_sessions`);
    await queryRunner.query(`
      CREATE TRIGGER trg_upload_sessions_updated_at
      BEFORE UPDATE ON core.upload_sessions
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at()
    `);

    // =========================
    // Constraint triggers clave
    // =========================

    // (A) Versión DEFERRED: no se puede completar si al COMMIT hay ítems <> VERIFIED
    // Limpieza de artefactos previos (por si existían)
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_ck_upload_session_complete ON core.upload_sessions`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS core.assert_session_can_complete()`);

    // Nueva función diferible
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION core.ensure_session_completable()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      AS $$
      BEGIN
        IF NEW.status = 'COMPLETED'::core.upload_session_status
           AND (OLD.status IS DISTINCT FROM 'COMPLETED'::core.upload_session_status) THEN

          -- Debe existir al menos 1 ítem
          IF NOT EXISTS (
            SELECT 1 FROM core.upload_items i
            WHERE i.session_id = NEW.id
          ) THEN
            RAISE EXCEPTION
              'Cannot COMPLETE upload_session % with 0 items',
              NEW.id
              USING ERRCODE='23514';
          END IF;

          -- Todos los ítems deben estar VERIFIED (ajusta si quieres permitir UPLOADED)
          IF EXISTS (
            SELECT 1 FROM core.upload_items i
            WHERE i.session_id = NEW.id
              AND i.status <> 'VERIFIED'::core.upload_item_status
          ) THEN
            RAISE EXCEPTION
              'Cannot COMPLETE upload_session %; items not verified',
              NEW.id
              USING ERRCODE='23514';
          END IF;
        END IF;

        RETURN NEW;
      END;
      $$;
    `);

    // Constraint trigger DEFERRED (evalúa al COMMIT)
    await queryRunner.query(`
      CREATE CONSTRAINT TRIGGER trg_ck_upload_session_complete
      AFTER UPDATE OF status ON core.upload_sessions
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION core.ensure_session_completable()
    `);

    // (B) Evaluación requiere sesión COMPLETED (si referencia upload_session_id)
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION core.assert_eval_session_completed()
      RETURNS TRIGGER AS $$
      DECLARE
        sess_status core.upload_session_status;
        pending_cnt integer;
      BEGIN
        IF NEW.upload_session_id IS NULL THEN
          RETURN NEW;
        END IF;

        SELECT status INTO sess_status
        FROM core.upload_sessions
        WHERE id = NEW.upload_session_id;

        IF sess_status IS DISTINCT FROM 'COMPLETED'::core.upload_session_status THEN
          RAISE EXCEPTION 'upload_session % must be COMPLETED before creating/updating evaluation %',
            NEW.upload_session_id, NEW.id USING ERRCODE='23514';
        END IF;

        SELECT COUNT(*) INTO pending_cnt
        FROM core.upload_items
        WHERE session_id = NEW.upload_session_id
          AND status IN ('PENDING','IN_PROGRESS','INCOMPLETE');

        IF pending_cnt > 0 THEN
          RAISE EXCEPTION 'upload_session % still has % pending/in-progress items',
            NEW.upload_session_id, pending_cnt USING ERRCODE='23514';
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_ck_eval_requires_completed_session ON core.evaluations`);
    await queryRunner.query(`
      CREATE CONSTRAINT TRIGGER trg_ck_eval_requires_completed_session
      AFTER INSERT OR UPDATE ON core.evaluations
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION core.assert_eval_session_completed()
    `);

    // (C) PLANT_ANALYSIS + own => al menos un evaluation_lot
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION core.assert_eval_own_has_lots()
      RETURNS TRIGGER AS $$
      BEGIN
        IF (NEW.type = 'PLANT_ANALYSIS' AND NEW.provider_kind = 'own') THEN
          PERFORM 1 FROM core.evaluation_lots WHERE evaluation_id = NEW.id;
          IF NOT FOUND THEN
            RAISE EXCEPTION
              'evaluation_lots required when type=PLANT_ANALYSIS and provider_kind=own (evaluation_id=%)',
              NEW.id USING ERRCODE='23514';
          END IF;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_ck_eval_own_has_lots ON core.evaluations`);
    await queryRunner.query(`
      CREATE CONSTRAINT TRIGGER trg_ck_eval_own_has_lots
      AFTER INSERT OR UPDATE ON core.evaluations
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION core.assert_eval_own_has_lots()
    `);

    // =========================
    // Índices
    // =========================
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_session_by_client_batch   ON core.upload_sessions(client_batch_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_session_by_user           ON core.upload_sessions(user_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_session_status            ON core.upload_sessions(status)`);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_upload_items_status       ON core.upload_items(status)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_upload_items_session_id   ON core.upload_items(session_id)`);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_lots_program_id           ON core.lots(program_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_centers_lot_id            ON core.centers(lot_id)`);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_evaluations_upload_session_id ON core.evaluations(upload_session_id) WHERE upload_session_id IS NOT NULL`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_evaluations_type_timestamp    ON core.evaluations(type, creation_timestamp DESC)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_evaluations_truck_plate       ON core.evaluations(truck_plate)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_evaluations_program_id        ON core.evaluations(program_id) WHERE program_id IS NOT NULL`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_evaluations_lot_id            ON core.evaluations(lot_id) WHERE lot_id IS NOT NULL`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_evaluations_center_id         ON core.evaluations(center_id) WHERE center_id IS NOT NULL`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_evaluations_provider_id       ON core.evaluations(provider_id) WHERE provider_id IS NOT NULL`);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_evaluation_lots_lot_id        ON core.evaluation_lots(lot_id)`);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_classification_steps_evaluation_id ON core.classification_steps(evaluation_id)`);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_photos_step_id                 ON core.photos(step_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_photos_upload_item_id          ON core.photos(upload_item_id)`);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_classified_segments_step_id        ON core.classified_segments(step_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_classified_segments_upload_item_id ON core.classified_segments(upload_item_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Índices
    await queryRunner.query(`DROP INDEX IF EXISTS core.idx_classified_segments_upload_item_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS core.idx_classified_segments_step_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS core.idx_photos_upload_item_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS core.idx_photos_step_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS core.idx_classification_steps_evaluation_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS core.idx_evaluation_lots_lot_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS core.idx_evaluations_provider_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS core.idx_evaluations_center_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS core.idx_evaluations_lot_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS core.idx_evaluations_program_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS core.idx_evaluations_truck_plate`);
    await queryRunner.query(`DROP INDEX IF EXISTS core.idx_evaluations_type_timestamp`);
    await queryRunner.query(`DROP INDEX IF EXISTS core.idx_evaluations_upload_session_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS core.idx_centers_lot_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS core.idx_lots_program_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS core.idx_upload_items_session_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS core.idx_upload_items_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS core.idx_session_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS core.idx_session_by_user`);
    await queryRunner.query(`DROP INDEX IF EXISTS core.idx_session_by_client_batch`);
    await queryRunner.query(`DROP INDEX IF EXISTS core.uq_open_session_by_client_batch_open`);

    // Constraint triggers
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_ck_eval_own_has_lots ON core.evaluations`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS core.assert_eval_own_has_lots`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_ck_eval_requires_completed_session ON core.evaluations`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS core.assert_eval_session_completed`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_ck_upload_session_complete ON core.upload_sessions`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS core.ensure_session_completable`);

    // Triggers updated_at
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_upload_sessions_updated_at ON core.upload_sessions`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_upload_items_updated_at ON core.upload_items`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS core.set_updated_at`);

    // Tablas (orden inverso)
    await queryRunner.query(`DROP TABLE IF EXISTS core.classified_segments CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS core.photos CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS core.classification_results CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS core.classification_steps CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS core.evaluation_lots CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS core.evaluations CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS core.sub_providers CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS core.providers CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS core.centers CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS core.lots CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS core.programs CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS core.models CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS core.upload_items CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS core.upload_sessions CASCADE`);

    // ENUMs
    await queryRunner.query(`DROP TYPE IF EXISTS core.time_of_day CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS core.model_kind CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS core.photo_role CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS core.classification_kind CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS core.provider_kind CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS core.evaluation_type CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS core.storage_provider CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS core.upload_item_status CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS core.upload_domain CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS core.upload_session_status CASCADE`);

    // Esquema
    await queryRunner.query(`DROP SCHEMA IF EXISTS core CASCADE`);
  }
}
