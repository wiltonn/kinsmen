/**
 * Vercel Function: reviewer comments on preview builds, stored in Neon.
 * Uses node-postgres with Fluid compute's pool handling, per Neon's guidance
 * for Vercel. DATABASE_URL is Neon's pooled connection string.
 */
import { attachDatabasePool } from '@vercel/functions';
import { Pool } from 'pg';
import { createAnnotationsHandler } from '../src/lib/annotations/api.js';
import { isAnnotationsEnabled } from '../src/lib/annotations/model.js';

const connectionString = process.env.DATABASE_URL;
const pool = connectionString ? new Pool({ connectionString, max: 5 }) : undefined;
if (pool) attachDatabasePool(pool);

const handle = createAnnotationsHandler({ enabled: isAnnotationsEnabled(process.env), db: pool });

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
