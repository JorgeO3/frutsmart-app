-- =============================================================================
-- SCHEMA: staging_campo (FrutSmart - Campo)
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS staging_campo;

-- =============================================================================
-- ENUMS
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'model_kind') THEN
    CREATE TYPE staging_campo.model_kind AS ENUM (
      'detection','external_classification','internal_classification'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'classification_type') THEN
    CREATE TYPE staging_campo.classification_type AS ENUM ('external','internal');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'photo_type') THEN
    CREATE TYPE staging_campo.photo_type AS ENUM ('cropped','segmented','raw');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'time_of_day') THEN
    CREATE TYPE staging_campo.time_of_day AS ENUM ('day','night');
  END IF;
END$$;

-- =============================================================================
-- CATALOG TABLES
-- =============================================================================
CREATE TABLE IF NOT EXISTS staging_campo.models (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  version_tag  TEXT NOT NULL,
  type         staging_campo.model_kind NOT NULL,
  UNIQUE (name, version_tag)
);

CREATE TABLE IF NOT EXISTS staging_campo.lots (
  id            TEXT PRIMARY KEY,
  external_id   TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL UNIQUE,
  ingested_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS staging_campo.centers (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  lot_id        TEXT NOT NULL,
  ingested_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_centers_lot
    FOREIGN KEY (lot_id)
    REFERENCES staging_campo.lots(id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  UNIQUE (lot_id, name)
);

-- =============================================================================
-- TRANSACTIONAL DATA
-- =============================================================================
CREATE TABLE IF NOT EXISTS staging_campo.quality_classifications (
  quality_classification_id      TEXT PRIMARY KEY,
  creation_timestamp             timestamptz NOT NULL DEFAULT now(),

  -- Trazabilidad
  lot_id                         TEXT NOT NULL,
  center_id                      TEXT NOT NULL,

  -- Device metadata
  device_time_of_day             staging_campo.time_of_day,
  device_weather                 TEXT,
  device_has_internet            BOOLEAN,
  geo_latitude                   double precision,
  geo_longitude                  double precision,

  -- Versionado de modelos
  model_detection_id             TEXT,
  model_external_id              TEXT,
  model_internal_id              TEXT,

  -- Campos de negocio
  harvest_assigned_criterion     TEXT,
  harvest_number_of_applications INTEGER,
  harvest_cluster_weight         double precision,
  harvest_observation            TEXT,

  ingested_at                    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fk_qc_lot
    FOREIGN KEY (lot_id)
    REFERENCES staging_campo.lots(id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,

  CONSTRAINT fk_qc_center
    FOREIGN KEY (center_id)
    REFERENCES staging_campo.centers(id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,

  CONSTRAINT fk_qc_model_detection
    FOREIGN KEY (model_detection_id)
    REFERENCES staging_campo.models(id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,

  CONSTRAINT fk_qc_model_external
    FOREIGN KEY (model_external_id)
    REFERENCES staging_campo.models(id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,

  CONSTRAINT fk_qc_model_internal
    FOREIGN KEY (model_internal_id)
    REFERENCES staging_campo.models(id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS staging_campo.classification_photos (
  id                           TEXT PRIMARY KEY,
  quality_classification_id    TEXT NOT NULL,
  classification_type          staging_campo.classification_type NOT NULL,
  photo_type                   staging_campo.photo_type NOT NULL,
  uri                          TEXT NOT NULL UNIQUE,
  raw_inference_output_json    jsonb,
  ingested_at                  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fk_photos_qc
    FOREIGN KEY (quality_classification_id)
    REFERENCES staging_campo.quality_classifications(quality_classification_id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS staging_campo.classification_results (
  id                              TEXT PRIMARY KEY,
  quality_classification_id       TEXT NOT NULL,
  classification_type             staging_campo.classification_type NOT NULL,
  ai_predicted_class_name         TEXT,
  ai_confidence                   double precision,
  ai_raw_inference_output_json    jsonb,
  human_feedback_is_correct       BOOLEAN,
  human_feedback_corrected_class  TEXT,
  human_feedback_observation      TEXT,
  ingested_at                     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_results_scope UNIQUE (quality_classification_id, classification_type),

  CONSTRAINT fk_results_qc
    FOREIGN KEY (quality_classification_id)
    REFERENCES staging_campo.quality_classifications(quality_classification_id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED
);

-- =============================================================================
-- ÍNDICES (mínimos)
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_qc_lot_center_time
  ON staging_campo.quality_classifications (lot_id, center_id, creation_timestamp);

CREATE INDEX IF NOT EXISTS idx_photos_qc
  ON staging_campo.classification_photos (quality_classification_id);

CREATE INDEX IF NOT EXISTS idx_results_qc
  ON staging_campo.classification_results (quality_classification_id);
