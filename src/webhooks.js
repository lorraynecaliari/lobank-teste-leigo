// Webhooks do BaaS da Celcoin: onboarding-create, pix-payment-out, pix-payment-in,
// pix-reversal-out e pix-reversal-in. Duas entradas, o mesmo tratamento:
//  1. POST /webhooks/celcoin (endpoint do app, para quando houver endereço público);
//  2. leitura do webhook.site (src/dda-events.js), onde os webhooks estão cadastrados hoje.
// Regras: o evento é gravado antes de qualquer efeito (deduplicação por entidade + status +
// endToEndId), o endpoint responde HTTP 200 depois de gravar, e cada evento vira uma linha
// mascarada nas evidências e no log. O webhook não substitui o extrato da Celcoin.
const db = require('./db');
const evidence = require('./evidence');
const { MODE } = require('./celcoin');

const lower = (s) => String(s || '').toLowerCase();
const upper = (s) => String(s || '').toUpperCase();

// A Celcoin manda {entity, status, createTimestamp, body}; alguns modelos vêm com a 1ª letra maiúscula.
function normalize(raw) {
  const ev = raw && typeof raw === 'object' ? raw : {};
  const body = ev.body || ev.Body || {};
  const b = body && typeof body === 'object' ? body : {};
  const entity = lower(ev.entity || ev.Entity);
  const status = upper(ev.status || ev.Status || b.status);
  const e2e = b.endToEndId || b.endtoEndId || b.endtoendid || b.originalEndToEndId || null;
  const clientCode = b.clientCode || b.clientRequestId || null;
  return { entity, status, body: b, endToEndId: e2e, clientCode, createTimestamp: ev.createTimestamp || ev.CreateTimestamp || null };
}

// Chave de deduplicação. Para Pix, o endToEndId identifica a transação no SPI; o status entra
// porque PROCESSING e CONFIRMED do mesmo Pix são eventos diferentes.
function eventKey(n) {
  const ref = n.endToEndId || n.body.id || n.clientCode || n.body.onboardingId || n.body.proposalId || JSON.stringify(n.body).slice(0, 200);
  return `${n.entity}:${n.status}:${ref}`;
}

const accountOwner = (account) => (account ? db.prepare('SELECT user_id FROM accounts WHERE account = ?').get(String(account)) : null);

// ---- efeitos por entidade -------------------------------------------------------------
function onOnboardingCreate(n) {
  const b = n.body;
  const p = n.clientCode ? db.prepare('SELECT * FROM proposals WHERE client_code = ?').get(n.clientCode)
    : (b.proposalId ? db.prepare('SELECT * FROM proposals WHERE proposal_id = ?').get(b.proposalId) : null);
  if (!p) return 'sem proposta correlacionada';
  if (n.status !== 'CONFIRMED') {
    db.prepare("UPDATE proposals SET status = 'RESOURCE_ERROR', last_error = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(b.error || null), p.id);
    return `proposta ${p.id}: erro na criação da conta`;
  }
  const acc = b.account && typeof b.account === 'object' ? b.account : { account: b.account, branch: b.branch };
  if (acc && acc.account) {
    db.prepare('INSERT OR IGNORE INTO accounts (user_id, branch, account) VALUES (?, ?, ?)').run(p.user_id, String(acc.branch || '0001'), String(acc.account));
  }
  db.prepare("UPDATE proposals SET status = 'RESOURCE_CREATED', updated_at = datetime('now') WHERE id = ?").run(p.id);
  return `proposta ${p.id}: conta criada${acc && acc.account ? ' e vinculada' : ' (sem número no evento)'}`;
}

function onPixPaymentOut(n) {
  const t = (n.clientCode && db.prepare("SELECT * FROM transactions WHERE client_code = ? AND kind = 'PIX_OUT'").get(n.clientCode))
    || (n.endToEndId && db.prepare("SELECT * FROM transactions WHERE end_to_end_id = ? AND kind = 'PIX_OUT'").get(n.endToEndId));
  if (!t) return 'sem transação correlacionada';
  if (!['CONFIRMED', 'ERROR'].includes(n.status)) return `transação ${t.id}: status ${n.status} ignorado`;
  const err = n.body.error || null;
  db.prepare("UPDATE transactions SET status = ?, error_code = ?, end_to_end_id = COALESCE(end_to_end_id, ?), celcoin_id = COALESCE(celcoin_id, ?), updated_at = datetime('now') WHERE id = ?")
    .run(n.status, n.status === 'ERROR' ? (err && (err.errorCode || err.code)) || 'ERROR' : null, n.endToEndId, n.body.id || null, t.id);
  return `transação ${t.id}: ${n.status}`;
}

// Recebimento: grava uma vez por endToEndId e confere o valor integral contra o QR gerado pelo app.
function onPixPaymentIn(n) {
  const b = n.body;
  const credit = b.creditParty || {};
  const account = credit.account || b.account;
  if (!n.endToEndId) return 'recebimento sem endToEndId: não gravado';
  if (n.status && n.status !== 'CONFIRMED') return `recebimento ${n.status}: não gravado`;
  const owner = accountOwner(account);
  const amount = Number(b.amount) || 0;
  // Só pagamentos de QR (STATIC_QRCODE) são conferidos contra uma cobrança gerada pelo app, pela
  // chave e conta recebedoras; o QR estático tem txid "***", então a cobrança mais recente com o
  // mesmo valor vale primeiro, e na falta dela a mais recente com valor fixo.
  let charge = null;
  if (credit.key && /QRCODE/i.test(String(b.initiationType || ''))) {
    charge = db.prepare('SELECT * FROM pix_charges WHERE key = ? AND account = ? AND amount IS NOT NULL ORDER BY (abs(amount - ?) < 0.005) DESC, id DESC LIMIT 1')
      .get(String(credit.key), String(account), amount);
  }
  const expected = charge && charge.amount != null ? Number(charge.amount) : null;
  const ok = expected == null ? null : (Math.abs(expected - amount) < 0.005 ? 1 : 0);
  const info = db.prepare(`INSERT OR IGNORE INTO pix_receipts (user_id, account, end_to_end_id, celcoin_id, amount, initiation_type, charge_id, expected_amount, amount_ok, payer_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(owner ? owner.user_id : null, String(account || ''), n.endToEndId, b.id || null, amount, b.initiationType || null,
    charge ? charge.id : null, expected, ok, JSON.stringify(b.debitParty || {}));
  if (!info.changes) return 'recebimento já registrado (duplicado)';
  if (ok === 0) return `recebimento de ${amount} DIFERENTE do valor cobrado (${expected}): não tratado como pagamento da cobrança`;
  return `recebimento de ${amount}${ok === 1 ? ' com o valor integral da cobrança' : ''}${owner ? '' : ' (conta fora do app)'}`;
}

function onPixReversalOut(n) {
  const r = (n.clientCode && db.prepare('SELECT * FROM pix_reversals WHERE client_code = ?').get(n.clientCode))
    || (n.body.id && db.prepare('SELECT * FROM pix_reversals WHERE celcoin_id = ?').get(n.body.id));
  if (!r) return 'sem devolução correlacionada';
  const err = n.body.error || null;
  db.prepare("UPDATE pix_reversals SET status = ?, error_code = ?, updated_at = datetime('now') WHERE id = ?")
    .run(n.status === 'CONFIRMED' ? 'CONFIRMED' : n.status === 'ERROR' ? 'ERROR' : r.status, err && (err.errorCode || err.code), r.id);
  return `devolução ${r.id}: ${n.status}`;
}

// Devolução recebida de um Pix que o app enviou (o recebedor devolveu).
function onPixReversalIn(n) {
  const e2e = n.body.originalEndToEndId || n.body.endToEndIdOriginal || n.endToEndId;
  const t = e2e && db.prepare("SELECT * FROM transactions WHERE end_to_end_id = ? AND kind = 'PIX_OUT'").get(e2e);
  if (!t) return 'sem Pix enviado correlacionado';
  const c = JSON.parse(t.counterpart_json || '{}');
  c.reversal = { amount: Number(n.body.amount) || null, status: n.status, at: n.createTimestamp };
  db.prepare("UPDATE transactions SET counterpart_json = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(c), t.id);
  return `Pix enviado ${t.id}: devolução recebida (${n.status})`;
}

const HANDLERS = {
  'onboarding-create': onOnboardingCreate,
  'pix-payment-out': onPixPaymentOut,
  'pix-payment-in': onPixPaymentIn,
  'pix-reversal-out': onPixReversalOut,
  'pix-reversal-in': onPixReversalIn,
};

// Trata um evento. Devolve { stored, duplicate, outcome }. Nunca lança por evento desconhecido:
// a Celcoin precisa de 200 e o evento fica guardado para conferência.
function handle(raw, source = 'endpoint', receivedAt) {
  const n = normalize(raw);
  if (!n.entity) return { stored: false, duplicate: false, outcome: 'evento sem entity: ignorado' };
  const id = eventKey(n);
  const ins = db.prepare('INSERT OR IGNORE INTO baas_events (id, entity, status, end_to_end_id, client_code, source, received_at, data_json) VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, datetime(\'now\')), ?)')
    .run(id, n.entity, n.status || null, n.endToEndId, n.clientCode, source, receivedAt || null, JSON.stringify(raw));
  if (!ins.changes) {
    log(n, source, 'duplicado: ignorado');
    return { stored: false, duplicate: true, outcome: 'duplicado' };
  }
  let outcome;
  try {
    outcome = HANDLERS[n.entity] ? HANDLERS[n.entity](n) : 'entidade sem tratamento no app (guardada)';
  } catch (e) {
    outcome = `falha ao aplicar: ${e.message}`;
  }
  db.prepare('UPDATE baas_events SET outcome = ? WHERE id = ?').run(outcome, id);
  log(n, source, outcome, raw);
  return { stored: true, duplicate: false, outcome };
}

function log(n, source, outcome, raw) {
  const ref = n.endToEndId || n.clientCode || '';
  console.log(`[webhook] ${n.entity} ${n.status || '-'} ${ref ? evidence.mask({ ref }).ref : ''} via ${source}: ${outcome}`);
  if (raw) evidence.record({ mode: MODE, method: 'WEBHOOK', path: `aviso do BaaS recebido (${n.entity}) via ${source}`, status: 200, resBody: { tratamento: outcome, evento: raw } });
}

// Autenticação básica opcional do endpoint (a mesma cadastrada no auth do webhook na Celcoin).
function checkAuth(req) {
  const user = process.env.CELCOIN_WEBHOOK_USER, pass = process.env.CELCOIN_WEBHOOK_PASSWORD;
  if (!user && !pass) return true;
  const h = String(req.headers.authorization || '');
  if (!h.startsWith('Basic ')) return false;
  const [u, p] = Buffer.from(h.slice(6), 'base64').toString('utf8').split(':');
  return u === user && p === pass;
}

// POST /webhooks/celcoin: grava, responde 200 e só então o evento é considerado entregue.
function endpoint(req, res) {
  if (!checkAuth(req)) return res.status(401).json({ success: false });
  const list = Array.isArray(req.body) ? req.body : [req.body];
  const results = list.map((ev) => handle(ev, 'endpoint'));
  res.status(200).json({ success: true, received: results.length });
}

module.exports = { handle, endpoint, normalize, eventKey };
