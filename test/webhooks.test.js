// Webhooks do BaaS, status/encerramento de conta, devolução, QR dinâmico (COB/COBV) e
// ferramentas administrativas, em MODO SIMULADO. Roda com: npm test
process.env.CELCOIN_MODE = 'mock';
process.env.DATABASE_FILE = ':memory:';
process.env.CELCOIN_MIN_QUERY_INTERVAL_MS = '0';
process.env.DDA_EVENTS_INTERVAL_MS = '0';

const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../server');
const db = require('../src/db');
const mock = require('../src/celcoin-mock');
const webhooks = require('../src/webhooks');

let server, root, cookie = '';
async function call(method, path, body, headers = {}) {
  const res = await fetch(root + path, { method, headers: { 'Content-Type': 'application/json', cookie, ...headers }, body: body ? JSON.stringify(body) : undefined });
  const set = res.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0];
  return { status: res.status, data: await res.json().catch(() => ({})) };
}
const person = (cpf, phone, email) => ({
  cpf, fullName: 'Teste Webhook Completo', birthDate: '1991-02-03', motherName: 'Maria Teste', email, phone, isPep: false,
  address: { postalCode: '01001000', street: 'Praça da Sé', number: '1', neighborhood: 'Sé', city: 'São Paulo', state: 'SP' },
  password: 'senhaForte1', txPassword: '1234',
});
async function newAccount(cpf, phone, email) {
  cookie = '';
  const r = await call('POST', '/api/onboarding/pf', person(cpf, phone, email));
  assert.equal(r.status, 200, JSON.stringify(r.data));
  await call('POST', '/api/dev/approve-documentscopy');
  const s = await call('GET', '/api/onboarding/status');
  assert.ok(s.data.account, JSON.stringify(s.data));
  return s.data.account.account;
}
// CRC16 do BR Code, para montar QR dinâmicos válidos no teste.
const crc = (str) => { let c = 0xFFFF; for (const ch of Buffer.from(str, 'utf8')) { c ^= ch << 8; for (let i = 0; i < 8; i++) c = (c & 0x8000) ? ((c << 1) ^ 0x1021) & 0xFFFF : (c << 1) & 0xFFFF; } return c.toString(16).toUpperCase().padStart(4, '0'); };
const f = (id, v) => `${id}${String(v.length).padStart(2, '0')}${v}`;
function dynamicEmv(url) {
  const base = f('00', '01') + f('01', '12') + f('26', f('00', 'br.gov.bcb.pix') + f('25', url)) + f('52', '0000') + f('53', '986') + f('58', 'BR') + f('59', 'Cobrador Teste') + f('60', 'Barueri') + f('62', f('05', '***')) + '6304';
  return base + crc(base);
}

test.before(async () => {
  await new Promise((r) => { server = app.listen(0, r); });
  root = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

test('endpoint de webhook: responde 200, grava e deduplica pelo endToEndId', async () => {
  const ev = { entity: 'pix-payment-in', status: 'CONFIRMED', createTimestamp: '2026-11-11T19:00:00', body: { id: 'x1', amount: 5, endToEndId: 'E00000000202611111900AAAA', creditParty: { account: '999', key: 'k1' }, debitParty: { name: 'Pagador' }, initiationType: 'DICT' } };
  let r = await call('POST', '/webhooks/celcoin', ev);
  assert.equal(r.status, 200);
  assert.equal(r.data.success, true);
  r = await call('POST', '/webhooks/celcoin', ev);
  assert.equal(r.status, 200, 'repetição também recebe 200');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM baas_events WHERE end_to_end_id = ?').get(ev.body.endToEndId).n, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM pix_receipts WHERE end_to_end_id = ?').get(ev.body.endToEndId).n, 1);
  // entidade sem tratamento: guardada e respondida com 200
  r = await call('POST', '/webhooks/celcoin', { entity: 'launch-in', status: 'CONFIRMED', body: { id: 'l1', amount: 1 } });
  assert.equal(r.status, 200);
});

test('endpoint de webhook: autenticação básica quando configurada', async () => {
  process.env.CELCOIN_WEBHOOK_USER = 'u'; process.env.CELCOIN_WEBHOOK_PASSWORD = 'p';
  try {
    let r = await call('POST', '/webhooks/celcoin', { entity: 'launch-in', body: { id: 'a1' } });
    assert.equal(r.status, 401);
    r = await call('POST', '/webhooks/celcoin', { entity: 'launch-in', body: { id: 'a2' } }, { authorization: `Basic ${Buffer.from('u:p').toString('base64')}` });
    assert.equal(r.status, 200);
  } finally { delete process.env.CELCOIN_WEBHOOK_USER; delete process.env.CELCOIN_WEBHOOK_PASSWORD; }
});

test('pix-payment-out: confirma e rejeita a transação pelo clientCode (sem consultar status)', async () => {
  await newAccount('529.982.247-25', '11987650101', 'wh1@example.com');
  await call('POST', '/api/dev/credit', { amount: 100 });
  let r = await call('POST', '/api/pix/lookup', { key: 'testepix@celcoin.com.br' });
  r = await call('POST', '/api/pix/transfer', { lookupId: r.data.lookupId, amount: 3, txPassword: '1234' });
  const t = db.prepare('SELECT * FROM transactions WHERE id = ?').get(r.data.txId);
  webhooks.handle({ entity: 'pix-payment-out', status: 'CONFIRMED', body: { id: t.celcoin_id, clientCode: t.client_code, endToEndId: t.end_to_end_id, amount: 3 } }, 'endpoint');
  assert.equal(db.prepare('SELECT status FROM transactions WHERE id = ?').get(t.id).status, 'CONFIRMED');
  r = await call('GET', `/api/pix/transfer/${t.id}`);
  assert.equal(r.data.status, 'CONFIRMED');

  r = await call('POST', '/api/pix/lookup', { key: 'testepix@celcoin.com.br' });
  r = await call('POST', '/api/pix/transfer', { lookupId: r.data.lookupId, amount: 2, txPassword: '1234' });
  const t2 = db.prepare('SELECT * FROM transactions WHERE id = ?').get(r.data.txId);
  webhooks.handle({ entity: 'pix-payment-out', status: 'ERROR', body: { clientCode: t2.client_code, endToEndId: t2.end_to_end_id, error: { errorCode: 'CBE123', message: 'saldo' } } }, 'webhook.site');
  r = await call('GET', `/api/pix/transfer/${t2.id}`);
  assert.equal(r.data.status, 'ERROR');
  assert.match(r.data.errorMessage, /Saldo insuficiente/);
});

test('pix-payment-in: confere o valor integral do QR gerado e permite devolver (pix-reversal-out)', async () => {
  const acc = await newAccount('111.444.777-35', '11987650111', 'wh2@example.com');
  await call('POST', '/api/pix/keys/evp');
  const key = (await call('GET', '/api/pix/keys')).data.keys[0].key;
  let r = await call('POST', '/api/pix/qrcode', { amount: 10 });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  webhooks.handle({ entity: 'pix-payment-in', status: 'CONFIRMED', body: { id: 'in-1', amount: 10, endToEndId: 'E1111', initiationType: 'STATIC_QRCODE', creditParty: { account: acc, key }, debitParty: { name: 'Fulano' } } });
  webhooks.handle({ entity: 'pix-payment-in', status: 'CONFIRMED', body: { id: 'in-2', amount: 9.5, endToEndId: 'E2222', initiationType: 'STATIC_QRCODE', creditParty: { account: acc, key }, debitParty: { name: 'Beltrano' } } });
  r = await call('GET', '/api/pix/receipts');
  const byE2e = Object.fromEntries(r.data.receipts.map((x) => [x.endToEndId, x]));
  assert.equal(byE2e.E1111.amountOk, true);
  assert.equal(byE2e.E2222.amountOk, false, 'valor diferente do cobrado é sinalizado');
  assert.equal(byE2e.E2222.expectedAmount, 10);

  r = await call('POST', `/api/pix/receipts/${byE2e.E2222.id}/refund`, { txPassword: '0000' });
  assert.equal(r.data.error, 'INVALID_TX_PASSWORD');
  r = await call('POST', `/api/pix/receipts/${byE2e.E2222.id}/refund`, { amount: 20, txPassword: '1234' });
  assert.equal(r.data.error, 'AMOUNT_TOO_HIGH');
  r = await call('POST', `/api/pix/receipts/${byE2e.E2222.id}/refund`, { txPassword: '1234', reason: 'MD06' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.status, 'PROCESSING');
  const rev = db.prepare('SELECT * FROM pix_reversals WHERE id = ?').get(r.data.id);
  webhooks.handle({ entity: 'pix-reversal-out', status: 'CONFIRMED', body: { id: rev.celcoin_id, clientCode: rev.client_code, amount: 9.5 } });
  r = await call('GET', `/api/pix/reversals/${rev.id}`);
  assert.equal(r.data.status, 'CONFIRMED');
});

test('onboarding-create: o aviso vincula a conta à proposta pelo clientCode', async () => {
  cookie = '';
  const r = await call('POST', '/api/onboarding/pf', person('390.533.447-05', '11987650121', 'wh3@example.com'));
  assert.equal(r.status, 200);
  const p = db.prepare('SELECT * FROM proposals ORDER BY id DESC LIMIT 1').get();
  const out = webhooks.handle({ entity: 'onboarding-create', status: 'CONFIRMED', body: { onboardingId: p.proposal_id, clientCode: p.client_code, account: { branch: '0001', account: '77700011' } } });
  assert.match(out.outcome, /conta criada e vinculada/);
  const s = await call('GET', '/api/onboarding/status');
  assert.equal(s.data.status, 'RESOURCE_CREATED');
  assert.equal(s.data.account.account, '77700011');
});

test('conta: bloquear, desbloquear e encerrar (saldo zero) conferindo pela releitura', async () => {
  await newAccount('153.509.460-56', '11987650131', 'wh4@example.com');
  let r = await call('PUT', '/api/account/status', { action: 'bloquear', reason: 'teste QA', txPassword: '1234' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.statusAccount, 'BLOQUEADO');
  assert.equal(r.data.confirmed, true);
  r = await call('PUT', '/api/account/status', { action: 'desbloquear', reason: 'teste QA', txPassword: '1234' });
  assert.equal(r.data.statusAccount, 'ATIVO');
  await call('POST', '/api/dev/credit', { amount: 1 });
  r = await call('DELETE', '/api/account', { reason: 'teste QA', txPassword: '1234' });
  assert.equal(r.data.error, 'BALANCE_NOT_ZERO');
});

test('conta sem saldo: encerramento pela Celcoin', async () => {
  await newAccount('714.602.380-01', '11987650141', 'wh5@example.com');
  const r = await call('DELETE', '/api/account', { reason: 'teste QA', txPassword: '1234' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.statusAccount, 'ENCERRADO');
});

test('QR dinâmico: COB carrega o payload pela URL; COBV usa o valor final com multa e juros', async () => {
  const acc = await newAccount('10000000019', '11987650151', 'wh6@example.com');
  await call('POST', '/api/dev/credit', { amount: 500 });
  const cobUrl = 'qrcode-h.pix.celcoin.com.br/pixqrcode/v2/cob123';
  mock.registerDynamicQr(cobUrl, () => ({ status: 'ACTIVE', key: 'fc048fc5-925f-405d-bfd7-8d3117f9f53c', transactionIdentification: 'kk6g232xel65a0daee4dd13kk4000177597',
    amount: { original: 10, final: 10, canModifyFinalAmount: false }, calendar: { expiration: 3600 } }));
  let r = await call('POST', '/api/pix/emv', { emv: dynamicEmv(cobUrl) });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.qrType, 'DYNAMIC');
  assert.equal(r.data.cobKind, 'COB');
  assert.equal(r.data.amount, 10);
  r = await call('POST', '/api/pix/transfer', { lookupId: r.data.lookupId, amount: 10, txPassword: '1234' });
  const pay = [...mock.state.payments.values()].pop();
  assert.equal(pay.initiationType, 'DYNAMIC_QRCODE');
  assert.equal(pay.transactionIdentification, 'kk6g232xel65a0daee4dd13kk4000177597');
  assert.equal(pay.debitParty.account, acc);

  const cobvUrl = 'qrcode-h.pix.celcoin.com.br/pixqrcode/v2/cobv/abc';
  mock.registerDynamicQr(cobvUrl, () => ({ status: 'ACTIVE', key: 'fc048fc5-925f-405d-bfd7-8d3117f9f53c', transactionIdentification: 'cobvtxid000000000000000000001',
    amount: { original: 100, fine: 2, interest: 0.5, discount: 0, abatement: 0, final: 102.5, canModifyFinalAmount: false }, calendar: { dueDate: '2026-11-10' } }));
  r = await call('POST', '/api/pix/emv', { emv: dynamicEmv(cobvUrl) });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.cobKind, 'COBV');
  assert.equal(r.data.amount, 102.5);
  assert.equal(r.data.breakdown.fine, 2);
  const look = r.data.lookupId;
  r = await call('POST', '/api/pix/transfer', { lookupId: look, amount: 100, txPassword: '1234' });
  assert.equal(r.data.error, 'AMOUNT_LOCKED', 'COBV não aceita o valor original sem os encargos');
  // cobrança expirada: a Celcoin recusa o payload e o app não segue para o pagamento
  r = await call('POST', '/api/pix/emv', { emv: dynamicEmv('qrcode-h.pix.celcoin.com.br/pixqrcode/v2/expirado') });
  assert.notEqual(r.status, 200);
});

test('ferramenta administrativa: lista contas e consulta webhooks pelo cliente do app', async () => {
  const admin = require('../tools/celcoin-admin');
  const logs = [];
  const orig = console.log; console.log = (...a) => logs.push(a.join(' '));
  try {
    await admin.main(['contas', '2026-11-01', '2026-11-30']);
    await admin.main(['webhooks-dda', 'cadastrar', 'https://exemplo.invalid/dda']); // sem --sim: não escreve
    await admin.main(['webhooks-dda', 'cadastrar', 'https://exemplo.invalid/dda', '--sim']);
    await admin.main(['webhooks-dda', 'listar']);
  } finally { console.log = orig; }
  assert.match(logs[0], /Contas PF/);
  assert.match(logs[0], /accounts/);
  assert.match(logs[1], /Repita com --sim/);
  assert.ok(logs.some((l) => /subscription/.test(l)), 'lista os três eventos do DDA');
});
