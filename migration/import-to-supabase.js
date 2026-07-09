require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const BATCH_SIZE = 500;
const FORCE = process.argv.includes('--force');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const userId = process.env.TARGET_USER_ID;

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  if (!userId) throw new Error('TARGET_USER_ID is not set in migration/.env');

  const exercises = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'exercises.json'), 'utf8'));
  const sets = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'exercise_sets.json'), 'utf8'));

  // Safety check — abort if this user already has rows (avoid double-import)
  const { count, error: countErr } = await supabase
    .from('exercises')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (countErr) throw countErr;
  if (count > 0 && !FORCE) {
    throw new Error(
      `Target user already has ${count} exercises in Supabase — aborting to avoid duplicates. ` +
      `Re-run with --force to import anyway.`
    );
  }

  const idMap = new Map(); // old Azure SQL id -> new Supabase id

  for (const batch of chunk(exercises, BATCH_SIZE)) {
    const rows = batch.map((e) => ({
      user_id: userId,
      name: e.name,
      date: e.date,
      unit: e.unit,
      notes: e.notes,
    }));
    const { data, error } = await supabase.from('exercises').insert(rows).select('id');
    if (error) throw error;
    batch.forEach((e, i) => idMap.set(e.id, data[i].id));
  }

  const remappedSets = sets.map((s) => ({
    exercise_id: idMap.get(s.exercise_id),
    set_number: s.set_number,
    reps: s.reps,
    weight: s.weight,
  }));

  const orphans = remappedSets.filter((s) => s.exercise_id == null);
  if (orphans.length > 0) {
    throw new Error(`${orphans.length} sets reference an exercise_id not present in the export — aborting`);
  }

  for (const batch of chunk(remappedSets, BATCH_SIZE)) {
    const { error } = await supabase.from('exercise_sets').insert(batch);
    if (error) throw error;
  }

  console.log(`Imported ${exercises.length} exercises, ${sets.length} sets for user ${userId}`);
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
