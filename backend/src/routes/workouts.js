const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const { getPool, sql } = require('../config/database');

const router = express.Router();

/** Helper — send 422 if any validation errors exist */
function validateRequest(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ errors: errors.array() });
    return false;
  }
  return true;
}

/** Validation chain for a sets array — used in both POST and PUT */
const setsValidation = [
  body('sets').isArray({ min: 1, max: 100 }).withMessage('sets must be a non-empty array (max 100)'),
  body('sets.*.reps').optional({ nullable: true }).isInt({ min: 1, max: 1000 }),
  body('sets.*.weight').isFloat({ min: 0 }).withMessage('each set\'s weight must be ≥ 0'),
];

/**
 * Helper — given a list of exercise rows and a list of set rows,
 * stitch sets onto their parent exercises and return the combined array.
 *
 * Sets within an exercise are ordered by set_number ascending.
 */
function attachSets(exerciseRows, setRows) {
  // Group set rows by exercise_id for O(1) lookup
  const setsByExercise = new Map();
  for (const s of setRows) {
    if (!setsByExercise.has(s.exercise_id)) {
      setsByExercise.set(s.exercise_id, []);
    }
    setsByExercise.get(s.exercise_id).push({
      id:         s.id,
      set_number: s.set_number,
      reps:       s.reps,
      weight:     s.weight,
    });
  }

  return exerciseRows.map(e => ({
    ...e,
    sets: (setsByExercise.get(e.id) || [])
      .sort((a, b) => a.set_number - b.set_number),
  }));
}

/**
 * Helper — fetch one exercise (with its sets) by id.
 * Returns null if not found.
 */
async function fetchExerciseById(pool, id) {
  const exerciseResult = await pool
    .request()
    .input('id', sql.Int, id)
    .query(`
      SELECT id, name,
             FORMAT(date, 'yyyy-MM-dd') AS date,
             unit, notes, created_at, updated_at
      FROM   exercises
      WHERE  id = @id
    `);

  if (exerciseResult.recordset.length === 0) return null;

  const setsResult = await pool
    .request()
    .input('exerciseId', sql.Int, id)
    .query(`
      SELECT id, exercise_id, set_number, reps, weight
      FROM   exercise_sets
      WHERE  exercise_id = @exerciseId
      ORDER  BY set_number ASC
    `);

  return attachSets(exerciseResult.recordset, setsResult.recordset)[0];
}

// ──────────────────────────────────────────────────────────────────
// GET /api/workouts?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
// Returns every exercise in [startDate, endDate] — used for weekly view
// ──────────────────────────────────────────────────────────────────
router.get(
  '/',
  [
    query('startDate').isISO8601().withMessage('startDate must be YYYY-MM-DD'),
    query('endDate').isISO8601().withMessage('endDate must be YYYY-MM-DD'),
  ],
  async (req, res) => {
    if (!validateRequest(req, res)) return;

    const { startDate, endDate } = req.query;
    try {
      const pool = await getPool();

      // 1. Fetch all exercises in the date range
      const exerciseResult = await pool
        .request()
        .input('startDate', sql.Date, startDate)
        .input('endDate',   sql.Date, endDate)
        .query(`
          SELECT id, name,
                 FORMAT(date, 'yyyy-MM-dd') AS date,
                 unit, notes, created_at, updated_at
          FROM   exercises
          WHERE  date >= @startDate AND date <= @endDate
          ORDER  BY date ASC, created_at ASC
        `);

      // 2. Fetch all sets for those exercises in a single query
      const setsResult = await pool
        .request()
        .input('startDate', sql.Date, startDate)
        .input('endDate',   sql.Date, endDate)
        .query(`
          SELECT s.id, s.exercise_id, s.set_number, s.reps, s.weight
          FROM   exercise_sets s
          INNER  JOIN exercises e ON e.id = s.exercise_id
          WHERE  e.date >= @startDate AND e.date <= @endDate
          ORDER  BY s.exercise_id, s.set_number ASC
        `);

      res.json(attachSets(exerciseResult.recordset, setsResult.recordset));
    } catch (err) {
      console.error('[GET /workouts]', err);
      res.status(500).json({ error: 'Failed to fetch workouts' });
    }
  }
);

// ──────────────────────────────────────────────────────────────────
// GET /api/workouts/day?date=YYYY-MM-DD
// Returns exercises for a single day
// ──────────────────────────────────────────────────────────────────
router.get(
  '/day',
  [query('date').isISO8601().withMessage('date must be YYYY-MM-DD')],
  async (req, res) => {
    if (!validateRequest(req, res)) return;

    const { date } = req.query;
    try {
      const pool = await getPool();

      const exerciseResult = await pool
        .request()
        .input('date', sql.Date, date)
        .query(`
          SELECT id, name,
                 FORMAT(date, 'yyyy-MM-dd') AS date,
                 unit, notes, created_at, updated_at
          FROM   exercises
          WHERE  date = @date
          ORDER  BY created_at ASC
        `);

      const setsResult = await pool
        .request()
        .input('date', sql.Date, date)
        .query(`
          SELECT s.id, s.exercise_id, s.set_number, s.reps, s.weight
          FROM   exercise_sets s
          INNER  JOIN exercises e ON e.id = s.exercise_id
          WHERE  e.date = @date
          ORDER  BY s.exercise_id, s.set_number ASC
        `);

      res.json(attachSets(exerciseResult.recordset, setsResult.recordset));
    } catch (err) {
      console.error('[GET /workouts/day]', err);
      res.status(500).json({ error: 'Failed to fetch day workouts' });
    }
  }
);

// ──────────────────────────────────────────────────────────────────
// POST /api/workouts
// Create a new exercise with per-set data
//
// Body shape:
// {
//   "name":  "Bench Press",
//   "date":  "2026-05-25",
//   "unit":  "KG",
//   "notes": null,
//   "sets":  [ { "reps": 8, "weight": 60 }, { "reps": 7, "weight": 60 } ]
// }
// ──────────────────────────────────────────────────────────────────
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Exercise name is required').isLength({ max: 255 }),
    body('date').isISO8601().withMessage('date must be YYYY-MM-DD'),
    body('unit').isIn(['KG', 'LBS']).withMessage('unit must be KG or LBS'),
    body('notes').optional({ nullable: true }).trim().isLength({ max: 500 }),
    ...setsValidation,
  ],
  async (req, res) => {
    if (!validateRequest(req, res)) return;

    const { name, date, unit, notes, sets } = req.body;

    const pool = await getPool();
    const transaction = new sql.Transaction(pool);

    try {
      await transaction.begin();

      // 1. Insert the parent exercise
      const exerciseInsert = await new sql.Request(transaction)
        .input('name',  sql.NVarChar(255), name)
        .input('date',  sql.Date,          date)
        .input('unit',  sql.NVarChar(3),   unit)
        .input('notes', sql.NVarChar(500), notes ?? null)
        .query(`
          INSERT INTO exercises (name, date, unit, notes)
          OUTPUT INSERTED.id
          VALUES (@name, @date, @unit, @notes)
        `);

      const newExerciseId = exerciseInsert.recordset[0].id;

      // 2. Insert each set
      for (let i = 0; i < sets.length; i++) {
        const setData = sets[i];
        await new sql.Request(transaction)
          .input('exerciseId', sql.Int,            newExerciseId)
          .input('setNumber',  sql.Int,            i + 1)
          .input('reps',       sql.Int,            setData.reps ?? null)
          .input('weight',     sql.Decimal(10, 2), setData.weight)
          .query(`
            INSERT INTO exercise_sets (exercise_id, set_number, reps, weight)
            VALUES (@exerciseId, @setNumber, @reps, @weight)
          `);
      }

      await transaction.commit();

      // 3. Re-fetch the full exercise (with sets) to return
      const created = await fetchExerciseById(pool, newExerciseId);
      res.status(201).json(created);

    } catch (err) {
      console.error('[POST /workouts]', err);
      try { await transaction.rollback(); } catch (_) { /* rollback may fail if begin never succeeded */ }
      res.status(500).json({ error: 'Failed to create exercise' });
    }
  }
);

// ──────────────────────────────────────────────────────────────────
// PUT /api/workouts/:id
// Update an existing exercise. Sets are REPLACED entirely
// (old sets deleted, new sets inserted) within a transaction.
// ──────────────────────────────────────────────────────────────────
router.put(
  '/:id',
  [
    param('id').isInt({ min: 1 }),
    body('name').optional().trim().notEmpty().isLength({ max: 255 }),
    body('unit').optional().isIn(['KG', 'LBS']),
    body('notes').optional({ nullable: true }).trim().isLength({ max: 500 }),
    // sets is optional on PUT — if omitted, existing sets are left alone
    body('sets').optional().isArray({ min: 1, max: 100 }),
    body('sets.*.reps').optional({ nullable: true }).isInt({ min: 1, max: 1000 }),
    body('sets.*.weight').optional().isFloat({ min: 0 }),
  ],
  async (req, res) => {
    if (!validateRequest(req, res)) return;

    const { id } = req.params;
    const { name, unit, notes, sets } = req.body;

    const pool = await getPool();
    const transaction = new sql.Transaction(pool);

    try {
      await transaction.begin();

      // 1. Update the parent exercise (COALESCE leaves unspecified fields alone)
      const updateResult = await new sql.Request(transaction)
        .input('id',    sql.Int,           id)
        .input('name',  sql.NVarChar(255), name)
        .input('unit',  sql.NVarChar(3),   unit)
        .input('notes', sql.NVarChar(500), notes ?? null)
        .query(`
          UPDATE exercises
          SET name       = COALESCE(@name,  name),
              unit       = COALESCE(@unit,  unit),
              notes      = COALESCE(@notes, notes),
              updated_at = GETDATE()
          OUTPUT INSERTED.id
          WHERE id = @id
        `);

      if (updateResult.recordset.length === 0) {
        await transaction.rollback();
        return res.status(404).json({ error: 'Exercise not found' });
      }

      // 2. If sets were provided, replace them entirely
      if (Array.isArray(sets)) {
        await new sql.Request(transaction)
          .input('exerciseId', sql.Int, id)
          .query(`DELETE FROM exercise_sets WHERE exercise_id = @exerciseId`);

        for (let i = 0; i < sets.length; i++) {
          const setData = sets[i];
          await new sql.Request(transaction)
            .input('exerciseId', sql.Int,            id)
            .input('setNumber',  sql.Int,            i + 1)
            .input('reps',       sql.Int,            setData.reps ?? null)
            .input('weight',     sql.Decimal(10, 2), setData.weight)
            .query(`
              INSERT INTO exercise_sets (exercise_id, set_number, reps, weight)
              VALUES (@exerciseId, @setNumber, @reps, @weight)
            `);
        }
      }

      await transaction.commit();

      const updated = await fetchExerciseById(pool, id);
      res.json(updated);

    } catch (err) {
      console.error('[PUT /workouts/:id]', err);
      try { await transaction.rollback(); } catch (_) { /* ignore */ }
      res.status(500).json({ error: 'Failed to update exercise' });
    }
  }
);

// ──────────────────────────────────────────────────────────────────
// DELETE /api/workouts/:id
// ON DELETE CASCADE in the FK constraint handles set cleanup automatically.
// ──────────────────────────────────────────────────────────────────
router.delete(
  '/:id',
  [param('id').isInt({ min: 1 })],
  async (req, res) => {
    if (!validateRequest(req, res)) return;

    const { id } = req.params;
    try {
      const pool = await getPool();
      const result = await pool
        .request()
        .input('id', sql.Int, id)
        .query('DELETE FROM exercises OUTPUT DELETED.id WHERE id = @id');
      if (result.recordset.length === 0) {
        return res.status(404).json({ error: 'Exercise not found' });
      }
      res.status(204).send();
    } catch (err) {
      console.error('[DELETE /workouts/:id]', err);
      res.status(500).json({ error: 'Failed to delete exercise' });
    }
  }
);

module.exports = router;