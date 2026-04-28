-- =============================================================================
-- SCHEMA: staging_plant (sin sesiones ni reports)
--  - Traducción 1:1 donde importa
--  - BOOLEAN reales, ENUMs fuera de tablas
--  - FKs DEFERRABLE para cargas por lote
--  - Sin FTS ni triggers de negocio
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS staging_plant;

-- =============================================================================
-- ENUMS
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'model_kind') THEN
    CREATE TYPE staging_plant.model_kind AS ENUM (
      'detection','external_classification','internal_classification'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'provider_kind') THEN
    CREATE TYPE staging_plant.provider_kind AS ENUM ('own','third-party');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'time_of_day') THEN
    CREATE TYPE staging_plant.time_of_day AS ENUM ('day','night');
  END IF;
END$$;

-- =============================================================================
-- SECTION 1: CATALOG TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS staging_plant.models (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  version_tag  TEXT NOT NULL,
  type         staging_plant.model_kind NOT NULL,
  UNIQUE (name, version_tag)
);

CREATE TABLE IF NOT EXISTS staging_plant.programs (
  id           TEXT PRIMARY KEY,
  program_name TEXT NOT NULL,
  UNIQUE (program_name)
);

CREATE TABLE IF NOT EXISTS staging_plant.lots (
  id           TEXT PRIMARY KEY,
  lot_name     TEXT NOT NULL,
  program_id   TEXT NOT NULL,
  CONSTRAINT fk_lots_program
    FOREIGN KEY (program_id)
    REFERENCES staging_plant.programs(id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT uq_lot_name_in_program UNIQUE (program_id, lot_name)
);

CREATE TABLE IF NOT EXISTS staging_plant.sessions (
  id               TEXT PRIMARY KEY,
  start_timestamp  timestamptz NOT NULL,
  end_timestamp    timestamptz,
  ingested_at      timestamptz NOT NULL DEFAULT now()
);
-- =============================================================================
-- SECTION 2: CORE AND SUPPORTING TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS staging_plant.quality_analyses (
  id                   TEXT PRIMARY KEY,
  creation_timestamp   timestamptz NOT NULL,
  session_id          TEXT NOT NULL,

  provider             staging_plant.provider_kind NOT NULL,

  qr_code              TEXT,
  truck_plate          TEXT NOT NULL,
  consecutive_number   TEXT NOT NULL,

  program_id           TEXT,
  vendor               TEXT,
  sub_vendor           TEXT,

  device_time_of_day   staging_plant.time_of_day NOT NULL,
  device_weather       TEXT NOT NULL,
  device_has_internet  BOOLEAN,
  geo_latitude         double precision NOT NULL CHECK (geo_latitude  BETWEEN -90  AND 90),
  geo_longitude        double precision NOT NULL CHECK (geo_longitude BETWEEN -180 AND 180),

  model_detection_id   TEXT,
  model_external_id    TEXT,
  model_internal_id    TEXT,

  criteria_rb          double precision,
  criteria_rv          double precision,
  criteria_rsm         double precision,
  criteria_rmf         double precision,
  criteria_rpl         double precision,
  criteria_pas         double precision,
  criteria_vac         double precision,

  external_summary_json jsonb,
  internal_summary_json jsonb,

  is_finalized         BOOLEAN NOT NULL DEFAULT FALSE,
  ingested_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fk_qa_program
    FOREIGN KEY (program_id)
    REFERENCES staging_plant.programs(id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,

  CONSTRAINT fk_qa_model_det
    FOREIGN KEY (model_detection_id)
    REFERENCES staging_plant.models(id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED,

  CONSTRAINT fk_qa_model_ext
    FOREIGN KEY (model_external_id)
    REFERENCES staging_plant.models(id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED,

  CONSTRAINT fk_qa_model_int
    FOREIGN KEY (model_internal_id)
    REFERENCES staging_plant.models(id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED,

  CONSTRAINT fk_qa_session
    FOREIGN KEY (session_id)
    REFERENCES staging_plant.sessions(id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS staging_plant.quality_analysis_lots (
  quality_analysis_id  TEXT NOT NULL,
  lot_id               TEXT NOT NULL,
  ingested_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (quality_analysis_id, lot_id),
  CONSTRAINT fk_qal_qa
    FOREIGN KEY (quality_analysis_id)
    REFERENCES staging_plant.quality_analyses(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT fk_qal_lot
    FOREIGN KEY (lot_id)
    REFERENCES staging_plant.lots(id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS staging_plant.quality_classifications (
  id                               TEXT PRIMARY KEY,
  quality_analysis_id              TEXT NOT NULL,
  iteration_index                  INTEGER NOT NULL CHECK (iteration_index BETWEEN 0 AND 3),

  external_raw_photo_uri           TEXT NOT NULL,

  internal_raw_photo_uri           TEXT,
  internal_segmented_photo_uri     TEXT,
  internal_ai_class_name           TEXT,
  internal_ai_confidence           double precision CHECK (
                                      internal_ai_confidence IS NULL
                                      OR (internal_ai_confidence >= 0 AND internal_ai_confidence <= 1)
                                    ),
  internal_ai_raw_confidences_json jsonb,

  internal_hf_is_correct           BOOLEAN,
  internal_hf_corrected_class_name TEXT,
  internal_hf_observation          TEXT,

  ingested_at                      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_qc_iteration UNIQUE (quality_analysis_id, iteration_index),

  CONSTRAINT fk_qc_qa
    FOREIGN KEY (quality_analysis_id)
    REFERENCES staging_plant.quality_analyses(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS staging_plant.classified_segments (
  id                        TEXT PRIMARY KEY,
  quality_classification_id TEXT NOT NULL,
  uri                       TEXT NOT NULL,
  best_class_name           TEXT NOT NULL,
  best_confidence           double precision NOT NULL CHECK (best_confidence >= 0 AND best_confidence <= 1),
  confidences_json          jsonb NOT NULL,
  ingested_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quality_classification_id, uri),
  CONSTRAINT fk_cs_qc
    FOREIGN KEY (quality_classification_id)
    REFERENCES staging_plant.quality_classifications(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED
);

-- =============================================================================
-- SECTION 3: INDEXES (mínimos)
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_qa_created_at
  ON staging_plant.quality_analyses (creation_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_qa_truck_plate
  ON staging_plant.quality_analyses (truck_plate);

CREATE INDEX IF NOT EXISTS idx_qal_lot
  ON staging_plant.quality_analysis_lots (lot_id);

CREATE INDEX IF NOT EXISTS idx_qc_analysis_idx
  ON staging_plant.quality_classifications (quality_analysis_id, iteration_index);

CREATE INDEX IF NOT EXISTS idx_cs_classification
  ON staging_plant.classified_segments (quality_classification_id);

CREATE INDEX IF NOT EXISTS idx_lots_program
  ON staging_plant.lots (program_id);
