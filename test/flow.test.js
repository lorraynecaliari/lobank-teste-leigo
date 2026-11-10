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

test('cadastro PJ: valida, documentoscopia de quem preenche, conta por fetch-business', async () => {
  cookie = '';
  const addr = { postalCode: '06455030', street: 'Alameda Xingu', number: '350', neighborhood: 'Alphaville', city: 'Barueri', state: 'SP' };
  const filler = { fullName: 'Ana Responsável Teste', cpf: '908.301.661-73', birthDate: '1985-03-10', motherName: 'Maria Teste', phone: '11987650011', email: 'ana@example.com', isPep: false, address: addr };
  const partner = { fullName: 'Bruno Sócio Teste', cpf: '318.609.139-03', birthDate: '1980-07-01', motherName: 'Joana Teste', phone: '11987650021', email: 'bruno@example.com', share: '40', isPep: false, address: addr };
  const base = { cnpj: '52.601.815/0001-20', companyKind: 'LTDA', businessName: 'Padaria Teste LTDA', tradingName: 'Padaria Teste', revenue: 'até R$ 81 mil',
    businessEmail: 'contato@padaria.example.com', businessPhone: '11987650031', businessAddress: addr, fillerRole: 'socio', filler, partners: [partner],
    password: 'senhaForte1', txPassword: '1234' };

  let r = await call('POST', '/onboarding/pj', { ...base, cnpj: '11.111.111/1111-11' });
  assert.equal(r.data.error, 'INVALID_CNPJ');
  r = await call('POST', '/onboarding/pj', { ...base, partners: [{ ...partner, cpf: filler.cpf }] });
  assert.equal(r.data.error, 'DUPLICATE_PARTNER');
  r = await call('POST', '/onboarding/pj', { ...base, partners: [{ ...partner, motherName: '' }] });
  assert.equal(r.data.error, 'INVALID_MOTHER');

  r = await call('POST', '/onboarding/pj', base);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  r = await call('GET', '/onboarding/status');
  assert.equal(r.data.status, 'PENDING_DOCUMENTSCOPY');
  // Como no sandbox: uma validação só, de quem preenche (1º owner), mesmo com 2 sócios.
  assert.equal(r.data.documentscopies.length, 1);
  assert.equal(r.data.documentscopies[0].name, 'Ana Responsável Teste');

  await call('POST', '/dev/approve-documentscopy');
  r = await call('GET', '/onboarding/status');
  assert.equal(r.data.status, 'RESOURCE_CREATED');
  assert.ok(r.data.account && r.data.account.account);
  r = await call('GET', '/me');
  assert.equal(r.data.personType, 'PJ');
  assert.equal(r.data.name, 'Padaria Teste');

  // login por CNPJ
  await call('POST', '/auth/logout');
  r = await call('POST', '/auth/login', { document: '52601815000120', password: 'senhaForte1' });
  assert.equal(r.status, 200);
});

test('Pix Copia e Cola e Pix por agência e conta (MANUAL)', async () => {
  cookie = '';
  let r = await call('POST', '/onboarding/pf', { ...person('11987650041'), cpf: '908.301.661-73', email: 'cc@example.com' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  await call('POST', '/dev/approve-documentscopy');
  await call('GET', '/onboarding/status');
  await call('POST', '/dev/credit', { amount: 500 });

  // código inválido
  r = await call('POST', '/pix/emv', { emv: 'isso não é um pix' });
  assert.equal(r.data.error, 'INVALID_EMV');
  // QR estático com valor fixo de R$ 10
  const emv = '00020126580014br.gov.bcb.pix0136af83d12a-d4ca-4cdf-974b-37d25ad2477f520400005303986540510.005802BR5916Lorrayne Caliari6007Barueri61080645503062070503***630486EE';
  r = await call('POST', '/pix/emv', { emv });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.amount, 10);
  assert.equal(r.data.amountLocked, true);
  assert.equal(r.data.qrType, 'STATIC');
  const lookupId = r.data.lookupId;
  // código com espaços internos (descrição e nome): não pode perder os espaços
  r = await call('POST', '/pix/emv', { emv: '00020126690014br.gov.bcb.pix0136af83d12a-d4ca-4cdf-974b-37d25ad2477f0207Teste C52040000530398654047.005802BR5916Lorrayne Caliari6007Barueri61080645503062070503***63043DCC\n' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.amount, 7);
  r = await call('POST', '/pix/transfer', { lookupId, amount: 15, txPassword: '1234' });
  assert.equal(r.data.error, 'AMOUNT_LOCKED');
  r = await call('POST', '/pix/transfer', { lookupId, amount: 10, txPassword: '1234' });
  assert.equal(r.status, 200, JSON.stringify(r.data));

  // agência e conta
  r = await call('GET', '/pix/participants');
  assert.ok(r.data.participants.some((p) => p.ispb === '60701190'));
  r = await call('POST', '/pix/manual', { ispb: '60701190', branch: '1234', account: '123456', accountType: 'CACC', taxId: '318.609.139-03', name: 'Bruno Destino' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.bankName, 'ITAÚ UNIBANCO S.A.');
  r = await call('POST', '/pix/transfer', { lookupId: r.data.lookupId, amount: 20, txPassword: '1234' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const txId = r.data.txId;
  await new Promise((ok) => setTimeout(ok, 1700));
  r = await call('GET', '/pix/transfer/' + txId);
  assert.equal(r.data.status, 'CONFIRMED');
  assert.equal(r.data.counterpart.via, 'MANUAL');
  assert.match(r.data.endToEndId, /^E13935893/);

  r = await call('POST', '/pix/manual', { ispb: '60701190', branch: '1234', account: '123456', accountType: 'XXXX', taxId: '318.609.139-03', name: 'Bruno' });
  assert.equal(r.data.error, 'INVALID_ACCOUNT_TYPE');
});

test('Minha conta: atualizar dados na Celcoin e trocar senhas', async () => {
  cookie = '';
  await call('POST', '/auth/login', { document: '90830166173', password: 'senhaForte1' });
  let r = await call('GET', '/me/details');
  assert.equal(r.status, 200);
  assert.equal(r.data.personType, 'PF');
  const address = { postalCode: '06455030', street: 'Alameda Xingu', number: '99', neighborhood: 'Alphaville', city: 'Barueri', state: 'SP' };
  r = await call('PUT', '/me', { email: 'novo@example.com', phone: '11912345678', address });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  r = await call('GET', '/me/details');
  assert.equal(r.data.email, 'novo@example.com');
  assert.equal(r.data.address.number, '99');
  r = await call('PUT', '/me', { email: 'x', phone: '11912345678', address });
  assert.equal(r.data.error, 'INVALID_EMAIL');

  r = await call('POST', '/me/passwords', { kind: 'tx', current: 'errada', next: '9999' });
  assert.equal(r.status, 401);
  r = await call('POST', '/me/passwords', { kind: 'tx', current: 'senhaForte1', next: '9999' });
  assert.equal(r.status, 200);
  r = await call('POST', '/me/passwords', { kind: 'login', current: 'senhaForte1', next: 'outraSenha2' });
  assert.equal(r.status, 200);
  await call('POST', '/auth/logout');
  r = await call('POST', '/auth/login', { document: '90830166173', password: 'outraSenha2' });
  assert.equal(r.status, 200);
});

test('PJ MEI: um único titular, sem sócios', async () => {
  cookie = '';
  const addr = { postalCode: '06455030', street: 'Alameda Xingu', number: '1', neighborhood: 'Alphaville', city: 'Barueri', state: 'SP' };
  const filler = { fullName: 'Carla Titular Teste', cpf: '318.609.139-03', birthDate: '1985-03-10', motherName: 'Maria Teste', phone: '11987650061', email: 'carla@example.com', address: addr };
  const base = { cnpj: '11.222.333/0001-81', companyKind: 'MEI', businessName: 'Carla MEI', tradingName: 'Carla', businessEmail: 'mei@example.com', businessPhone: '11987650071',
    businessAddress: addr, fillerRole: 'socio', filler, partners: [], password: 'senhaForte1', txPassword: '1234' };
  let r = await call('POST', '/onboarding/pj', { ...base, partners: [{ ...filler, cpf: '908.301.661-73' }] });
  assert.equal(r.data.error, 'MEI_SINGLE_OWNER');
  r = await call('POST', '/onboarding/pj', { ...base, fillerRole: 'representante' });
  assert.equal(r.data.error, 'MEI_SINGLE_OWNER');
  r = await call('POST', '/onboarding/pj', base);
  assert.equal(r.status, 200, JSON.stringify(r.data));
});
