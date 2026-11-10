// Autenticação própria do app: a Celcoin conhece a conta, não quem entra no app.
const crypto = require('crypto');
const db = require('./db');

const SESSION_COOKIE = 'lobank_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8 horas
const MAX_FAILURES = 5;
const LOCK_MS = 1000 * 60 * 15;

function hashSecret(secret) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(secret, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifySecret(secret, stored) {
  const [alg, saltHex, hashHex] = String(stored).split('$');
  if (alg !== 'scrypt' || !saltHex || !hashHex) return false;
  const hash = crypto.scryptSync(secret, Buffer.from(saltHex, 'hex'), 64);
  const expected = Buffer.from(hashHex, 'hex');
  return expected.length === hash.length && crypto.timingSafeEqual(expected, hash);
}

const sha = (v) => crypto.createHash('sha256').update(v).digest('hex');

function createSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(sha(token), userId, Date.now() + SESSION_TTL_MS);
  res.cookie(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === 'true', maxAge: SESSION_TTL_MS, path: '/' });
}

function destroySession(req, res) {
  const token = readCookie(req, SESSION_COOKIE);
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha(token));
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

// Sem sessão válida, a requisição é recusada. Nunca há usuário ou conta padrão.
function requireUser(req, res, next) {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token) return res.status(401).json({ error: 'NO_SESSION', message: 'Faça login para continuar.' });
  const row = db.prepare('SELECT user_id, expires_at FROM sessions WHERE token_hash = ?').get(sha(token));
  if (!row || row.expires_at < Date.now()) {
    if (row) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha(token));
    return res.status(401).json({ error: 'SESSION_EXPIRED', message: 'Sua sessão expirou. Faça login novamente.' });
  }
  req.user = db.prepare('SELECT * FROM users WHERE id = ?').get(row.user_id);
  if (!req.user) return res.status(401).json({ error: 'NO_SESSION', message: 'Faça login para continuar.' });
  req.account = db.prepare('SELECT * FROM accounts WHERE user_id = ?').get(req.user.id) || null;
  next();
}

// "Sem conta" é um estado de primeira classe: rotas de dinheiro recusam explicitamente.
function requireAccount(req, res, next) {
  if (!req.account) return res.status(409).json({ error: 'NO_ACCOUNT', message: 'Sua conta ainda não foi aberta. Conclua a validação de identidade.' });
  next();
}

function checkLock(document) {
  const row = db.prepare('SELECT * FROM login_attempts WHERE document = ?').get(document);
  return row && row.locked_until > Date.now() ? row.locked_until : 0;
}

function registerFailure(document) {
  const row = db.prepare('SELECT * FROM login_attempts WHERE document = ?').get(document) || { failures: 0 };
  const failures = row.failures + 1;
  const lockedUntil = failures >= MAX_FAILURES ? Date.now() + LOCK_MS : 0;
  db.prepare(`INSERT INTO login_attempts (document, failures, locked_until) VALUES (?, ?, ?)
    ON CONFLICT(document) DO UPDATE SET failures = excluded.failures, locked_until = excluded.locked_until`).run(document, lockedUntil ? 0 : failures, lockedUntil);
}

const clearFailures = (document) => db.prepare('DELETE FROM login_attempts WHERE document = ?').run(document);

module.exports = { hashSecret, verifySecret, createSession, destroySession, requireUser, requireAccount, checkLock, registerFailure, clearFailures };
