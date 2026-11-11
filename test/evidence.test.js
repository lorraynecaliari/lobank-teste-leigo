// Registro de evidências: máscaras e gravação a partir de um fluxo do app (modo simulado).
const fs = require('fs');
const os = require('os');
const path = require('path');

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'lobank-evid-'));
process.env.CELCOIN_MODE = 'mock';
process.env.DATABASE_FILE = ':memory:';
process.env.CELCOIN_MIN_QUERY_INTERVAL_MS = '0';
process.env.EVIDENCIAS = '1';
process.env.EVIDENCIAS_DIR = DIR;

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const ev = require('../src/evidence');
const app = require('../server');

test('máscaras: documento, conta, chave, nome, contato, endereço e segredos', () => {
  const m = ev.mask({
    documentNumber: '44334191258', taxId: '46013634000180', account: '41174608', key: 'testepix@celcoin.com.br',
    fullName: 'Ana Responsável Teste', email: 'ana.ltda@gmail.com', phoneNumber: '+5531975144531',
    birthDate: '15-03-1990', address: { street: 'Alameda Xingu', number: '100', city: 'Barueri' },
    access_token: 'abc', client_secret: 'xyz', pwd: 'teste', remittanceInformation: 'pago a 44334191258',
    creditParty: { account: '*********', accountType: '***' }, barCode: '23793381286008301352856000063307789840000150000',
  });
  assert.equal(m.documentNumber, '*********58');
  assert.equal(m.taxId, '************80');
  assert.equal(m.account, '*****608');
  assert.equal(m.key, 'te***@celcoin.com.br');
  assert.equal(m.fullName, 'Ana R. T.');
  assert.equal(m.email, 'an***@gmail.com');
  assert.equal(m.phoneNumber, '*********4531');
  assert.equal(m.birthDate, '**-**-1990');
  assert.equal(m.address.street, '***');
  assert.equal(m.address.city, 'Barueri');
  assert.equal(m.access_token, '[removido]');
  assert.equal(m.client_secret, '[removido]');
  assert.equal(m.pwd, '[removido]');
  assert.equal(m.remittanceInformation, 'pago a *********58');
  assert.equal(m.creditParty.account, '*********'); // já mascarado pela Celcoin: fica como veio
  assert.equal(m.barCode, '23793381286008301352856000063307789840000150000'); // massa pública de teste
});

test('rota da Celcoin: conta, e-mail e parâmetros sensíveis mascarados', () => {
  assert.equal(ev.maskPath('/baas/v2/pix/dict/entry/external/41174608?key=testepix@celcoin.com.br'),
    '/baas/v2/pix/dict/entry/external/*****608?key=te***%40celcoin.com.br');
  assert.equal(ev.maskPath('/baas/v2/account/fetch?documentNumber=44334191258'), '/baas/v2/account/fetch?documentNumber=*********58');
  assert.equal(ev.normalizeRoute('GET', '/api/bills/12?x=1'), 'GET /api/bills/:id');
  assert.equal(ev.normalizeRoute('DELETE', '/api/pix/keys/fulano%40ex.com'), 'DELETE /api/pix/keys/:chave');
  assert.equal(ev.normalizeRoute('POST', '/api/pix/keys/evp'), 'POST /api/pix/keys/evp');
  assert.equal(ev.mask({ message: 'CPF 443.341.912-58 e CNPJ 46.013.634/0001-80' }).message, 'CPF *********58 e CNPJ ************80');
});

test('fluxo do app grava evidências mascaradas e marcadas como simuladas', async () => {
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  let cookie = '';
  const call = async (method, p, body) => {
    const res = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', cookie }, body: body ? JSON.stringify(body) : undefined });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    return res.json().catch(() => ({}));
  };
  try {
    await call('POST', '/onboarding/pf', {
      cpf: '443.341.912-58', fullName: 'Teste Evidencia Completo', birthDate: '1990-05-15', motherName: 'Maria Teste', email: 'evid@example.com',
      phone: '11987650001', isPep: false, income: 'Até R$ 5.000', assets: 'Até R$ 50.000', profession: 'Analista',
      address: { postalCode: '01001000', street: 'Praça da Sé', number: '1', neighborhood: 'Sé', city: 'São Paulo', state: 'SP' },
      password: 'senhaForte1', txPassword: '1234',
    });
    await call('POST', '/dev/approve-documentscopy');
    await call('GET', '/onboarding/status');
    await call('GET', '/balance');
  } finally {
    server.close();
  }

  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.jsonl'));
  assert.equal(files.length, 1);
  const raw = fs.readFileSync(path.join(DIR, files[0]), 'utf8');
  const lines = raw.trim().split('\n').map((l) => JSON.parse(l));
  assert.ok(lines.length >= 3, `poucas linhas: ${lines.length}`);
  assert.ok(lines.every((l) => l.modo === 'mock'));
  const proposal = lines.find((l) => l.celcoin.rota === '/onboarding/v1/onboarding-proposal/natural-person');
  assert.ok(proposal, 'proposta PF não registrada');
  assert.equal(proposal.rotaDoApp, 'POST /api/onboarding/pf');
  assert.equal(proposal.statusHttp, 200);
  assert.ok(proposal.correlacao.clientCode, 'clientCode ausente na correlação');
  assert.ok(lines.some((l) => l.rotaDoApp === 'GET /api/balance' && /wallet\/balance/.test(l.celcoin.rota)));
  // Nada sensível em claro: CPF, e-mail, nome completo, senhas.
  for (const s of ['44334191258', 'evid@example.com', 'Teste Evidencia Completo', 'senhaForte1', 'Praça da Sé']) {
    assert.ok(!raw.includes(s), `vazou: ${s}`);
  }

  // Relatório em Markdown.
  const day = files[0].slice(0, 10);
  const out = path.join(DIR, 'relatorio.md');
  execFileSync(process.execPath, [path.join(__dirname, '..', 'tools', 'evidencias.js'), day, '--saida', out], { env: { ...process.env, EVIDENCIAS_DIR: DIR } });
  const md = fs.readFileSync(out, 'utf8');
  assert.match(md, /não valem como evidência/);
  assert.match(md, /POST \/api\/onboarding\/pf/);
});
