#!/usr/bin/env node
/**
 * Migration filename check.
 *
 * Migrations are applied by hand in the Supabase SQL editor, so there is no
 * tool that would catch a numbering mistake before it hits production. The
 * realistic mistake on a repo with many long-lived branches is two branches
 * both claiming the same number and one silently shadowing the other in
 * review. That is an error here.
 *
 * Gaps are NOT an error: a number is legitimately reserved by a branch that
 * has not merged yet (022 is, at the time of writing). They are reported so
 * the hole is visible and nobody reuses the number by accident.
 *
 * Run: node scripts/check-migrations.mjs
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(import.meta.dirname, '..', 'supabase', 'migrations');
const PATTERN = /^(\d{3})_[a-z0-9_]+\.sql$/;

const files = readdirSync(DIR).filter(f => f.endsWith('.sql')).sort();
const errors = [];
const byNumber = new Map();

for (const file of files) {
  const match = PATTERN.exec(file);
  if (!match) {
    errors.push(`${file}: expected NNN_lower_snake_case.sql (three digits, then [a-z0-9_])`);
    continue;
  }
  const number = match[1];
  if (!byNumber.has(number)) byNumber.set(number, []);
  byNumber.get(number).push(file);
}

for (const [number, claimed] of byNumber) {
  if (claimed.length > 1) {
    errors.push(`duplicate migration number ${number}: ${claimed.join(', ')}`);
  }
}

const numbers = [...byNumber.keys()].map(Number).sort((a, b) => a - b);
const gaps = [];
for (let n = numbers[0]; n < numbers.at(-1); n++) {
  if (!numbers.includes(n)) gaps.push(String(n).padStart(3, '0'));
}

console.log(`Checked ${files.length} migrations, ${numbers.at(0)}–${numbers.at(-1)}.`);
if (gaps.length) {
  console.log(`Unused numbers (reserved by unmerged branches, not an error): ${gaps.join(', ')}`);
}
console.log(`Next free number: ${String(numbers.at(-1) + 1).padStart(3, '0')}`);

if (errors.length) {
  console.error('\nProblems:');
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
