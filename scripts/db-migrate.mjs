#!/usr/bin/env node
/**
 * Applies db/annotations.sql to the Neon database in DATABASE_URL
 * (read from the environment, else .env.local / .env). Safe to re-run.
 */
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { loadEnv } from 'vite';

const url = process.env.DATABASE_URL || loadEnv('development', process.cwd(), '').DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. Run `neon deploy` (writes .env.local) or set it in the environment.');
  process.exit(1);
}
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query(await readFile(new URL('../db/annotations.sql', import.meta.url), 'utf8'));
  const { rows } = await client.query('select count(*)::int as n from review_annotations');
  console.log(`✓ review_annotations is ready (${rows[0].n} rows).`);
} finally {
  await client.end();
}
