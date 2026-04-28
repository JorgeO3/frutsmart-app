-- =============================================================================
-- Plant App Quality Assurance Database Schema
-- =============================================================================

-- =============================================================================
-- SECTION 1: CATALOG TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS models (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    version_tag TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('detection', 'external_classification', 'internal_classification')),
    UNIQUE(name, version_tag)
);

CREATE TABLE IF NOT EXISTS programs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    external_id TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS lots (
    id TEXT PRIMARY KEY,
    external_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL, -- Uniqueness is now per-program, see index below
    program_id TEXT NOT NULL,
    FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    start_timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    end_timestamp TEXT
);

-- =============================================================================
-- SECTION 2: CORE AND SUPPORTING TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS quality_analyses (
    id TEXT PRIMARY KEY,
    creation_timestamp TEXT NOT NULL,
    session_id TEXT,
    
    -- Provider information and traceability
    provider TEXT NOT NULL CHECK (provider IN ('own', 'third-party')),
    qr_code TEXT,
    truck_plate TEXT NOT NULL,
    consecutive_number TEXT NOT NULL,
    
    -- Own provider specifics
    program_id TEXT,
    
    -- Third-party provider specifics
    vendor TEXT,
    sub_vendor TEXT,
    
    -- Device metadata
    device_time_of_day TEXT NOT NULL CHECK (device_time_of_day IN ('day', 'night')),
    device_weather TEXT NOT NULL,
    device_has_internet INTEGER NOT NULL CHECK (device_has_internet IN (0, 1)),
    geo_latitude REAL NOT NULL CHECK (geo_latitude BETWEEN -90 AND 90),
    geo_longitude REAL NOT NULL CHECK (geo_longitude BETWEEN -180 AND 180),
    
    -- AI model version tracking
    model_detection_id TEXT,
    model_external_id TEXT,
    model_internal_id TEXT,
    
    -- Harvest criteria values
    criteria_rb REAL,
    criteria_rv REAL,
    criteria_rsm REAL,
    criteria_rmf REAL,
    criteria_rpl REAL,
    criteria_pas REAL,
    criteria_vac REAL,
    
    -- Analysis summaries stored as JSON
    external_summary_json TEXT CHECK (external_summary_json IS NULL OR json_valid(external_summary_json)),
    internal_summary_json TEXT CHECK (internal_summary_json IS NULL OR json_valid(internal_summary_json)),
    
    -- Finalization flag to control immutability and trigger execution
    is_finalized INTEGER NOT NULL DEFAULT 0 CHECK (is_finalized IN (0, 1)),
    
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL,
    FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE RESTRICT,
    FOREIGN KEY (model_detection_id) REFERENCES models(id) ON DELETE SET NULL,
    FOREIGN KEY (model_external_id) REFERENCES models(id) ON DELETE SET NULL,
    FOREIGN KEY (model_internal_id) REFERENCES models(id) ON DELETE SET NULL,
    
    CHECK (
        (provider = 'own' AND vendor IS NULL AND sub_vendor IS NULL AND program_id IS NOT NULL) OR
        (provider = 'third-party' AND vendor IS NOT NULL AND sub_vendor IS NOT NULL AND program_id IS NULL)
    )
);

CREATE TABLE IF NOT EXISTS quality_analysis_lots (
    quality_analysis_id TEXT NOT NULL,
    lot_id TEXT NOT NULL,
    PRIMARY KEY (quality_analysis_id, lot_id),
    FOREIGN KEY (quality_analysis_id) REFERENCES quality_analyses(id) ON DELETE CASCADE,
    FOREIGN KEY (lot_id) REFERENCES lots(id) ON DELETE RESTRICT
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS quality_classifications (
    id TEXT PRIMARY KEY,
    quality_analysis_id TEXT NOT NULL,
    iteration_index INTEGER NOT NULL CHECK (iteration_index BETWEEN 0 AND 3),
    
    -- External classification data
    external_raw_photo_uri TEXT NOT NULL,
    -- classified_segments are mapped in the classified_segments table

    -- Internal classification data
    internal_raw_photo_uri TEXT,
    internal_segmented_photo_uri TEXT,
    internal_ai_class_name TEXT,
    internal_ai_confidence REAL CHECK (internal_ai_confidence IS NULL OR (internal_ai_confidence >= 0 AND internal_ai_confidence <= 1)),
    internal_ai_raw_confidences_json TEXT CHECK (internal_ai_raw_confidences_json IS NULL OR json_valid(internal_ai_raw_confidences_json)),
    
    -- Human feedback on internal classification
    internal_hf_is_correct INTEGER CHECK (internal_hf_is_correct IS NULL OR internal_hf_is_correct IN (0, 1)),
    internal_hf_corrected_class_name TEXT,
    internal_hf_observation TEXT,
    
    UNIQUE (quality_analysis_id, iteration_index),
    FOREIGN KEY (quality_analysis_id) REFERENCES quality_analyses(id) ON DELETE CASCADE,
    
    -- Iteration 3 constraint: internal data must be null
    CHECK (
        iteration_index != 3 OR (
            internal_raw_photo_uri IS NULL AND internal_ai_class_name IS NULL AND
            internal_ai_confidence IS NULL AND internal_ai_raw_confidences_json IS NULL AND
            internal_hf_is_correct IS NULL AND internal_hf_corrected_class_name IS NULL AND
            internal_hf_observation IS NULL
        )
    )
);

CREATE TABLE IF NOT EXISTS classified_segments (
    id TEXT PRIMARY KEY,
    quality_classification_id TEXT NOT NULL,
    uri TEXT NOT NULL,
    best_class_name TEXT NOT NULL,
    best_confidence REAL NOT NULL CHECK (best_confidence >= 0 AND best_confidence <= 1),
    confidences_json TEXT NOT NULL CHECK (json_valid(confidences_json)),
    UNIQUE (quality_classification_id, uri),
    FOREIGN KEY (quality_classification_id) REFERENCES quality_classifications(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    quality_analysis_id TEXT NOT NULL UNIQUE,
    report_date TEXT NOT NULL,
    report_id TEXT NOT NULL UNIQUE,  -- A user-friendly, unique identifier for the report.
    FOREIGN KEY (quality_analysis_id) REFERENCES quality_analyses(id) ON DELETE CASCADE
);

-- ============================================================================
-- SECTION 3: Upload Jobs - pipeline resiliente de subida hacia el backend
-- ============================================================================

CREATE TABLE IF NOT EXISTS upload_jobs (
    -- Identificador local del job (UUID v4 en texto)
    id TEXT PRIMARY KEY,

    -- Opcional: vincular el job con un análisis local concreto
    quality_analysis_id TEXT,
    
    -- Dominio de la subida (se alinea con UploadDomain del backend)
    domain TEXT NOT NULL CHECK (domain IN ('plant', 'field')),

    -- Batch ID que se enviará como CreateUploadSessionDto.clientBatchId
    client_batch_id TEXT NOT NULL,

    -- ID de core.upload_sessions.id (UUID del backend) cuando el create() tuvo éxito
    backend_session_id TEXT,

    -- ID de sesión usado internamente por Skybolt (sessionId que le pasas al módulo nativo)
    skybolt_session_id TEXT,

    -- Paso actual del pipeline de backend
    -- create_session   -> POST /upload/sessions
    -- upload           -> subida binaria vía Skybolt + SAS
    -- complete_session -> POST /upload/sessions/:id/complete
    -- evaluation       -> POST /evaluations
    -- done             -> todo el pipeline terminó bien
    pipeline_step TEXT NOT NULL CHECK (
        pipeline_step IN ('create_session', 'upload', 'complete_session', 'evaluation', 'done')
    ),

    -- Estado del paso actual
    -- pending -> aún no se ha intentado
    -- running -> intento en curso
    -- success -> paso completado con éxito
    -- failed  -> último intento falló (se puede reintentar según tu lógica)
    step_status TEXT NOT NULL CHECK (
        step_status IN ('pending', 'running', 'success', 'failed')
    ),

    -- Métricas agregadas para mostrar en la UI de “Uploads”
    total_files     INTEGER NOT NULL DEFAULT 0,
    completed_files INTEGER NOT NULL DEFAULT 0,
    total_bytes     INTEGER NOT NULL DEFAULT 0,
    uploaded_bytes  INTEGER NOT NULL DEFAULT 0,

    -- Información para diagnósticos y backoff
    last_error     TEXT,
    attempts_count INTEGER NOT NULL DEFAULT 0,
    last_attempt_at TEXT,  -- ISO-8601 en texto (ej: 2025-11-23T08:30:00Z)

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (quality_analysis_id)
        REFERENCES quality_analyses(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_upload_jobs_step_status
    ON upload_jobs(pipeline_step, step_status);

CREATE INDEX IF NOT EXISTS idx_upload_jobs_quality_analysis
    ON upload_jobs(quality_analysis_id);

-- =============================================================================
-- SECTION 4: TRIGGERS (FTS, Finalization & Immutability)
-- =============================================================================

CREATE VIRTUAL TABLE IF NOT EXISTS programs_fts USING fts5(
    id UNINDEXED, name, content='programs', content_rowid='rowid'
);
CREATE TRIGGER IF NOT EXISTS trg_programs_after_insert AFTER INSERT ON programs BEGIN INSERT INTO programs_fts(rowid, id, name) VALUES (new.rowid, new.id, new.name); END;
CREATE TRIGGER IF NOT EXISTS trg_programs_after_delete AFTER DELETE ON programs BEGIN INSERT INTO programs_fts(programs_fts, rowid, id, name) VALUES ('delete', old.rowid, old.id, old.name); END;
CREATE TRIGGER IF NOT EXISTS trg_programs_after_update AFTER UPDATE ON programs BEGIN INSERT INTO programs_fts(programs_fts, rowid, id, name) VALUES ('delete', old.rowid, old.id, old.name); INSERT INTO programs_fts(rowid, id, name) VALUES (new.rowid, new.id, new.name); END;

CREATE VIRTUAL TABLE IF NOT EXISTS lots_fts USING fts5(
    id UNINDEXED, name, content='lots', content_rowid='rowid'
);
CREATE TRIGGER IF NOT EXISTS trg_lots_after_insert AFTER INSERT ON lots BEGIN INSERT INTO lots_fts(rowid, id, name) VALUES (new.rowid, new.id, new.name); END;
CREATE TRIGGER IF NOT EXISTS trg_lots_after_delete AFTER DELETE ON lots BEGIN INSERT INTO lots_fts(lots_fts, rowid, id, name) VALUES ('delete', old.rowid, old.id, old.name); END;
CREATE TRIGGER IF NOT EXISTS trg_lots_after_update AFTER UPDATE ON lots BEGIN INSERT INTO lots_fts(lots_fts, rowid, id, name) VALUES ('delete', old.rowid, old.id, old.name); INSERT INTO lots_fts(rowid, id, name) VALUES (new.rowid, new.id, new.name); END;

-- "Guardian" Trigger: Validates the entire analysis and creates the report upon finalization.
CREATE TRIGGER IF NOT EXISTS trg_finalize_analysis
AFTER UPDATE OF is_finalized ON quality_analyses
FOR EACH ROW
WHEN NEW.is_finalized = 1 AND OLD.is_finalized = 0
BEGIN
    -- 1. Validate iteration count
    SELECT CASE WHEN (SELECT COUNT(*) FROM quality_classifications WHERE quality_analysis_id = NEW.id) <> 4
        THEN RAISE(ABORT, 'Exactly 4 classification iterations are required.') END;
    
    -- 2. Validate lots based on provider type
    SELECT CASE
        WHEN NEW.provider = 'own' AND NOT EXISTS (SELECT 1 FROM quality_analysis_lots WHERE quality_analysis_id = NEW.id)
            THEN RAISE(ABORT, 'An ''own'' provider analysis requires at least one lot.')
        WHEN NEW.provider = 'third-party' AND EXISTS (SELECT 1 FROM quality_analysis_lots WHERE quality_analysis_id = NEW.id)
            THEN RAISE(ABORT, 'A ''third-party'' provider analysis cannot have lots.')
    END;

    -- 3. Validate model types (if they are set)
    SELECT CASE WHEN NEW.model_detection_id IS NOT NULL AND (SELECT type FROM models WHERE id = NEW.model_detection_id) <> 'detection'
        THEN RAISE(ABORT, 'model_detection_id must reference a detection model') END;
    SELECT CASE WHEN NEW.model_external_id IS NOT NULL AND (SELECT type FROM models WHERE id = NEW.model_external_id) <> 'external_classification'
        THEN RAISE(ABORT, 'model_external_id must reference an external_classification model') END;
    SELECT CASE WHEN NEW.model_internal_id IS NOT NULL AND (SELECT type FROM models WHERE id = NEW.model_internal_id) <> 'internal_classification'
        THEN RAISE(ABORT, 'model_internal_id must reference an internal_classification model') END;

    -- 4. If all validations pass, create the report.
    INSERT INTO reports(id, quality_analysis_id, report_date, report_id) VALUES (
        lower(hex(randomblob(16))), NEW.id, date(NEW.creation_timestamp),
        'ID-' || substr(replace(date(NEW.creation_timestamp),'-',''),3) || '-' || lower(hex(randomblob(4)))
    );
END;

-- Immutability Triggers: Block changes to finalized records.
CREATE TRIGGER IF NOT EXISTS trg_block_qa_update AFTER UPDATE ON quality_analyses FOR EACH ROW WHEN OLD.is_finalized = 1 BEGIN SELECT RAISE(ABORT, 'Cannot modify a finalized analysis.'); END;
CREATE TRIGGER IF NOT EXISTS trg_block_qa_delete AFTER DELETE ON quality_analyses FOR EACH ROW WHEN OLD.is_finalized = 1 BEGIN SELECT RAISE(ABORT, 'Cannot delete a finalized analysis.'); END;
CREATE TRIGGER IF NOT EXISTS trg_block_qal_insert AFTER INSERT ON quality_analysis_lots FOR EACH ROW WHEN (SELECT is_finalized FROM quality_analyses WHERE id = NEW.quality_analysis_id) = 1 BEGIN SELECT RAISE(ABORT, 'Cannot add lots to a finalized analysis.'); END;

-- =============================================================================
-- SECTION 5: PERFORMANCE INDEXES
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_lot_name_in_program ON lots(program_id, name);
CREATE INDEX IF NOT EXISTS idx_qa_session_time ON quality_analyses(session_id, creation_timestamp);
CREATE INDEX IF NOT EXISTS idx_qa_created_at ON quality_analyses(creation_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_qa_truck_plate ON quality_analyses(truck_plate);
CREATE INDEX IF NOT EXISTS idx_qal_lot ON quality_analysis_lots(lot_id);
CREATE INDEX IF NOT EXISTS idx_qc_analysis_idx ON quality_classifications(quality_analysis_id, iteration_index);
CREATE INDEX IF NOT EXISTS idx_cs_classification ON classified_segments(quality_classification_id);
CREATE INDEX IF NOT EXISTS idx_reports_quality_analysis_id ON reports(quality_analysis_id);
CREATE INDEX IF NOT EXISTS idx_lots_program ON lots(program_id);