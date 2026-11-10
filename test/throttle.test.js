// Intervalo mínimo entre consultas iguais à Celcoin (modo simulado, intervalo padrão de 10 s).
process.env.CELCOIN_MODE = 'mock';
delete process.env.CELCOIN_MIN_QUERY_INTERVAL_MS;

const test = require('node:test');
const assert = require('node:assert/strict');
const mock = require('../src/celcoin-mock');

let calls = [];
const original = mock.handle;
mock.handle = async (method, path, body) => { calls.push(`${method} ${path}`); return original(method, path, body); };
const celcoin = require('../src/celcoin');

test('intervalo padrão é 10 s', () => {
  assert.equal(celcoin.MIN_QUERY_INTERVAL_MS, 10000);
});

test('consulta repetida dentro de 10 s não chama a API de novo', async () => {
  calls = [];
  mock.state.movements.set('999001', []);
  await celcoin.getBalance('999001');
  await celcoin.getBalance('999001');
  await celcoin.getBalance('999001');
  assert.equal(calls.filter((c) => c.includes('/wallet/balance')).length, 1);
});

test('mutação libera a releitura imediata', async () => {
  calls = [];
  const before = await celcoin.listKeys('999002');
  assert.deepEqual(before.body.listKeys, []);
  await celcoin.createEvpKey('999002');
  const after = await celcoin.listKeys('999002');
  assert.equal(after.body.listKeys.length, 1);
  assert.equal(calls.filter((c) => c.startsWith('GET /baas/v2/pix/dict/entry/999002')).length, 2);
});

test('consulta de chave no DICT não é segurada (cada uma gera endToEndId novo)', async () => {
  calls = [];
  await celcoin.lookupKey('999003', 'testepix@celcoin.com.br');
  await celcoin.lookupKey('999003', 'testepix@celcoin.com.br');
  assert.equal(calls.filter((c) => c.includes('/dict/entry/external/')).length, 2);
});
