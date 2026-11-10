/*
  LOCAL DATABASE (SQLite)

  All data lives on the phone; no internet needed.
  Each table works like a box of records: every row holds the record's id and the
  record itself (doc, as JSON text). That way records can gain new fields without
  changing the table structure. Frequently queried fields have an index.

  Every record has a unique `id` and an `updatedAt` timestamp, so a future cloud
  sync can tell which copy of a record is newer.

  Usage (similar to Dexie in the old web version):
    await tables.species.get(id)
    await tables.sightings.where('speciesId', id)
    await tables.points.put({ ... })
    await transaction(async () => { ... })     // all or nothing
*/
import * as SQLite from 'expo-sqlite';

// File name kept from the app's original name, so existing journals keep working.
const DB_NAME = 'mantar-defteri.db';

// Tables and the fields they are indexed by
const SCHEMA = {
  species: ['speciesKey', 'firstFoundAt'], // species pages in the book
  sightings: ['speciesId', 'tripId', 'foundAt'], // individual finds (no speciesId = draft)
  photos: ['sightingId'], // photo file names
  trips: ['startedAt', 'endedAt'], // trips
  pending: ['createdAt'], // photos taken offline, waiting to be identified
  points: ['sightingId', 'speciesId'], // point entries; the total score is their sum
  badges: ['earnedAt'], // earned badges (id = badge key)
};

const SCHEMA_VERSION = 2;

let dbPromise = null;

/** Opens the database (creating tables on first use). Always returns the same connection. */
export function getDb() {
  if (!dbPromise) {
    dbPromise = openAndMigrate().catch((err) => {
      dbPromise = null; // try opening again next time
      throw err;
    });
  }
  return dbPromise;
}

async function openAndMigrate() {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  const row = await db.getFirstAsync('PRAGMA user_version');
  const version = row?.user_version ?? 0;

  if (version < 1) {
    const statements = ['PRAGMA journal_mode = WAL;'];
    for (const [name, indexed] of Object.entries(SCHEMA)) {
      statements.push(`CREATE TABLE IF NOT EXISTS ${name} (id TEXT PRIMARY KEY NOT NULL, doc TEXT NOT NULL);`);
      for (const field of indexed) {
        statements.push(
          `CREATE INDEX IF NOT EXISTS ${name}_${field} ON ${name} (json_extract(doc, '$.${field}'));`
        );
      }
    }
    await db.execAsync(statements.join('\n'));
  }

  if (version < 2) {
    // v2: species names became language-neutral (`turkishName` → `commonName`)
    await db.execAsync(`
      UPDATE species
         SET doc = json_remove(json_set(doc, '$.commonName', json_extract(doc, '$.turkishName')), '$.turkishName')
       WHERE json_extract(doc, '$.turkishName') IS NOT NULL;
    `);
  }

  // Future structure changes go here: if (version < 3) { ... }

  if (version < SCHEMA_VERSION) await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
  return db;
}

// ---------------------------------------------------------------- change notifications

/*
  A tiny notification system so screens refresh themselves when a record is written.
  Many writes in a row are batched into a single notification.
*/
const listeners = new Set();
let notifyScheduled = false;
let transactionDepth = 0;
let changedDuringTransaction = false;

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function markChanged() {
  if (transactionDepth > 0) {
    changedDuringTransaction = true; // notify once the transaction ends
    return;
  }
  if (notifyScheduled) return;
  notifyScheduled = true;
  setTimeout(() => {
    notifyScheduled = false;
    listeners.forEach((fn) => fn());
  }, 0);
}

/**
 * Runs several writes as "all or nothing": if anything fails, none of them are saved.
 * Nested calls join the outer transaction.
 */
export async function transaction(task) {
  const db = await getDb();
  if (transactionDepth > 0) return task();

  transactionDepth += 1;
  let result;
  try {
    await db.withTransactionAsync(async () => {
      result = await task();
    });
  } finally {
    transactionDepth -= 1;
    if (changedDuringTransaction) {
      changedDuringTransaction = false;
      markChanged();
    }
  }
  return result;
}

// ---------------------------------------------------------------- tables

const parse = (row) => (row ? JSON.parse(row.doc) : null);
const field = (name) => {
  if (!/^[A-Za-z]+$/.test(name)) throw new Error(`Invalid field name: ${name}`);
  return `json_extract(doc, '$.${name}')`;
};

function makeTable(name) {
  return {
    /** One record by id (null if missing) */
    async get(id) {
      if (!id) return null;
      const db = await getDb();
      return parse(await db.getFirstAsync(`SELECT doc FROM ${name} WHERE id = ?`, id));
    },

    /** Several ids → records (missing ones are skipped) */
    async bulkGet(ids) {
      const list = [...new Set(ids.filter(Boolean))];
      if (!list.length) return [];
      const db = await getDb();
      const rows = await db.getAllAsync(
        `SELECT doc FROM ${name} WHERE id IN (${list.map(() => '?').join(',')})`,
        list
      );
      return rows.map(parse);
    },

    /** All records, sorted by `orderBy` if given */
    async all({ orderBy, desc = false, limit } = {}) {
      const db = await getDb();
      let sql = `SELECT doc FROM ${name}`;
      if (orderBy) sql += ` ORDER BY ${field(orderBy)} ${desc ? 'DESC' : 'ASC'}`;
      if (limit) sql += ` LIMIT ${Number(limit)}`;
      return (await db.getAllAsync(sql)).map(parse);
    },

    /** Records whose field equals the value (null matches empty fields) */
    async where(fieldName, value) {
      const db = await getDb();
      const rows =
        value == null
          ? await db.getAllAsync(`SELECT doc FROM ${name} WHERE ${field(fieldName)} IS NULL`)
          : await db.getAllAsync(`SELECT doc FROM ${name} WHERE ${field(fieldName)} = ?`, value);
      return rows.map(parse);
    },

    async count() {
      const db = await getDb();
      const row = await db.getFirstAsync(`SELECT COUNT(*) AS n FROM ${name}`);
      return row?.n ?? 0;
    },

    /** Inserts a record (overwrites one with the same id) */
    async put(record) {
      const db = await getDb();
      await db.runAsync(`INSERT OR REPLACE INTO ${name} (id, doc) VALUES (?, ?)`, record.id, JSON.stringify(record));
      markChanged();
      return record;
    },

    async bulkPut(records) {
      if (!records.length) return;
      await transaction(async () => {
        for (const r of records) await this.put(r);
      });
    },

    /** Changes only the given fields of a record */
    async update(id, changes) {
      const current = await this.get(id);
      if (!current) return null;
      const next = { ...current, ...changes };
      await this.put(next);
      return next;
    },

    async delete(id) {
      if (!id) return;
      const db = await getDb();
      await db.runAsync(`DELETE FROM ${name} WHERE id = ?`, id);
      markChanged();
    },

    async deleteWhere(fieldName, value) {
      const db = await getDb();
      await db.runAsync(`DELETE FROM ${name} WHERE ${field(fieldName)} = ?`, value);
      markChanged();
    },
  };
}

export const tables = Object.fromEntries(Object.keys(SCHEMA).map((name) => [name, makeTable(name)]));

// ---------------------------------------------------------------- helpers

/** Generates a new unique id */
export function newId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Adds the shared fields (id, timestamps) to a new record */
export function withMeta(record) {
  const now = Date.now();
  return { id: newId(), createdAt: now, updatedAt: now, ...record };
}
