// Persistência do app (SQLite). A Celcoin é o núcleo transacional; o app guarda
// usuários, vínculo usuário <-> conta, propostas e transações (com o clientCode).
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const file = process.env.DATABASE_FILE || path.join(__dirname, '..', 'data', 'lobank.db');
if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });

const db = new Database(file);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document TEXT NOT NULL UNIQUE,          -- CPF (PF) ou CNPJ (PJ), só dígitos
  person_type TEXT NOT NULL CHECK (person_type IN ('PF','PJ')),
  full_name TEXT NOT NULL,
  social_name TEXT,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  tx_password_hash TEXT NOT NULL,         -- senha de transferência
  profile_json TEXT NOT NULL DEFAULT '{}',-- renda, patrimônio, profissão (não vão para a Celcoin)
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS proposals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  proposal_id TEXT,
  client_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,                   -- PENDING, CREATED, PENDING_DOCUMENTSCOPY, APPROVED, RESOURCE_CREATED, REPROVED, RESOURCE_ERROR, ERROR
  documentscopy_url TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS accounts (
  user_id INTEGER PRIMARY KEY REFERENCES users(id),
  branch TEXT NOT NULL,
  account TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL,                     -- PIX_OUT
  client_code TEXT NOT NULL UNIQUE,
  celcoin_id TEXT,
  end_to_end_id TEXT,
  amount REAL NOT NULL,
  status TEXT NOT NULL,                   -- PROCESSING, CONFIRMED, ERROR
  error_code TEXT,
  counterpart_json TEXT NOT NULL DEFAULT '{}',
  message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS pix_lookups (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  key TEXT NOT NULL,
  data_json TEXT NOT NULL,                -- resposta do DICT, replicada no creditParty
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS login_attempts (
  document TEXT PRIMARY KEY,
  failures INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0
);
`);

module.exports = db;
