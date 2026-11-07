/**
 * The tiny SQL interface the store needs, with three adapters:
 *   - Node's built-in SQLite (local demo and tests)
 *   - Cloudflare D1 (shared deployment; D1 is SQLite)
 *   - sql.js, SQLite compiled to WebAssembly (the in-browser /club-demo)
 * Same schema and queries on both.
 */

export type SqlValue = string | number | null;

export interface SqlDb {
  all<T = Record<string, unknown>>(sql: string, params?: SqlValue[]): Promise<T[]>;
  run(sql: string, params?: SqlValue[]): Promise<void>;
  exec(sql: string): Promise<void>;
}

/** Minimal shape of node:sqlite's DatabaseSync (kept structural so this file has no Node import). */
interface SyncSqlite {
  exec(sql: string): void;
  prepare(sql: string): { all(...params: SqlValue[]): unknown[]; run(...params: SqlValue[]): unknown };
}

export function sqliteDb(db: SyncSqlite): SqlDb {
  return {
    async all<T>(sql: string, params: SqlValue[] = []) {
      return db.prepare(sql).all(...params) as T[];
    },
    async run(sql, params = []) {
      db.prepare(sql).run(...params);
    },
    async exec(sql) {
      db.exec(sql);
    },
  };
}

/** Minimal shape of a sql.js Database (structural, so this file has no sql.js import). */
interface SqlJsLike {
  exec(sql: string): unknown;
  run(sql: string, params?: SqlValue[]): unknown;
  prepare(sql: string): { bind(params: SqlValue[]): boolean; step(): boolean; getAsObject(): Record<string, unknown>; free(): boolean };
}

export function sqlJsDb(db: SqlJsLike): SqlDb {
  return {
    async all<T>(sql: string, params: SqlValue[] = []) {
      const statement = db.prepare(sql);
      try {
        statement.bind(params);
        const rows: T[] = [];
        while (statement.step()) rows.push(statement.getAsObject() as T);
        return rows;
      } finally {
        statement.free();
      }
    },
    async run(sql, params = []) {
      db.run(sql, params);
    },
    async exec(sql) {
      db.exec(sql);
    },
  };
}

/** Minimal shape of a Cloudflare D1 binding. */
export interface D1Like {
  prepare(sql: string): { bind(...params: SqlValue[]): { all<T>(): Promise<{ results: T[] }>; run(): Promise<unknown> } };
  exec(sql: string): Promise<unknown>;
}

export function d1Db(db: D1Like): SqlDb {
  return {
    async all<T>(sql: string, params: SqlValue[] = []) {
      return (await db.prepare(sql).bind(...params).all<T>()).results;
    },
    async run(sql, params = []) {
      await db.prepare(sql).bind(...params).run();
    },
    async exec(sql) {
      await db.exec(sql);
    },
  };
}

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('national','region','district','club')),
  parent_id TEXT REFERENCES organizations(id),
  description TEXT NOT NULL DEFAULT '',
  contact_email TEXT,
  fictional INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS people (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS access_grants (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES people(id),
  org_id TEXT NOT NULL REFERENCES organizations(id),
  level TEXT NOT NULL CHECK (level IN ('member','admin')),
  status TEXT NOT NULL CHECK (status IN ('active','revoked')),
  created_at TEXT NOT NULL,
  created_by TEXT,
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS access_grants_person ON access_grants(person_id, status);
CREATE INDEX IF NOT EXISTS access_grants_org ON access_grants(org_id, status);
CREATE TABLE IF NOT EXISTS invitations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  email TEXT NOT NULL COLLATE NOCASE,
  name TEXT,
  level TEXT NOT NULL CHECK (level IN ('member','admin')),
  status TEXT NOT NULL CHECK (status IN ('pending','accepted','revoked')),
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  accepted_at TEXT
);
CREATE INDEX IF NOT EXISTS invitations_email ON invitations(email, status);
CREATE TABLE IF NOT EXISTS directory_entries (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  role_title TEXT,
  email TEXT,
  phone TEXT,
  contact_visibility TEXT NOT NULL CHECK (contact_visibility IN ('members','admins'))
);
CREATE TABLE IF NOT EXISTS meeting_notes (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  title TEXT NOT NULL,
  meeting_date TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','final')),
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  finalized_at TEXT
);
CREATE TABLE IF NOT EXISTS committees (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT '',
  chair_entry_id TEXT,
  member_entry_ids TEXT NOT NULL DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS links (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS tracker_items (
  id TEXT NOT NULL,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  data TEXT NOT NULL,
  PRIMARY KEY (org_id, id)
);
`;
