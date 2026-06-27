const { createClient } = require('@libsql/client');

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const SEED_CATEGORIES = [
  ['Alimentación', '#6366f1'],
  ['Transporte',   '#f59e0b'],
  ['Vivienda',     '#10b981'],
  ['Entretenimiento', '#ef4444'],
  ['Salud',        '#3b82f6'],
  ['Compras',      '#ec4899'],
  ['Educación',    '#8b5cf6'],
  ['Viajes',       '#14b8a6'],
  ['Inversiones',  '#22c55e'],
  ['Otros',        '#94a3b8'],
];

const SEED_ORIGINS = [
  ['Débito'],
  ['Crédito'],
  ['Efectivo'],
  ['Transferencia'],
  ['Cuenta Digital'],
];

async function initDb() {
  await db.batch([
    `ALTER TABLE transactions ADD COLUMN currency TEXT NOT NULL DEFAULT 'ARS'`,
  ]).catch(() => {});

  await db.batch([
    `ALTER TABLE transactions ADD COLUMN origin TEXT NOT NULL DEFAULT 'Débito'`,
  ]).catch(() => {});

  await db.execute(
    `CREATE TABLE IF NOT EXISTS origins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  ).catch(() => {});

  await db.batch([
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      color TEXT NOT NULL DEFAULT '#94a3b8',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'expense',
      amount REAL NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      date TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    ...SEED_CATEGORIES.map(([name, color]) => ({
      sql: 'INSERT OR IGNORE INTO categories (name, color) VALUES (?, ?)',
      args: [name, color],
    })),
    ...SEED_ORIGINS.map(([name]) => ({
      sql: 'INSERT OR IGNORE INTO origins (name) VALUES (?)',
      args: [name],
    })),
  ]);
}

module.exports = { db, initDb };
