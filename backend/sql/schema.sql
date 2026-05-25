-- ================================================================
-- Gym Tracker — Azure SQL Database Schema (v2 — per-set tracking)
-- Run this in Azure Portal > Query editor, or via Azure Data Studio
--
-- For existing databases, use migrations/001_per_set_tracking.sql
-- instead — that script preserves your data.
-- ================================================================

-- Main exercises table (parent)
CREATE TABLE exercises (
    id         INT           PRIMARY KEY IDENTITY(1,1),
    name       NVARCHAR(255) NOT NULL,
    date       DATE          NOT NULL,
    unit       NVARCHAR(3)   NOT NULL DEFAULT 'KG',
    notes      NVARCHAR(500) NULL,
    created_at DATETIME2     NOT NULL DEFAULT GETDATE(),
    updated_at DATETIME2     NOT NULL DEFAULT GETDATE(),
    CONSTRAINT CHK_unit CHECK (unit IN ('KG', 'LBS'))
);

-- Per-set table (child) — one row per set
CREATE TABLE exercise_sets (
    id          INT           PRIMARY KEY IDENTITY(1,1),
    exercise_id INT           NOT NULL,
    set_number  INT           NOT NULL,
    reps        INT           NULL,
    weight      DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_at  DATETIME2     NOT NULL DEFAULT GETDATE(),

    CONSTRAINT FK_exercise_sets_exercise
        FOREIGN KEY (exercise_id)
        REFERENCES exercises(id)
        ON DELETE CASCADE,

    CONSTRAINT CHK_set_number CHECK (set_number > 0),
    CONSTRAINT CHK_set_weight CHECK (weight >= 0),
    CONSTRAINT UQ_exercise_set UNIQUE (exercise_id, set_number)
);

-- Indexes
CREATE NONCLUSTERED INDEX IX_exercises_date
    ON exercises (date ASC)
    INCLUDE (name, unit);

CREATE NONCLUSTERED INDEX IX_exercise_sets_exercise_id
    ON exercise_sets (exercise_id);