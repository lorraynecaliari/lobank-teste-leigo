// Cliente da API Celcoin (sandbox). As credenciais vêm só do ambiente (.env) e
// nunca são registradas em log nem devolvidas ao navegador.
const crypto = require('crypto');

const BASE_URL = (process.env.CELCOIN_BASE_URL || 'https://sandbox.openfinance.celcoin.dev').replace(/\/$/, '');
const MODE = (process.env.CELCOIN_MODE || 'sandbox').toLowerCase(); // 'sandbox' ou 'mock'

if (MODE !== 'mock' && /api\.openfinance\.celcoin\.com\.br/.test(BASE_URL)) {
  throw new Error('Este app só pode apontar para o sandbox da Celcoin. Produção não é permitida.');
}

class CelcoinError extends Error {
  constructor(status, code, message, payload) {
    super(message || code || `HTTP ${status}`);
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

let tokenCache = { value: null, expiresAt: 0 };

async function getToken() {
  if (tokenCache.value && Date.now() < tokenCache.expiresAt - 60_000) return tokenCache.value;
  const id = process.env.CELCOIN_CLIENT_ID;
  const secret = process.env.CELCOIN_CLIENT_SECRET;
  if (!id || !secret) {
    throw new CelcoinError(500, 'APP_CONFIG', 'Credenciais de sandbox ausentes: preencha CELCOIN_CLIENT_ID e CELCOIN_CLIENT_SECRET no .env.');
  }
  const form = new FormData();
  form.append('client_id', id);
  form.append('client_secret', secret);
  form.append('grant_type', 'client_credentials');
  const res = await fetch(`${BASE_URL}/v5/token`, { method: 'POST', body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new CelcoinError(res.status, 'celcoin_auth_failed', 'Falha ao autenticar na Celcoin (sandbox). Confira as credenciais.');
  }
  tokenCache = { value: data.access_token, expiresAt: Date.now() + (Number(data.expires_in) || 2400) * 1000 };
  return tokenCache.value;
}

function extractError(data) {
  const e = (data && data.error) || {};
  let code = e.errorCode || e.code || data?.errorCode;
  let message = e.message || data?.message;
  // Copia e Cola devolve JSON escapado dentro de description (code 999 genérico por fora).
  if (typeof data?.description === 'string' && data.description.trim().startsWith('{')) {
    try {
      const inner = JSON.parse(data.description);
      code = inner.code || inner.errorCode || code;
      message = inner.message || message;
    } catch (_) { /* ignora */ }
  }
  return { code, message };
}

async function request(method, path, body, attempt = 1) {
  if (MODE === 'mock') return require('./celcoin-mock').handle(method, path, body);
  const token = await getToken();
  const headers = { Authorization: `Bearer ${token}`, accept: 'application/json' };
  const opts = { method, headers };
  if (body !== undefined && method !== 'GET') {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body); // objeto JSON serializado uma única vez
  }
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, opts);
  } catch (err) {
    // Falha de transporte: só repete leituras. Mutação com falha é ambígua.
    if (method === 'GET' && attempt < 3) {
      await new Promise((r) => setTimeout(r, 300 * attempt + Math.random() * 200));
      return request(method, path, body, attempt + 1);
    }
    throw new CelcoinError(502, 'TRANSPORT', 'Não foi possível falar com a Celcoin agora.');
  }
  if (res.status === 401 && attempt === 1) {
    tokenCache = { value: null, expiresAt: 0 };
    return request(method, path, body, attempt + 1);
  }
  if ([429, 502, 503, 504].includes(res.status) && method === 'GET' && attempt < 3) {
    await new Promise((r) => setTimeout(r, 400 * attempt + Math.random() * 200));
    return request(method, path, body, attempt + 1);
  }
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { raw: text }; }
  if (!res.ok || data.status === 'ERROR') {
    const { code, message } = extractError(data);
    throw new CelcoinError(res.status, code || `HTTP_${res.status}`, message, data);
  }
  return data;
}

const uid = (prefix) => `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

// ---- Onboarding --------------------------------------------------------------
const createNaturalPersonProposal = (payload) =>
  request('POST', '/onboarding/v1/onboarding-proposal/natural-person', payload);

const getProposal = (proposalId) =>
  request('GET', `/onboarding/v1/onboarding-proposal?proposalId=${encodeURIComponent(proposalId)}`);

const fetchAccountPF = (cpf) =>
  request('GET', `/baas/v2/account/fetch?documentNumber=${encodeURIComponent(cpf)}`);

// ---- Saldo e extrato ---------------------------------------------------------
const getBalance = (account) =>
  request('GET', `/baas/v2/wallet/balance?Account=${encodeURIComponent(account)}`);

const getMovements = (account, dateFrom, dateTo) =>
  request('GET', `/baas-walletreports/v1/wallet/movement?Account=${encodeURIComponent(account)}&DateFrom=${dateFrom}&DateTo=${dateTo}`);

// ---- Chaves Pix --------------------------------------------------------------
// Conta sem nenhuma chave: a Celcoin responde 404 CBE180 em vez de lista vazia.
const listKeys = async (account) => {
  try {
    return await request('GET', `/baas/v2/pix/dict/entry/${encodeURIComponent(account)}`);
  } catch (e) {
    if (e instanceof CelcoinError && e.code === 'CBE180') return { status: 'SUCCESS', body: { listKeys: [] } };
    throw e;
  }
};
// Com keyType EVP o campo key NÃO deve ser enviado (CBE178), apesar do exemplo da documentação.
const createEvpKey = (account) => request('POST', '/baas/v2/pix/dict/entry', { account, keyType: 'EVP' });

// Excluir: o path leva a CHAVE e o corpo leva a conta dona dela.
const deleteKey = (account, key) => request('DELETE', `/baas/v2/pix/dict/entry/${encodeURIComponent(key)}`, { account });

// ---- Pix out -----------------------------------------------------------------
// DICT do BaaS: o path leva o número da conta PAGADORA.
const lookupKey = (payerAccount, key) =>
  request('GET', `/baas/v2/pix/dict/entry/external/${encodeURIComponent(payerAccount)}?key=${encodeURIComponent(key)}`);

const pixPayment = (payload) => request('POST', '/baas/v2/pix/payment', payload);

const pixPaymentStatus = (id) => request('GET', `/baas/v2/pix/payment/status?id=${encodeURIComponent(id)}`);

// ---- Pix in (QR Code estático) -------------------------------------------------
const createStaticQr = (payload) => request('POST', '/pix/v1/brcode/static', payload);

module.exports = {
  MODE, BASE_URL, CelcoinError, uid,
  createNaturalPersonProposal, getProposal, fetchAccountPF,
  getBalance, getMovements, listKeys, createEvpKey, deleteKey,
  lookupKey, pixPayment, pixPaymentStatus, createStaticQr,
};
