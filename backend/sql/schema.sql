-- ================================================================
-- Gym Tracker — Azure SQL Database Schema
-- Run this in Azure Portal > Query editor, or via Azure Data Studio
-- ================================================================

-- Main exercises table
CREATE TABLE exercises (
    id         INT           PRIMARY KEY IDENTITY(1,1),
    name       NVARCHAR(255) NOT NULL,
    date       DATE          NOT NULL,
    sets       INT           NOT NULL DEFAULT 1,
    reps       INT           NULL,
    weight     DECIMAL(10,2) NOT NULL DEFAULT 0,
    unit       NVARCHAR(3)   NOT NULL DEFAULT 'KG',
    notes      NVARCHAR(500) NULL,
    created_at DATETIME2     NOT NULL DEFAULT GETDATE(),
    updated_at DATETIME2     NOT NULL DEFAULT GETDATE(),
    CONSTRAINT CHK_unit   CHECK (unit IN ('KG', 'LBS')),
    CONSTRAINT CHK_sets   CHECK (sets > 0),
    CONSTRAINT CHK_weight CHECK (weight >= 0)
);

-- Index for fast date-range queries (the most common read pattern)
CREATE NONCLUSTERED INDEX IX_exercises_date
    ON exercises (date ASC)
    INCLUDE (name, sets, reps, weight, unit);

-- ── Seed some example data (optional) ─────────────────────────
-- INSERT INTO exercises (name, date, sets, reps, weight, unit)
-- VALUES
--   ('Bench Press',   CAST(GETDATE() AS DATE), 4, 8,  80,  'KG'),
--   ('Squat',         CAST(GETDATE() AS DATE), 4, 6,  100, 'KG'),
--   ('Deadlift',      CAST(GETDATE() AS DATE), 3, 5,  120, 'KG');
