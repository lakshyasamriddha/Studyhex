const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = path.join(__dirname, '..', 'studyreck.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

const raw = new DatabaseSync(DB_PATH, { enableForeignKeyConstraints: true });
raw.exec('PRAGMA journal_mode = WAL;');

// Apply schema (idempotent - uses CREATE TABLE IF NOT EXISTS)
const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
raw.exec(schema);

// node:sqlite's Statement API is very close to better-sqlite3's (prepare/run/get/all),
// but .run()'s result uses bigint fields. Wrap it so the rest of the app
// (routes/*.js) can keep using db.prepare(sql).run()/.get()/.all() unchanged.
const db = {
  exec: (sql) => raw.exec(sql),
  prepare: (sql) => {
    const stmt = raw.prepare(sql);
    return {
      run: (...params) => {
        const info = stmt.run(...params);
        return { changes: Number(info.changes), lastInsertRowid: Number(info.lastInsertRowid) };
      },
      get: (...params) => stmt.get(...params),
      all: (...params) => stmt.all(...params)
    };
  }
};

module.exports = db;
