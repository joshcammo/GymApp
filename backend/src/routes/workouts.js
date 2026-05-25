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
      const result = await pool
        .request()
        .input('startDate', sql.Date, startDate)
        .input('endDate',   sql.Date, endDate)
        .query(`
          SELECT id, name,
                 FORMAT(date, 'yyyy-MM-dd') AS date,
                 sets, reps, weight, unit, notes, created_at, updated_at
          FROM   exercises
          WHERE  date >= @startDate AND date <= @endDate
          ORDER  BY date ASC, created_at ASC
        `);
      res.json(result.recordset);
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
      const result = await pool
        .request()
        .input('date', sql.Date, date)
        .query(`
          SELECT id, name,
                 FORMAT(date, 'yyyy-MM-dd') AS date,
                 sets, reps, weight, unit, notes, created_at, updated_at
          FROM   exercises
          WHERE  date = @date
          ORDER  BY created_at ASC
        `);
      res.json(result.recordset);
    } catch (err) {
      console.error('[GET /workouts/day]', err);
      res.status(500).json({ error: 'Failed to fetch day workouts' });
    }
  }
);

// ──────────────────────────────────────────────────────────────────
// POST /api/workouts
// Create a new exercise entry
// ──────────────────────────────────────────────────────────────────
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Exercise name is required').isLength({ max: 255 }),
    body('date').isISO8601().withMessage('date must be YYYY-MM-DD'),
    body('sets').isInt({ min: 1, max: 100 }).withMessage('sets must be 1–100'),
    body('reps').optional({ nullable: true }).isInt({ min: 1, max: 1000 }),
    body('weight').isFloat({ min: 0 }).withMessage('weight must be ≥ 0'),
    body('unit').isIn(['KG', 'LBS']).withMessage('unit must be KG or LBS'),
    body('notes').optional({ nullable: true }).trim().isLength({ max: 500 }),
  ],
  async (req, res) => {
    if (!validateRequest(req, res)) return;

    const { name, date, sets, reps, weight, unit, notes } = req.body;
    try {
      const pool = await getPool();
      const result = await pool
        .request()
        .input('name',   sql.NVarChar(255),  name)
        .input('date',   sql.Date,           date)
        .input('sets',   sql.Int,            sets)
        .input('reps',   sql.Int,            reps   ?? null)
        .input('weight', sql.Decimal(10, 2), weight)
        .input('unit',   sql.NVarChar(3),    unit)
        .input('notes',  sql.NVarChar(500),  notes  ?? null)
        .query(`
          INSERT INTO exercises (name, date, sets, reps, weight, unit, notes)
          OUTPUT INSERTED.id, INSERTED.name,
                 FORMAT(INSERTED.date, 'yyyy-MM-dd') AS date,
                 INSERTED.sets, INSERTED.reps, INSERTED.weight,
                 INSERTED.unit, INSERTED.notes,
                 INSERTED.created_at, INSERTED.updated_at
          VALUES (@name, @date, @sets, @reps, @weight, @unit, @notes)
        `);
      res.status(201).json(result.recordset[0]);
    } catch (err) {
      console.error('[POST /workouts]', err);
      res.status(500).json({ error: 'Failed to create exercise' });
    }
  }
);

// ──────────────────────────────────────────────────────────────────
// PUT /api/workouts/:id
// Update an existing exercise entry
// ──────────────────────────────────────────────────────────────────
router.put(
  '/:id',
  [
    param('id').isInt({ min: 1 }),
    body('name').optional().trim().notEmpty().isLength({ max: 255 }),
    body('sets').optional().isInt({ min: 1, max: 100 }),
    body('reps').optional({ nullable: true }).isInt({ min: 1, max: 1000 }),
    body('weight').optional().isFloat({ min: 0 }),
    body('unit').optional().isIn(['KG', 'LBS']),
    body('notes').optional({ nullable: true }).trim().isLength({ max: 500 }),
  ],
  async (req, res) => {
    if (!validateRequest(req, res)) return;

    const { id } = req.params;
    const { name, sets, reps, weight, unit, notes } = req.body;
    try {
      const pool = await getPool();
      const result = await pool
        .request()
        .input('id',     sql.Int,            id)
        .input('name',   sql.NVarChar(255),  name)
        .input('sets',   sql.Int,            sets)
        .input('reps',   sql.Int,            reps   ?? null)
        .input('weight', sql.Decimal(10, 2), weight)
        .input('unit',   sql.NVarChar(3),    unit)
        .input('notes',  sql.NVarChar(500),  notes  ?? null)
        .query(`
          UPDATE exercises
          SET name       = COALESCE(@name,   name),
              sets       = COALESCE(@sets,   sets),
              reps       = COALESCE(@reps,   reps),
              weight     = COALESCE(@weight, weight),
              unit       = COALESCE(@unit,   unit),
              notes      = COALESCE(@notes,  notes),
              updated_at = GETDATE()
          OUTPUT INSERTED.id, INSERTED.name,
                 FORMAT(INSERTED.date, 'yyyy-MM-dd') AS date,
                 INSERTED.sets, INSERTED.reps, INSERTED.weight,
                 INSERTED.unit, INSERTED.notes,
                 INSERTED.created_at, INSERTED.updated_at
          WHERE id = @id
        `);
      if (result.recordset.length === 0) {
        return res.status(404).json({ error: 'Exercise not found' });
      }
      res.json(result.recordset[0]);
    } catch (err) {
      console.error('[PUT /workouts/:id]', err);
      res.status(500).json({ error: 'Failed to update exercise' });
    }
  }
);

// ──────────────────────────────────────────────────────────────────
// DELETE /api/workouts/:id
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
