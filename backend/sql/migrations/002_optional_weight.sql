-- ================================================================
-- Migration 002: Make weight optional (bodyweight exercises)
-- 
-- Allows weight to be NULL on exercise_sets, so users can log
-- bodyweight exercises like pull-ups without entering a weight.
-- ================================================================

BEGIN TRANSACTION;

-- 1. Drop the named CHECK constraint
ALTER TABLE exercise_sets DROP CONSTRAINT CHK_set_weight;

-- 2. Drop any auto-generated DEFAULT constraint on weight
DECLARE @sql NVARCHAR(MAX) = N'';

SELECT @sql = @sql + 'ALTER TABLE exercise_sets DROP CONSTRAINT [' + dc.name + '];' + CHAR(13)
FROM sys.default_constraints dc
INNER JOIN sys.columns c
    ON c.default_object_id = dc.object_id
WHERE c.object_id = OBJECT_ID('exercise_sets')
  AND c.name = 'weight';

EXEC sp_executesql @sql;

-- 3. Make the column nullable
ALTER TABLE exercise_sets ALTER COLUMN weight DECIMAL(10,2) NULL;

-- 4. Re-add the CHECK constraint, but allowing NULL
ALTER TABLE exercise_sets ADD CONSTRAINT CHK_set_weight
    CHECK (weight IS NULL OR weight >= 0);

COMMIT TRANSACTION;