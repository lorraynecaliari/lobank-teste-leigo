// Eventos do DDA. A Celcoin só avisa por webhook (adesão, saída e boletos) e não tem consulta.
// O app não tem endereço público, então os webhooks do DDA vão para um webhook.site e o app lê
// de lá pela API pública dele, no máximo a cada DDA_EVENTS_INTERVAL_MS (padrão 10 s).
// Só para o sandbox: o endereço do webhook.site é público.
const db = require('./db');
const { MODE } = require('./celcoin');

const TOKEN = (process.env.DDA_WEBHOOK_SITE_TOKEN || '').trim();
const INTERVAL = Math.max(0, Number(process.env.DDA_EVENTS_INTERVAL_MS ?? process.env.CELCOIN_MIN_QUERY_INTERVAL_MS ?? 10000));
let lastSync = 0;
let lastError = null;

// Os eventos não dizem o tipo: adesão e saída têm o mesmo formato e só o status muda.
function classify(body) {
  if (!body || typeof body !== 'object') return null;
  if (body.registerData) return { type: 'INVOICE', document: body.registerData.payer && body.registerData.payer.documentNumber };
  if (body.subscriptionId && body.status) {
    const st = String(body.status).toUpperCase();
    return { type: st.startsWith('INACTIVE') ? 'DELETION' : 'SUBSCRIPTION', document: body.document };
  }
  return null;
}

function store(id, receivedAt, body) {
  const c = classify(body);
  if (!c) return;
  db.prepare('INSERT OR IGNORE INTO dda_events (id, document, type, received_at, data_json) VALUES (?, ?, ?, ?, ?)')
    .run(String(id), c.document ? String(c.document).replace(/\D/g, '') : null, c.type, receivedAt, JSON.stringify(body));
}

async function fetchWebhookSite() {
  const url = `https://webhook.site/token/${encodeURIComponent(TOKEN)}/requests?sorting=newest&per_page=100`;
  const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`webhook.site respondeu HTTP ${res.status}`);
  const data = await res.json();
  for (const r of data.data || []) {
    let parsed;
    try { parsed = JSON.parse(r.content || ''); } catch (_) { continue; }
    if (parsed && parsed.entity) continue; // eventos do BaaS (Pix, boleto): não são do DDA
    store(r.uuid, r.created_at, parsed && parsed.body);
  }
}

// Busca eventos novos respeitando o intervalo. Devolve { ok, configured, error }.
async function sync() {
  if (MODE === 'mock') {
    for (const e of require('./celcoin-mock').ddaEvents()) store(e.id, e.at, e.body);
    return { ok: true, configured: true };
  }
  if (!TOKEN) return { ok: false, configured: false, error: 'DDA_WEBHOOK_SITE_TOKEN não configurado' };
  if (Date.now() - lastSync < INTERVAL) return { ok: !lastError, configured: true, error: lastError };
  lastSync = Date.now();
  try { await fetchWebhookSite(); lastError = null; } catch (e) { lastError = e.message; }
  return { ok: !lastError, configured: true, error: lastError };
}

const events = (document, type) => db.prepare('SELECT * FROM dda_events WHERE document = ? AND type = ? ORDER BY received_at, rowid')
  .all(document, type).map((e) => ({ ...e, body: JSON.parse(e.data_json) }));

module.exports = { sync, events, classify, configured: () => MODE === 'mock' || !!TOKEN };
