-- ================================================================
-- Migration 001: Per-set tracking
-- 
-- Adds a new exercise_sets table to store individual sets.
-- Migrates existing exercises (1 row -> N set rows based on `sets` value).
-- Drops the now-redundant sets/reps/weight columns from exercises.
--
-- SAFE TO RUN ONCE. Re-running will fail because the new table will
-- already exist and the old columns will already be gone.
-- ================================================================

BEGIN TRANSACTION;

-- ── 1. Create the new exercise_sets table ─────────────────────
CREATE TABLE exercise_sets (
    id           INT           PRIMARY KEY IDENTITY(1,1),
    exercise_id  INT           NOT NULL,
    set_number   INT           NOT NULL,
    reps         INT           NULL,
    weight       DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_at   DATETIME2     NOT NULL DEFAULT GETDATE(),

    CONSTRAINT FK_exercise_sets_exercise
        FOREIGN KEY (exercise_id)
        REFERENCES exercises(id)
        ON DELETE CASCADE,

    CONSTRAINT CHK_set_number CHECK (set_number > 0),
    CONSTRAINT CHK_set_weight CHECK (weight >= 0),
    CONSTRAINT UQ_exercise_set UNIQUE (exercise_id, set_number)
);

CREATE NONCLUSTERED INDEX IX_exercise_sets_exercise_id
    ON exercise_sets (exercise_id);

-- ── 2. Migrate existing data ──────────────────────────────────
;WITH numbers AS (
    SELECT TOP (SELECT ISNULL(MAX(sets), 1) FROM exercises)
           ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS n
    FROM sys.all_objects
)
INSERT INTO exercise_sets (exercise_id, set_number, reps, weight)
SELECT e.id, n.n, e.reps, e.weight
FROM exercises e
JOIN numbers n ON n.n <= e.sets;

-- ── 3. Drop the now-redundant columns from exercises ──────────

-- Drop the named CHECK constraints we know about
ALTER TABLE exercises DROP CONSTRAINT CHK_sets;
ALTER TABLE exercises DROP CONSTRAINT CHK_weight;

-- Drop the auto-generated DEFAULT constraints (names are random,
-- so we look them up dynamically)
DECLARE @sql NVARCHAR(MAX) = N'';

SELECT @sql = @sql + 'ALTER TABLE exercises DROP CONSTRAINT [' + dc.name + '];' + CHAR(13)
FROM sys.default_constraints dc
INNER JOIN sys.columns c
    ON c.default_object_id = dc.object_id
WHERE c.object_id = OBJECT_ID('exercises')
  AND c.name IN ('sets', 'reps', 'weight');

EXEC sp_executesql @sql;

-- Drop the index that includes these columns
DROP INDEX IX_exercises_date ON exercises;

-- Now drop the columns themselves
ALTER TABLE exercises DROP COLUMN sets;
ALTER TABLE exercises DROP COLUMN reps;
ALTER TABLE exercises DROP COLUMN weight;

-- Recreate the date index without the dropped columns
CREATE NONCLUSTERED INDEX IX_exercises_date
    ON exercises (date ASC)
    INCLUDE (name, unit);

COMMIT TRANSACTION;

-- ── 4. Sanity check (run separately) ──────────────────────────
-- SELECT e.id, e.name, e.date, e.unit, s.set_number, s.reps, s.weight
-- FROM exercises e
-- LEFT JOIN exercise_sets s ON s.exercise_id = e.id
-- ORDER BY e.id, s.set_number;