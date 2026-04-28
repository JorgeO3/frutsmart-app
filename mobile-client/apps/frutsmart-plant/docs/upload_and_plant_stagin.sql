-- ============================================================================
-- CORE: esquema de sesiones de subida y manifest
-- Relaciona 1..N items (archivos) con una sesión. Los staging referencian
-- opcionalmente upload_items.id para trazabilidad y verificación.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS core;

-- Enums de estado
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'upload_session_status' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'core')) THEN
    CREATE TYPE core.upload_session_status AS ENUM ('OPEN','COMPLETED','FAILED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'upload_item_status' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'core')) THEN
    CREATE TYPE core.upload_item_status AS ENUM ('PENDING','IN_PROGRESS','UPLOADED','VERIFIED','INCOMPLETE');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'upload_domain' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'core')) THEN
    CREATE TYPE core.upload_domain AS ENUM ('plant','field');
  END IF;
END$$;

-- Sesión de subida (fuente de verdad del batch)
CREATE TABLE IF NOT EXISTS core.upload_sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain           core.upload_domain NOT NULL,                      -- 'plant' | 'field'
  client_batch_id  text,                                             -- idempotencia cliente (opcional)
  user_id          text,                                             -- si aplicas auth
  device_id        text,                                             -- identificación del dispositivo
  status           core.upload_session_status NOT NULL DEFAULT 'OPEN',
  created_at       timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz,                                      -- limpieza/retención
  UNIQUE (domain, client_batch_id)                                   -- idempotencia por dominio
);

-- Items (un archivo por fila) - manifest
CREATE TABLE IF NOT EXISTS core.upload_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     uuid NOT NULL,
  client_id      text NOT NULL,                                      -- id local del archivo (cliente)
  -- Referencia canónica al blob (asignada por el backend al crear la sesión)
  blob_container text NOT NULL,
  blob_name      text NOT NULL,                                      -- p.ej. 'planta/external/raw/2025/09/25/uuid.jpg'
  -- Metadatos declarados por el cliente (y verificados en /complete)
  content_type   text,
  size_bytes     bigint,
  sha256         text,                                               -- hex (64)
  status         core.upload_item_status NOT NULL DEFAULT 'PENDING',
  last_error     text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_upload_item_session
    FOREIGN KEY (session_id) REFERENCES core.upload_sessions(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT uq_item_by_session_client UNIQUE (session_id, client_id),
  CONSTRAINT uq_item_by_blob UNIQUE (blob_container, blob_name)       -- cada blob lógico 1 vez en manifest
);

-- Trigger simple para updated_at
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

-- Índices útiles
CREATE INDEX IF NOT EXISTS idx_upload_items_session ON core.upload_items(session_id);
CREATE INDEX IF NOT EXISTS idx_upload_items_status  ON core.upload_items(status);
CREATE INDEX IF NOT EXISTS idx_upload_items_blob    ON core.upload_items(blob_container, blob_name);


-- ============================================================================
-- STAGING_PLANT: esquema de ingesta para Flujo de Planta (sin URIs)
-- Reemplaza URIs por metadatos de blob y (opcional) FK a core.upload_items.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS staging_plant;

-- Enums de catálogo
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'model_kind' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'staging_plant')) THEN
    CREATE TYPE staging_plant.model_kind AS ENUM ('detection','external_classification','internal_classification');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'provider_kind' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'staging_plant')) THEN
    CREATE TYPE staging_plant.provider_kind AS ENUM ('own','third-party');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'time_of_day' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'staging_plant')) THEN
    CREATE TYPE staging_plant.time_of_day AS ENUM ('day','night');
  END IF;
END$$;

-- Catálogo: modelos
CREATE TABLE IF NOT EXISTS staging_plant.models (
  id           text PRIMARY KEY,
  name         text NOT NULL,
  version_tag  text NOT NULL,
  type         staging_plant.model_kind NOT NULL,
  UNIQUE (name, version_tag)
);

-- Catálogo: programas
CREATE TABLE IF NOT EXISTS staging_plant.programs (
  id           text PRIMARY KEY,
  name         text NOT NULL,
  external_id  text NOT NULL UNIQUE,
  ingested_at  timestamptz NOT NULL DEFAULT now()
);

-- Catálogo: lotes (por programa)
CREATE TABLE IF NOT EXISTS staging_plant.lots (
  id           text PRIMARY KEY,
  external_id  text NOT NULL UNIQUE,
  name         text NOT NULL,
  program_id   text NOT NULL,
  ingested_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_lots_program
    FOREIGN KEY (program_id) REFERENCES staging_plant.programs(id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT uq_lot_name_in_program UNIQUE (program_id, name)
);

-- (Opcional) Catálogos de proveedor/subproveedor si aplican en tu operación
CREATE TABLE IF NOT EXISTS staging_plant.providers (
  id   text PRIMARY KEY,
  name text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS staging_plant.sub_providers (
  id           text PRIMARY KEY,
  name         text NOT NULL,
  provider_id  text NOT NULL,
  CONSTRAINT fk_subprov_provider
    FOREIGN KEY (provider_id) REFERENCES staging_plant.providers(id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  UNIQUE (provider_id, name)
);

-- Sesiones de negocio (agrupan análisis del día/jornada)
CREATE TABLE IF NOT EXISTS staging_plant.sessions (
  id              text PRIMARY KEY,
  start_timestamp timestamptz NOT NULL,
  end_timestamp   timestamptz,
  ingested_at     timestamptz NOT NULL DEFAULT now()
);

-- Análisis (cabecera)
CREATE TABLE IF NOT EXISTS staging_plant.quality_analyses (
  id                   text PRIMARY KEY,
  creation_timestamp   timestamptz NOT NULL,
  session_id           text,                                        -- FK a sesión de negocio (opcional)
  provider             staging_plant.provider_kind NOT NULL,        -- sin check compuesto (flexibilizado)

  qr_code              text,
  truck_plate          text NOT NULL,
  consecutive_number   text NOT NULL,

  program_id           text,
  vendor               text,
  sub_vendor           text,

  device_time_of_day   staging_plant.time_of_day NOT NULL,
  device_weather       text NOT NULL,
  device_has_internet  boolean,
  geo_latitude         double precision NOT NULL CHECK (geo_latitude BETWEEN -90 AND 90),
  geo_longitude        double precision NOT NULL CHECK (geo_longitude BETWEEN -180 AND 180),

  model_detection_id   text,
  model_external_id    text,
  model_internal_id    text,

  criteria_rb          double precision,
  criteria_rv          double precision,
  criteria_rsm         double precision,
  criteria_rmf         double precision,
  criteria_rpl         double precision,
  criteria_pas         double precision,
  criteria_vac         double precision,

  external_summary_json jsonb,
  internal_summary_json jsonb,

  is_finalized         boolean NOT NULL DEFAULT false,
  ingested_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fk_qa_session
    FOREIGN KEY (session_id) REFERENCES staging_plant.sessions(id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED,

  CONSTRAINT fk_qa_program
    FOREIGN KEY (program_id) REFERENCES staging_plant.programs(id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,

  CONSTRAINT fk_qa_model_det
    FOREIGN KEY (model_detection_id) REFERENCES staging_plant.models(id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED,

  CONSTRAINT fk_qa_model_ext
    FOREIGN KEY (model_external_id) REFERENCES staging_plant.models(id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED,

  CONSTRAINT fk_qa_model_int
    FOREIGN KEY (model_internal_id) REFERENCES staging_plant.models(id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED
);

-- Relación análisis ↔ lotes (N:M)
CREATE TABLE IF NOT EXISTS staging_plant.quality_analysis_lots (
  quality_analysis_id  text NOT NULL,
  lot_id               text NOT NULL,
  ingested_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (quality_analysis_id, lot_id),
  CONSTRAINT fk_qal_qa
    FOREIGN KEY (quality_analysis_id) REFERENCES staging_plant.quality_analyses(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT fk_qal_lot
    FOREIGN KEY (lot_id) REFERENCES staging_plant.lots(id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
);

-- Clasificaciones por iteración (0..3)
-- Reemplazo de *_photo_uri → metadatos de blob (+ FK opcional a core.upload_items)
CREATE TABLE IF NOT EXISTS staging_plant.quality_classifications (
  id                                text PRIMARY KEY,
  quality_analysis_id               text NOT NULL,
  iteration_index                   integer NOT NULL CHECK (iteration_index BETWEEN 0 AND 3),

  -- FOTO EXTERNA (raw)
  external_blob_container           text NOT NULL,
  external_blob_name                text NOT NULL,
  external_content_type             text,
  external_file_size_bytes          bigint,
  external_sha256                   text,
  external_upload_item_id           uuid,  -- FK opcional a core.upload_items

  -- FOTO INTERNA (raw)
  internal_raw_blob_container       text,
  internal_raw_blob_name            text,
  internal_raw_content_type         text,
  internal_raw_file_size_bytes      bigint,
  internal_raw_sha256               text,
  internal_raw_upload_item_id       uuid,  -- FK opcional

  -- FOTO INTERNA (segmented)
  internal_seg_blob_container       text,
  internal_seg_blob_name            text,
  internal_seg_content_type         text,
  internal_seg_file_size_bytes      bigint,
  internal_seg_sha256               text,
  internal_seg_upload_item_id       uuid,  -- FK opcional

  -- Resultados de IA + HF (sin checks rígidos para iteración 3)
  internal_ai_class_name            text,
  internal_ai_confidence            double precision CHECK (
                                       internal_ai_confidence IS NULL OR
                                       (internal_ai_confidence >= 0 AND internal_ai_confidence <= 1)
                                     ),
  internal_ai_raw_confidences_json  jsonb,

  internal_hf_is_correct            boolean,
  internal_hf_corrected_class_name  text,
  internal_hf_observation           text,

  ingested_at                       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_qc_iteration UNIQUE (quality_analysis_id, iteration_index),

  CONSTRAINT fk_qc_qa
    FOREIGN KEY (quality_analysis_id) REFERENCES staging_plant.quality_analyses(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  -- FKs opcionales al manifest verificado (core.upload_items)
  CONSTRAINT fk_qc_ext_item
    FOREIGN KEY (external_upload_item_id) REFERENCES core.upload_items(id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED,

  CONSTRAINT fk_qc_int_raw_item
    FOREIGN KEY (internal_raw_upload_item_id) REFERENCES core.upload_items(id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED,

  CONSTRAINT fk_qc_int_seg_item
    FOREIGN KEY (internal_seg_upload_item_id) REFERENCES core.upload_items(id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED
);

-- Segmentos clasificados (cada fila referencia la imagen segmentada o un recorte)
-- Sustituye 'uri' por metadatos de blob + FK opcional a core.upload_items
CREATE TABLE IF NOT EXISTS staging_plant.classified_segments (
  id                           text PRIMARY KEY,
  quality_classification_id    text NOT NULL,

  blob_container               text NOT NULL,
  blob_name                    text NOT NULL,
  content_type                 text,
  file_size_bytes              bigint,
  sha256                       text,
  upload_item_id               uuid,     -- opcional (si el segmento se subió como blob aparte)

  best_class_name              text NOT NULL,
  best_confidence              double precision NOT NULL CHECK (best_confidence >= 0 AND best_confidence <= 1),
  confidences_json             jsonb NOT NULL,

  ingested_at                  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_segment_by_blob UNIQUE (quality_classification_id, blob_container, blob_name),

  CONSTRAINT fk_cs_qc
    FOREIGN KEY (quality_classification_id) REFERENCES staging_plant.quality_classifications(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,

  CONSTRAINT fk_cs_item
    FOREIGN KEY (upload_item_id) REFERENCES core.upload_items(id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED
);

-- Índices recomendados en staging_plant
CREATE INDEX IF NOT EXISTS idx_qa_created_at
  ON staging_plant.quality_analyses (creation_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_qa_truck_plate
  ON staging_plant.quality_analyses (truck_plate);

CREATE INDEX IF NOT EXISTS idx_qal_lot
  ON staging_plant.quality_analysis_lots (lot_id);

CREATE INDEX IF NOT EXISTS idx_qc_analysis_idx
  ON staging_plant.quality_classifications (quality_analysis_id, iteration_index);

CREATE INDEX IF NOT EXISTS idx_qc_external_blob
  ON staging_plant.quality_classifications (external_blob_container, external_blob_name);

CREATE INDEX IF NOT EXISTS idx_qc_internal_seg_blob
  ON staging_plant.quality_classifications (internal_seg_blob_container, internal_seg_blob_name);

CREATE INDEX IF NOT EXISTS idx_cs_qc
  ON staging_plant.classified_segments (quality_classification_id);

CREATE INDEX IF NOT EXISTS idx_cs_blob
  ON staging_plant.classified_segments (blob_container, blob_name);

CREATE INDEX IF NOT EXISTS idx_lots_program
  ON staging_plant.lots (program_id);