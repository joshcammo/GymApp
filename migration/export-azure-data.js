require('dotenv').config();
const sql = require('mssql');
const fs = require('fs');
const path = require('path');

const config = {
  server:   process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user:     process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  port:     1433,
  options: {
    encrypt:                true,
    trustServerCertificate: false,
    enableArithAbort:       true,
    connectTimeout:         30000,
    requestTimeout:         30000,
  },
};

const DATA_DIR = path.join(__dirname, 'data');

// This script only ever issues SELECTs — it never writes to Azure SQL.
async function main() {
  const pool = await sql.connect(config);

  const exercisesResult = await pool.request().query(`
    SELECT id, name,
           FORMAT(date, 'yyyy-MM-dd') AS date,
           unit, notes, created_at, updated_at
    FROM   exercises
    ORDER  BY date ASC, created_at ASC
  `);

  const setsResult = await pool.request().query(`
    SELECT id, exercise_id, set_number, reps, weight
    FROM   exercise_sets
    ORDER  BY exercise_id ASC, set_number ASC
  `);

  const exercises = exercisesResult.recordset;
  const sets = setsResult.recordset;

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, 'exercises.json'), JSON.stringify(exercises, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, 'exercise_sets.json'), JSON.stringify(sets, null, 2));

  console.log(`Exported ${exercises.length} exercises, ${sets.length} sets`);
  if (exercises.length > 0) {
    console.log(`Date range: ${exercises[0].date} .. ${exercises[exercises.length - 1].date}`);
  }
  console.log(`Written to ${DATA_DIR}`);

  await pool.close();
}

main().catch((err) => {
  console.error('Export failed:', err);
  process.exit(1);
});
