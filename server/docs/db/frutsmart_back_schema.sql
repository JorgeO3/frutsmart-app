-- =============================================================================
-- FrutSmart Back - Esquema Unificado (Versión Final con Índices y Checks)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS core;

-- =============================================================================
-- ENUMs
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'upload_session_status') THEN
    CREATE TYPE core.upload_session_status AS ENUM ('OPEN','COMPLETED','FAILED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'upload_domain') THEN
    CREATE TYPE core.upload_domain AS ENUM ('plant','field');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'upload_item_status') THEN
    CREATE TYPE core.upload_item_status AS ENUM ('PENDING','IN_PROGRESS','UPLOADED','VERIFIED','INCOMPLETE','FAILED','ABORTED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'storage_provider') THEN
    CREATE TYPE core.storage_provider AS ENUM ('azure','s3','gcs');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'evaluation_type') THEN
    CREATE TYPE core.evaluation_type AS ENUM ('PLANT_ANALYSIS', 'FIELD_EVENT');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'provider_kind') THEN
    CREATE TYPE core.provider_kind AS ENUM ('own','third-party');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'classification_kind') THEN
    CREATE TYPE core.classification_kind AS ENUM ('external','internal');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'photo_role') THEN
    CREATE TYPE core.photo_role AS ENUM ('raw','segmented','cropped');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'model_kind') THEN
    CREATE TYPE core.model_kind AS ENUM ('detection','external_classification','internal_classification');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'time_of_day') THEN
    CREATE TYPE core.time_of_day AS ENUM ('day','night');
  END IF;
END$$;

-- =============================================================================
-- 1) Manifiesto de Uploads
-- =============================================================================
CREATE TABLE IF NOT EXISTS core.upload_sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_batch_id  uuid NOT NULL,
  user_id          uuid,
  domain           core.upload_domain NOT NULL,
  status           core.upload_session_status NOT NULL DEFAULT 'OPEN',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_open_session_by_client_batch_open
  ON core.upload_sessions (domain, client_batch_id)
  WHERE status = 'OPEN'::core.upload_session_status;

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
);

-- =============================================================================
-- 2) Catálogos
-- =============================================================================
CREATE TABLE IF NOT EXISTS core.models (
  id           uuid PRIMARY KEY,
  name         text NOT NULL,
  version_tag  text NOT NULL,
  type         core.model_kind NOT NULL,
  UNIQUE (name, version_tag)
);

CREATE TABLE IF NOT EXISTS core.programs (
  id   uuid PRIMARY KEY,
  name text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS core.lots (
  id         uuid PRIMARY KEY,
  name       text NOT NULL,
  program_id uuid NOT NULL REFERENCES core.programs(id) ON DELETE RESTRICT,
  UNIQUE (program_id, name)
);

CREATE TABLE IF NOT EXISTS core.centers (
  id     uuid PRIMARY KEY,
  name   text NOT NULL,
  lot_id uuid NOT NULL REFERENCES core.lots(id) ON DELETE RESTRICT,
  UNIQUE (lot_id, name)
);

CREATE TABLE IF NOT EXISTS core.providers (
  id   uuid PRIMARY KEY,
  name text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS core.sub_providers (
  id          uuid PRIMARY KEY,
  name        text NOT NULL,
  provider_id uuid NOT NULL REFERENCES core.providers(id) ON DELETE RESTRICT,
  UNIQUE (provider_id, name)
);

-- =============================================================================
-- 3) Lógica de Negocio Unificada
-- =============================================================================
CREATE TABLE IF NOT EXISTS core.evaluations (
  id                   uuid PRIMARY KEY,
  upload_session_id    uuid REFERENCES core.upload_sessions(id) ON DELETE CASCADE, -- << cascada a evaluación
  type                 core.evaluation_type NOT NULL,
  creation_timestamp   timestamptz NOT NULL,
  is_finalized         boolean NOT NULL DEFAULT false,
  qr_code              text,
  provider_kind        core.provider_kind, -- NULL en FIELD_EVENT; 'own'/'third-party' en PLANT_ANALYSIS
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
);

CREATE TABLE IF NOT EXISTS core.evaluation_lots (
  evaluation_id uuid NOT NULL REFERENCES core.evaluations(id) ON DELETE CASCADE,
  lot_id        uuid NOT NULL REFERENCES core.lots(id) ON DELETE RESTRICT,
  PRIMARY KEY (evaluation_id, lot_id)
);

CREATE TABLE IF NOT EXISTS core.classification_steps (
  id              uuid PRIMARY KEY,
  evaluation_id   uuid NOT NULL REFERENCES core.evaluations(id) ON DELETE CASCADE,
  kind            core.classification_kind NOT NULL,
  iteration_index integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (evaluation_id, kind, iteration_index),
  CONSTRAINT ck_iteration_index_range CHECK (iteration_index BETWEEN 0 AND 3)
);

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
);

CREATE TABLE IF NOT EXISTS core.photos (
  id             uuid PRIMARY KEY,
  step_id        uuid NOT NULL REFERENCES core.classification_steps(id) ON DELETE CASCADE,
  role           core.photo_role NOT NULL,
  upload_item_id uuid NOT NULL REFERENCES core.upload_items(id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (step_id, upload_item_id)
);

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
);

-- =============================================================================
-- 4) Triggers, Funciones e Índices
-- =============================================================================

-- updated_at automáticos
CREATE OR REPLACE FUNCTION core.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_upload_items_updated_at ON core.upload_items;
CREATE TRIGGER trg_upload_items_updated_at
BEFORE UPDATE ON core.upload_items
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

DROP TRIGGER IF EXISTS trg_upload_sessions_updated_at ON core.upload_sessions;
CREATE TRIGGER trg_upload_sessions_updated_at
BEFORE UPDATE ON core.upload_sessions
FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

-- =========================
-- Constraint triggers clave
-- =========================

-- (A) No se puede COMPLETAR una sesión si al COMMIT aún hay ítems no VERIFIED
--     (validación diferida: se ejecuta al COMMIT; el orden de flush del ORM no importa)

-- Limpieza de verificación previa, si existía
DROP TRIGGER IF EXISTS trg_ck_upload_session_complete ON core.upload_sessions;
DROP FUNCTION IF EXISTS core.assert_session_can_complete();

-- Nueva función: verificación de completitud (al COMMIT vía constraint trigger DEFERRED)
CREATE OR REPLACE FUNCTION core.ensure_session_completable()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'COMPLETED'::core.upload_session_status
     AND (OLD.status IS DISTINCT FROM 'COMPLETED'::core.upload_session_status) THEN

    -- Debe existir al menos 1 ítem vinculado
    IF NOT EXISTS (
      SELECT 1
      FROM core.upload_items i
      WHERE i.session_id = NEW.id
    ) THEN
      RAISE EXCEPTION
        'Cannot COMPLETE upload_session % with 0 items',
        NEW.id
        USING ERRCODE='23514';
    END IF;

    -- Todos los ítems deben estar VERIFIED (ajusta aquí si quieres permitir UPLOADED)
    IF EXISTS (
      SELECT 1
      FROM core.upload_items i
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

-- Constraint trigger diferible: se evalúa AL COMMIT
CREATE CONSTRAINT TRIGGER trg_ck_upload_session_complete
AFTER UPDATE OF status ON core.upload_sessions
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION core.ensure_session_completable();

-- (B) Evaluación requiere sesión COMPLETED (si referencia upload_session_id)
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ck_eval_requires_completed_session ON core.evaluations;
CREATE CONSTRAINT TRIGGER trg_ck_eval_requires_completed_session
AFTER INSERT OR UPDATE ON core.evaluations
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION core.assert_eval_session_completed();

-- (C) PLANT_ANALYSIS + own => requiere al menos un evaluation_lot
CREATE OR REPLACE FUNCTION core.assert_eval_own_has_lots()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.type = 'PLANT_ANALYSIS' AND NEW.provider_kind = 'own') THEN
    PERFORM 1 FROM core.evaluation_lots WHERE evaluation_id = NEW.id;
    IF NOT FOUND THEN
      RAISE EXCEPTION
        'evaluation_lots required when type=PLANT_ANALYSIS and provider_kind=own (evaluation_id=%)',
        NEW.id USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ck_eval_own_has_lots ON core.evaluations;
CREATE CONSTRAINT TRIGGER trg_ck_eval_own_has_lots
AFTER INSERT OR UPDATE ON core.evaluations
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION core.assert_eval_own_has_lots();

-- =============================================================================
-- Índices
-- =============================================================================

-- Uploads
CREATE INDEX IF NOT EXISTS idx_session_by_client_batch   ON core.upload_sessions(client_batch_id);
CREATE INDEX IF NOT EXISTS idx_session_by_user           ON core.upload_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_session_status            ON core.upload_sessions(status);

CREATE INDEX IF NOT EXISTS idx_upload_items_status       ON core.upload_items(status);
CREATE INDEX IF NOT EXISTS idx_upload_items_session_id   ON core.upload_items(session_id);

-- Catálogos
CREATE INDEX IF NOT EXISTS idx_lots_program_id           ON core.lots(program_id);
CREATE INDEX IF NOT EXISTS idx_centers_lot_id            ON core.centers(lot_id);

-- Evaluations
CREATE INDEX IF NOT EXISTS idx_evaluations_upload_session_id ON core.evaluations(upload_session_id) WHERE upload_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_evaluations_type_timestamp    ON core.evaluations(type, creation_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_evaluations_truck_plate       ON core.evaluations(truck_plate);
CREATE INDEX IF NOT EXISTS idx_evaluations_program_id        ON core.evaluations(program_id) WHERE program_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_evaluations_lot_id            ON core.evaluations(lot_id) WHERE lot_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_evaluations_center_id         ON core.evaluations(center_id) WHERE center_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_evaluations_provider_id       ON core.evaluations(provider_id) WHERE provider_id IS NOT NULL;

-- Evaluation lots
CREATE INDEX IF NOT EXISTS idx_evaluation_lots_lot_id        ON core.evaluation_lots(lot_id);

-- Steps / Results / Artefacts
CREATE INDEX IF NOT EXISTS idx_classification_steps_evaluation_id ON core.classification_steps(evaluation_id);

CREATE INDEX IF NOT EXISTS idx_photos_step_id                 ON core.photos(step_id);
CREATE INDEX IF NOT EXISTS idx_photos_upload_item_id          ON core.photos(upload_item_id);

CREATE INDEX IF NOT EXISTS idx_classified_segments_step_id        ON core.classified_segments(step_id);
CREATE INDEX IF NOT EXISTS idx_classified_segments_upload_item_id ON core.classified_segments(upload_item_id);
