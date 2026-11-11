// Persistência do app (SQLite). A Celcoin é o núcleo transacional; o app guarda
// usuários, vínculo usuário <-> conta, propostas e transações (com o clientCode).
const path = require('path');
const fs = require('fs');
// SQLite embutido no Node (node:sqlite, Node 22.13+): sem dependência nativa para compilar.
const { DatabaseSync } = require('node:sqlite');

const file = process.env.DATABASE_FILE || path.join(__dirname, '..', 'data', 'lobank.db');
if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });

const db = new DatabaseSync(file);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

// Equivalente simples ao db.transaction(fn) do better-sqlite3.
db.transaction = (fn) => (...args) => {
  db.exec('BEGIN');
  try { const out = fn(...args); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; }
};

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

-- DDA: pedidos de adesão/saída feitos pelo app (com o aceite do termo) e eventos recebidos.
CREATE TABLE IF NOT EXISTS dda_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  document TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('SUBSCRIBE','DELETE')),
  client_request_id TEXT NOT NULL UNIQUE,
  subscription_id TEXT,
  terms_version TEXT,
  terms_accepted_at TEXT,
  contact_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Webhooks do BaaS (onboarding-create, pix-payment-out, pix-payment-in, pix-reversal-out, pix-reversal-in).
-- O id do evento é a chave de deduplicação: entidade + status + endToEndId (ou id/clientCode quando não há).
CREATE TABLE IF NOT EXISTS baas_events (
  id TEXT PRIMARY KEY,
  entity TEXT NOT NULL,
  status TEXT,
  end_to_end_id TEXT,
  client_code TEXT,
  source TEXT NOT NULL,                   -- 'endpoint' (POST /webhooks/celcoin) ou 'webhook.site'
  outcome TEXT,                           -- o que o app fez com o evento
  received_at TEXT NOT NULL DEFAULT (datetime('now')),
  data_json TEXT NOT NULL
);
-- QR Codes estáticos gerados pelo app (para conferir o valor integral do recebimento).
CREATE TABLE IF NOT EXISTS pix_charges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  account TEXT NOT NULL,
  key TEXT NOT NULL,
  amount REAL,                            -- null = valor livre
  celcoin_transaction_id TEXT,
  txid TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Pix recebidos (pix-payment-in), únicos por endToEndId.
CREATE TABLE IF NOT EXISTS pix_receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  account TEXT NOT NULL,
  end_to_end_id TEXT NOT NULL UNIQUE,
  celcoin_id TEXT,
  amount REAL NOT NULL,
  initiation_type TEXT,
  charge_id INTEGER REFERENCES pix_charges(id),
  expected_amount REAL,
  amount_ok INTEGER,                      -- 1 = valor integral; 0 = diferente do cobrado; null = sem cobrança com valor
  payer_json TEXT NOT NULL DEFAULT '{}',
  received_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Devoluções de Pix recebido pedidas pelo app (resultado em pix-reversal-out).
CREATE TABLE IF NOT EXISTS pix_reversals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  receipt_id INTEGER NOT NULL REFERENCES pix_receipts(id),
  client_code TEXT NOT NULL UNIQUE,
  celcoin_id TEXT,
  return_id TEXT,
  amount REAL NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL,                   -- PROCESSING, CONFIRMED, ERROR
  error_code TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS dda_events (
  id TEXT PRIMARY KEY,                    -- id do evento na origem (webhook.site ou simulado)
  document TEXT,
  type TEXT NOT NULL,                     -- SUBSCRIPTION | DELETION | INVOICE
  received_at TEXT NOT NULL,
  data_json TEXT NOT NULL
);
`);

module.exports = db;
