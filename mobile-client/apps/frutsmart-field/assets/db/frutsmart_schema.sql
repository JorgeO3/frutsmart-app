-- =============================================================================
-- SCHEMA: Quality Assurance Database
-- RATIONALE: This schema is designed for a high-performance, offline-first
--            mobile application. It prioritizes data integrity, write
--            performance, and query flexibility.
-- =============================================================================


-- =============================================================================
-- PRAGMAS: DATABASE CONFIGURATION
-- =============================================================================
-- NOTE: These settings are crucial for performance and data integrity.
-- They are left here to document how the database should be configured,
-- but they are executed on the React Native side using queries each time
-- the SQLite database is opened with expo-sqlite.

-- Enforces foreign key constraints to maintain relational integrity.
-- PRAGMA foreign_keys = ON;

-- Recommended for mobile apps to improve concurrency and reduce write contention.
-- PRAGMA journal_mode = WAL;

-- A balanced approach for WAL mode, ensuring safety without sacrificing too much performance.
-- PRAGMA synchronous = NORMAL;


-- =============================================================================
-- SECTION 1: CATALOG TABLES
-- Purpose: Store core, relatively static entities (the "source of truth").
-- =============================================================================

-- Stores information about AI models used for classification.
CREATE TABLE IF NOT EXISTS models (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,          -- e.g., 'YOLOv11', 'ResNet50'
    version_tag TEXT NOT NULL,   -- e.g., 'v1.1-classifier'
    type TEXT NOT NULL CHECK(type IN ('detection', 'external_classification', 'internal_classification')),
    UNIQUE(name, version_tag)
);

-- Stores information about agricultural lots.
CREATE TABLE IF NOT EXISTS lots (
    id TEXT PRIMARY KEY,              -- Internal UUID for the lot.
    external_id TEXT NOT NULL UNIQUE, -- User-facing identifier, e.g., 'LOT-12345'.
    name TEXT NOT NULL UNIQUE         -- Descriptive name, e.g., 'Lot 12345'.
);

-- Stores production centers, which belong to a specific lot.
CREATE TABLE IF NOT EXISTS centers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    lot_id TEXT NOT NULL,
    FOREIGN KEY (lot_id) REFERENCES lots(id) ON DELETE RESTRICT -- Prevents deleting a lot if it still has centers.
);


-- =============================================================================
-- SECTION 2: SESSION MANAGEMENT
-- Purpose: Manages user sessions to group related activities.
-- =============================================================================

-- Represents a single user session, starting from when the app is opened.
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,                                     -- UUID for the session, generated in the application layer.
    start_timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, -- Automatically records when the session begins.
    end_timestamp TEXT                                       -- NOTE: This is now updated by the application layer upon session completion.
);


-- =============================================================================
-- SECTION 3: FULL-TEXT SEARCH (FTS)
-- Purpose: Provides high-performance text search capabilities for catalogs.
-- =============================================================================

-- FTS5 virtual table for fast searching of lots.
CREATE VIRTUAL TABLE IF NOT EXISTS lots_fts USING fts5(
    id UNINDEXED, -- The primary key is not indexed by FTS5 to save space.
    name,
    content='lots', -- Links this virtual table to the 'lots' content table.
    content_rowid='rowid'
);

-- FTS5 virtual table for fast searching of centers.
CREATE VIRTUAL TABLE IF NOT EXISTS centers_fts USING fts5(
    id UNINDEXED,
    name,
    lot_id UNINDEXED,
    content='centers',
    content_rowid='rowid'
);


-- =============================================================================
-- SECTION 4: TRANSACTIONAL DATA
-- Purpose: Stores the main operational data recorded by the user.
-- =============================================================================

-- The core table, storing a single quality classification event.
CREATE TABLE IF NOT EXISTS quality_classifications (
    quality_classification_id TEXT PRIMARY KEY,
    creation_timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, -- Automatically records when the classification was created.
    session_id TEXT NOT NULL, -- Links this classification to a specific user session.
    
    -- Traceability Fields
    lot_id TEXT NOT NULL,
    center_id TEXT NOT NULL,
    
    -- Device Metadata
    device_time_of_day TEXT,
    device_weather TEXT,
    device_has_internet INTEGER, -- Stored as 0 (false) or 1 (true).
    geo_latitude REAL,
    geo_longitude REAL,
    
    -- Model Versioning
    model_detection_id TEXT,
    model_external_id TEXT,
    model_internal_id TEXT,

    -- Business-Specific Criteria
    harvest_assigned_criterion TEXT,
    harvest_number_of_applications INTEGER,
    harvest_cluster_weight REAL,
    harvest_observation TEXT,

    -- Foreign Key Constraints
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE RESTRICT,
    FOREIGN KEY (lot_id) REFERENCES lots(id) ON DELETE RESTRICT,
    FOREIGN KEY (center_id) REFERENCES centers(id) ON DELETE RESTRICT,
    FOREIGN KEY (model_detection_id) REFERENCES models(id) ON DELETE RESTRICT,
    FOREIGN KEY (model_external_id) REFERENCES models(id) ON DELETE RESTRICT,
    FOREIGN KEY (model_internal_id) REFERENCES models(id) ON DELETE RESTRICT
);

-- Stores URIs and metadata for photos associated with a classification.
CREATE TABLE IF NOT EXISTS classification_photos (
    id TEXT PRIMARY KEY,
    quality_classification_id TEXT NOT NULL,
    classification_type TEXT NOT NULL CHECK(classification_type IN ('external', 'internal')),
    photo_type TEXT NOT NULL CHECK(photo_type IN ('cropped', 'segmented', 'raw')),
    uri TEXT NOT NULL UNIQUE,
    raw_inference_output_json TEXT, -- TODO: delete this field
    FOREIGN KEY (quality_classification_id) REFERENCES quality_classifications(quality_classification_id) ON DELETE CASCADE -- Photos are deleted if the parent classification is deleted.
);

-- Stores the results of AI predictions and human feedback for a classification.
CREATE TABLE IF NOT EXISTS classification_results (
    id TEXT PRIMARY KEY,
    quality_classification_id TEXT NOT NULL,
    classification_type TEXT NOT NULL CHECK(classification_type IN ('external', 'internal')),
    ai_predicted_class_name TEXT,
    ai_confidence REAL,
    ai_raw_inference_output_json TEXT,
    human_feedback_is_correct INTEGER,
    human_feedback_corrected_class TEXT,
    human_feedback_observation TEXT,
    UNIQUE(quality_classification_id, classification_type), -- Ensures only one result per classification type (e.g., one 'external' and one 'internal').
    FOREIGN KEY (quality_classification_id) REFERENCES quality_classifications(quality_classification_id) ON DELETE CASCADE -- Results are deleted if the parent classification is deleted.
);


-- =============================================================================
-- SECTION 5: REPORTING
-- Purpose: Stores generated reports, one for each session.
-- =============================================================================

-- Stores a single report entry, linked directly to a session.
CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL UNIQUE, -- Ensures one report per session.
    report_date TEXT NOT NULL,       -- The date the report was generated (taken from session start).
    report_id TEXT NOT NULL UNIQUE,  -- A user-friendly, unique identifier for the report.
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE -- If a session is deleted, its corresponding report is also deleted.
);


-- =============================================================================
-- SECTION 6: TRIGGERS
-- Purpose: Automate database logic to ensure consistency and reduce app-layer code.
-- =============================================================================

-- NOTE: This trigger was removed to improve write performance.
-- The 'end_timestamp' in the 'sessions' table is now managed by the application.
DROP TRIGGER IF EXISTS trg_update_session_end_timestamp;

-- Creates a new report entry automatically whenever a new session is started.
CREATE TRIGGER IF NOT EXISTS trg_create_session_report_entry
AFTER INSERT ON sessions
FOR EACH ROW
BEGIN
  INSERT INTO reports(id, session_id, report_date, report_id) VALUES (
    lower(hex(randomblob(16))), -- Generate a new UUID for the report.
    NEW.id, -- Link to the session that was just created.
    date(NEW.start_timestamp), -- Use the start date of the session.
    'ID-' || substr(replace(date(NEW.start_timestamp),'-',''),3) || '-' || upper(substr(hex(abs(random())), -8)) -- Create a human-readable ID.
  );
END;

-- This trigger is a leftover from a previous design and should be removed if it exists.
DROP TRIGGER IF EXISTS trg_create_daily_report_entry;


-- Sub-Section: FTS5 Synchronization Triggers
-- These triggers keep the FTS tables in sync with the content tables.

CREATE TRIGGER IF NOT EXISTS centers_after_insert AFTER INSERT ON centers BEGIN INSERT INTO centers_fts(rowid, id, name, lot_id) VALUES (new.rowid, new.id, new.name, new.lot_id); END;
CREATE TRIGGER IF NOT EXISTS centers_after_delete AFTER DELETE ON centers BEGIN INSERT INTO centers_fts(centers_fts, rowid, id, name, lot_id) VALUES ('delete', old.rowid, old.id, old.name, old.lot_id); END;
CREATE TRIGGER IF NOT EXISTS centers_after_update AFTER UPDATE ON centers BEGIN INSERT INTO centers_fts(centers_fts, rowid, id, name, lot_id) VALUES ('delete', old.rowid, old.id, old.name, old.lot_id); INSERT INTO centers_fts(rowid, id, name, lot_id) VALUES (new.rowid, new.id, new.name, new.lot_id); END;

CREATE TRIGGER IF NOT EXISTS lots_after_insert AFTER INSERT ON lots BEGIN INSERT INTO lots_fts(rowid, id, name) VALUES (new.rowid, new.id, new.name); END;
CREATE TRIGGER IF NOT EXISTS lots_after_delete AFTER DELETE ON lots BEGIN INSERT INTO lots_fts(lots_fts, rowid, id, name) VALUES ('delete', old.rowid, old.id, old.name); END;
CREATE TRIGGER IF NOT EXISTS lots_after_update AFTER UPDATE ON lots BEGIN INSERT INTO lots_fts(lots_fts, rowid, id, name) VALUES ('delete', old.rowid, old.id, old.name); INSERT INTO lots_fts(rowid, id, name) VALUES (new.rowid, new.id, new.name); END;


-- =============================================================================
-- SECTION 7: INDEXES
-- Purpose: Optimize query performance for common access patterns.
-- =============================================================================

-- Speeds up fetching all photos for a given classification.
CREATE INDEX IF NOT EXISTS idx_classification_photos_classification_id ON classification_photos(quality_classification_id);

-- Composite index to efficiently query classifications by lot, center, and time.
CREATE INDEX IF NOT EXISTS idx_quality_classifications_lot_center_time ON quality_classifications(lot_id, center_id, creation_timestamp);

-- Speeds up fetching all classifications belonging to a single session.
CREATE INDEX IF NOT EXISTS idx_quality_classifications_session_id ON quality_classifications(session_id);

-- NOTE: New composite index to optimize fetching classifications for a session, ordered by time.
-- This is a key performance improvement from the expert review.
CREATE INDEX IF NOT EXISTS idx_qc_session_time ON quality_classifications(session_id, creation_timestamp);

-- Speeds up finding a report by its session ID.
CREATE INDEX IF NOT EXISTS idx_reports_session_id ON reports(session_id);