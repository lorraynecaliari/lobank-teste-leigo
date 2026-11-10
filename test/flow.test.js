// Teste de ponta a ponta do backend em MODO SIMULADO (sem Celcoin real).
// Roda com: npm test
process.env.CELCOIN_MODE = 'mock';
process.env.DATABASE_FILE = ':memory:';
// O intervalo de 10 s entre consultas tem teste próprio (throttle.test.js); aqui o fluxo roda sem espera.
process.env.CELCOIN_MIN_QUERY_INTERVAL_MS = '0';

const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../server');

let server, base, cookie = '';

async function call(method, path, body) {
  const res = await fetch(base + path, {
    method, headers: { 'Content-Type': 'application/json', cookie }, body: body ? JSON.stringify(body) : undefined,
  });
  const set = res.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0];
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

const person = (phone) => ({
  cpf: '443.341.912-58', fullName: 'Teste Fluxo Completo', birthDate: '1990-05-15', motherName: 'Maria Teste', email: 'fluxo@example.com',
  phone, isPep: false, income: 'Até R$ 5.000', assets: 'Até R$ 50.000', profession: 'Analista',
  address: { postalCode: '01001000', street: 'Praça da Sé', number: '1', neighborhood: 'Sé', city: 'São Paulo', state: 'SP' },
  password: 'senhaForte1', txPassword: '1234',
});

test.before(async () => {
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
test.after(() => server.close());

test('rotas de dinheiro recusam sem sessão', async () => {
  const r = await call('GET', '/balance');
  assert.equal(r.status, 401);
});

test('valida o cadastro antes de chamar a Celcoin', async () => {
  const bad = await call('POST', '/onboarding/pf', { ...person('11987650001'), cpf: '111.111.111-11' });
  assert.equal(bad.data.error, 'INVALID_CPF');
  const weak = await call('POST', '/onboarding/pf', { ...person('11987650001'), password: 'abc' });
  assert.equal(weak.data.error, 'WEAK_PASSWORD');
});

test('fluxo completo: cadastro, documentoscopia, conta, chave, saldo, Pix, QR e extrato', async () => {
  let r = await call('POST', '/onboarding/pf', person('11987650001'));
  assert.equal(r.status, 200, JSON.stringify(r.data));

  // Sem conta: estado de primeira classe, rotas de dinheiro recusam.
  r = await call('GET', '/balance');
  assert.equal(r.status, 409);
  assert.equal(r.data.error, 'NO_ACCOUNT');

  r = await call('GET', '/onboarding/status');
  assert.equal(r.data.status, 'PENDING_DOCUMENTSCOPY');
  assert.match(r.data.documentscopyUrl, /cadastro\.io/);

  await call('POST', '/dev/approve-documentscopy');
  r = await call('GET', '/onboarding/status');
  assert.equal(r.data.status, 'RESOURCE_CREATED');
  assert.ok(r.data.account && r.data.account.account);

  r = await call('GET', '/balance');
  assert.equal(r.data.amount, 0);

  // QR Code sem chave: recusado com orientação.
  r = await call('POST', '/pix/qrcode', { amount: 10 });
  assert.equal(r.data.error, 'NO_KEY');

  // Conta sem chave: sandbox devolve 404 CBE180; o app mostra lista vazia.
  r = await call('GET', '/pix/keys');
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.deepEqual(r.data.keys, []);

  r = await call('POST', '/pix/keys/evp');
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.type, 'EVP');
  r = await call('POST', '/pix/keys/evp');
  assert.equal(r.status, 409);

  // Excluir: chave de outra conta é recusada; a própria some e pode ser recriada.
  r = await call('DELETE', '/pix/keys/nao-e-minha');
  assert.equal(r.status, 404);
  const evpKey = (await call('GET', '/pix/keys')).data.keys[0].key;
  r = await call('DELETE', '/pix/keys/' + encodeURIComponent(evpKey));
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.deepEqual((await call('GET', '/pix/keys')).data.keys, []);
  r = await call('POST', '/pix/keys/evp');
  assert.equal(r.status, 200);

  r = await call('POST', '/pix/qrcode', { amount: 25.5, description: 'Pedido 1' });
  assert.equal(r.status, 200);
  assert.match(r.data.emv, /^000201/);
  assert.match(r.data.svg, /<svg/);

  // Chave inexistente
  r = await call('POST', '/pix/lookup', { key: 'naoexiste@example.com' });
  assert.equal(r.data.error, 'CBE180');

  // Saldo insuficiente é avisado antes de enviar.
  r = await call('POST', '/pix/lookup', { key: 'testepix@celcoin.com.br' });
  assert.ok(r.data.lookupId);
  let lookupId = r.data.lookupId;
  r = await call('POST', '/pix/transfer', { lookupId, amount: 10, txPassword: '1234' });
  assert.equal(r.data.error, 'INSUFFICIENT_BALANCE');

  // Senha de transferência errada
  await call('POST', '/dev/credit', { amount: 100 });
  r = await call('POST', '/pix/transfer', { lookupId, amount: 10, txPassword: '9999' });
  assert.equal(r.data.error, 'INVALID_TX_PASSWORD');

  r = await call('POST', '/pix/transfer', { lookupId, amount: 10, txPassword: '1234', message: 'teste' });
  assert.equal(r.data.status, 'PROCESSING');
  const txId = r.data.txId;

  // O endToEndId não se reaproveita.
  r = await call('POST', '/pix/transfer', { lookupId, amount: 10, txPassword: '1234' });
  assert.equal(r.data.error, 'LOOKUP_EXPIRED');

  // "PROCESSING" não é sucesso: o extrato mostra como em processamento.
  r = await call('GET', '/statement');
  assert.ok(r.data.movements.some((m) => m.pending));

  await new Promise((res) => setTimeout(res, 1700));
  r = await call('GET', `/pix/transfer/${txId}`);
  assert.equal(r.data.status, 'CONFIRMED');

  r = await call('GET', '/balance');
  assert.equal(r.data.amount, 90);
  r = await call('GET', '/statement');
  assert.ok(r.data.movements.some((m) => m.type === 'PIXPAYMENTOUT' && m.txId === txId && !m.pending));


  // Extrato: janela de no máximo 7 dias
  r = await call('GET', '/statement?from=2026-11-01&to=2026-11-10');
  assert.equal(r.data.error, 'PERIOD_TOO_LONG');
  r = await call('GET', '/statement?from=2026-11-04&to=2026-11-10');
  assert.equal(r.status, 200);
  assert.equal(r.data.from, '2026-11-04');
  r = await call('GET', '/statement?from=2026-11-10&to=2026-11-04');
  assert.equal(r.data.error, 'INVALID_PERIOD');

  // Login e logout
  await call('POST', '/auth/logout');
  r = await call('GET', '/me');
  assert.equal(r.status, 401);
  r = await call('POST', '/auth/login', { document: '44334191258', password: 'errada123' });
  assert.equal(r.status, 401);
  r = await call('POST', '/auth/login', { document: '443.341.912-58', password: 'senhaForte1' });
  assert.equal(r.status, 200);
  r = await call('GET', '/me');
  assert.equal(r.data.account.account.length > 0, true);
});

test('telefone final 2: proposta reprovada', async () => {
  cookie = '';
  let r = await call('POST', '/onboarding/pf', { ...person('11987650002'), cpf: '345.418.961-68', email: 'f2@example.com' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  r = await call('GET', '/onboarding/status');
  assert.equal(r.data.status, 'REPROVED');
  assert.equal(r.data.account, null);
});
