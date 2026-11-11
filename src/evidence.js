// Registro de evidências: cada chamada que o app faz à Celcoin vira uma linha JSON em
// data/evidencias/AAAA-MM-DD.jsonl (data/ está fora do Git). Serve de prova, para o QA do
// cel_agents, de que a chamada saiu da própria aplicação.
//
// Liga com EVIDENCIAS=1 no .env. Tudo é mascarado antes de gravar: documentos, conta,
// chave Pix, nomes, contatos e endereço ficam parcialmente ocultos; token, credenciais e
// senhas nunca entram. O modo simulado fica marcado como "mock" e não vale como evidência.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { AsyncLocalStorage } = require('async_hooks');

const ENABLED = ['1', 'true', 'sim', 'yes'].includes(String(process.env.EVIDENCIAS || '').toLowerCase());
const DIR = process.env.EVIDENCIAS_DIR || path.join(__dirname, '..', 'data', 'evidencias');
const MAX_CHARS = 20000; // respostas grandes (ex.: lista de participantes) são cortadas

const context = new AsyncLocalStorage();

// Rota do app que originou a chamada, com ids trocados por ":id" (ex.: GET /api/bills/:id).
function normalizeRoute(method, url) {
  const p = String(url || '').split('?')[0]
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    .replace(/\/\d+(?=\/|$)/g, '/:id')
    .replace(/(\/pix\/keys\/)(?!evp(?:\/|$))[^/]+/, '$1:chave') // chave Pix no caminho (e-mail, CPF, telefone)
    .replace(/\/[^/]*(@|%40)[^/]*/g, '/:email');
  return `${method} ${p}`;
}

// Middleware: guarda a rota do app e um id por pedido, para agrupar as chamadas de um mesmo fluxo.
function middleware(req, res, next) {
  if (!ENABLED) return next();
  context.run({ appRoute: normalizeRoute(req.method, req.originalUrl), appRequestId: crypto.randomBytes(6).toString('hex') }, next);
}

// ---- Máscaras -----------------------------------------------------------------
const SECRET_KEYS = /^(authorization|access_token|token|client_secret|client_id|password|pwd|login|secret|senha|txpassword|cookie)$/i;
const DOC_KEYS = /^(documentnumber|taxid|ownertaxid|cpf|cnpj|document|payerdocument|payertaxid|recipientdocument|documento|documentos)$/i;
const ACCOUNT_KEYS = /^(account|accountnumber|conta)$/i;
const NAME_KEYS = /^(name|fullname|mothername|socialname|businessname|tradingname|tradename|fantasyname|clientname|payername|recipientname|beneficiaryname|nome)$/i;
const EMAIL_KEYS = /email/i;
const PHONE_KEYS = /(phone|contactnumber|telefone)/i;
const ADDRESS_KEYS = /^(street|number|addresscomplement|postalcode|latitude|longitude)$/i;
const BIRTH_KEYS = /^(birthdate|datanascimento)$/i;
const PIXKEY_KEYS = /^(key|chave)$/i;
const FREE_TEXT_KEYS = /^(emv|qrcode|brcode|emvqrcps|copiaecola)$/i;

const digitsMask = (s, keep = 2) => {
  const d = String(s);
  if (d.length <= keep) return '*'.repeat(d.length);
  return '*'.repeat(d.length - keep) + d.slice(-keep);
};
const maskEmail = (s) => String(s).replace(/^(.{2})[^@]*(@.*)$/, (m, a, b) => `${a}***${b}`);
const maskName = (s) => String(s).split(/\s+/).filter(Boolean).map((w, i) => (i === 0 ? w : `${w[0]}.`)).join(' ');
const maskPhone = (s) => digitsMask(String(s).replace(/\D/g, ''), 4);

function maskPixKey(s) {
  const v = String(s);
  if (v.includes('@')) return maskEmail(v);
  if (/^\+?\d{10,14}$/.test(v)) return digitsMask(v.replace(/\D/g, ''), 4);
  if (/^\d{11}$|^\d{14}$/.test(v)) return digitsMask(v, 2);
  if (/^[0-9a-f-]{36}$/i.test(v)) return `${v.slice(0, 8)}-****-****-****-${v.slice(-4)}`;
  return v.length > 6 ? `${v.slice(0, 3)}***${v.slice(-2)}` : '***';
}

// CPF e CNPJ soltos em textos (11 ou 14 dígitos isolados). Código de barras (44/47) não casa.
const maskLooseDocs = (s) => s
  .replace(/(?<!\d)\d{3}\.\d{3}\.\d{3}-\d{2}(?!\d)|(?<!\d)\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}(?!\d)/g, (m) => digitsMask(m.replace(/\D/g, ''), 2))
  .replace(/(?<!\d)(\d{11}|\d{14})(?!\d)/g, (m) => digitsMask(m, 2));

function maskValue(key, value) {
  if (value === null || value === undefined || value === '') return value;
  if (typeof value === 'object') return mask(value);
  const k = String(key || '');
  if (SECRET_KEYS.test(k)) return '[removido]';
  if (DOC_KEYS.test(k)) return Array.isArray(value) ? value.map((d) => digitsMask(d)) : digitsMask(String(value).replace(/\D/g, '') || value);
  if (ACCOUNT_KEYS.test(k)) return /^\*+$/.test(String(value)) ? value : digitsMask(value, 3);
  if (NAME_KEYS.test(k)) return maskName(value);
  if (EMAIL_KEYS.test(k)) return maskEmail(value);
  if (PHONE_KEYS.test(k)) return maskPhone(value);
  if (ADDRESS_KEYS.test(k)) return '***';
  if (BIRTH_KEYS.test(k)) return String(value).replace(/\d{2}([-/])\d{2}([-/])/, '**$1**$2').replace(/^(\d{4})-\d{2}-\d{2}/, '$1-**-**');
  if (PIXKEY_KEYS.test(k)) return maskPixKey(value);
  if (FREE_TEXT_KEYS.test(k)) return String(value).length > 20 ? `${String(value).slice(0, 12)}…[${String(value).length} caracteres]` : '***';
  if (typeof value === 'string') {
    // Corpos que chegam como texto JSON (ex.: request do histórico de webhooks).
    const t = value.trim();
    if ((t.startsWith('{') || t.startsWith('[')) && t.length < 200000) {
      try { return JSON.stringify(mask(JSON.parse(t))); } catch (_) { /* não era JSON */ }
    }
    return maskLooseDocs(value);
  }
  return value;
}

function mask(obj) {
  if (Array.isArray(obj)) return obj.map((v) => (typeof v === 'object' && v !== null ? mask(v) : maskValue('', v)));
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) out[k] = maskValue(k, v);
  return out;
}

// Rota da Celcoin sem dado sensível: parâmetros de busca mascarados pelo nome; trechos do
// caminho com conta, documento, e-mail ou chave aleatória também.
function maskPath(p) {
  const [base, query] = String(p).split('?');
  const segs = base.split('/').map((s) => {
    const d = decodeURIComponent(s);
    if (d.includes('@')) return encodeURIComponent(maskEmail(d));
    if (/^\d{6,}$/.test(d)) return digitsMask(d, 3);
    if (/^[0-9a-f-]{36}$/i.test(d) && /dict\/entry/.test(base)) return maskPixKey(d);
    return s;
  });
  if (!query) return segs.join('/');
  const params = new URLSearchParams(query);
  const masked = new URLSearchParams();
  for (const [k, v] of params) masked.append(k, String(maskValue(k, v)));
  return `${segs.join('/')}?${masked.toString()}`;
}

function cap(obj) {
  if (obj === undefined) return undefined;
  const s = JSON.stringify(obj);
  if (s.length <= MAX_CHARS) return obj;
  const items = Array.isArray(obj) ? obj.length : Array.isArray(obj && obj.body) ? obj.body.length : undefined;
  return { cortado: true, tamanhoOriginal: s.length, ...(items !== undefined ? { itens: items } : {}), inicio: s.slice(0, 2000) };
}

// Identificadores que ligam a chamada ao fluxo (clientCode, id, endToEndId…).
function correlation(reqBody, resBody) {
  const pick = (o) => (o && typeof o === 'object' ? o : {});
  const a = pick(reqBody), b = pick(resBody), bb = pick(b.body);
  const out = {};
  for (const k of ['clientCode', 'clientRequestId', 'externalTerminal', 'transactionId', 'id', 'endToEndId', 'proposalId', 'onboardingId']) {
    const v = a[k] ?? bb[k] ?? b[k];
    if (v !== undefined && v !== null && typeof v !== 'object') out[k] = v;
  }
  return out;
}

// Horário de Brasília (UTC-3), como o resto do app e da Celcoin.
function brNow() {
  const d = new Date(Date.now() - 3 * 3600e3);
  return d.toISOString().replace('Z', '-03:00');
}

function record({ mode, method, path: celPath, reqBody, status, resBody, durationMs, error }) {
  if (!ENABLED) return;
  try {
    const ctx = context.getStore() || {};
    const line = {
      registradoEm: brNow(),
      origem: 'app LoBank (servidor)',
      modo: mode, // "sandbox" = chamada real; "mock" = simulado, não vale como evidência
      rotaDoApp: ctx.appRoute || '(fora de um pedido do app)',
      pedidoDoApp: ctx.appRequestId,
      celcoin: { metodo: method, rota: maskPath(celPath) },
      requisicao: reqBody === undefined ? undefined : cap(mask(reqBody)),
      statusHttp: status,
      resposta: resBody === undefined ? undefined : cap(mask(resBody)),
      erro: error,
      duracaoMs: durationMs,
      correlacao: correlation(reqBody, resBody),
    };
    fs.mkdirSync(DIR, { recursive: true });
    fs.appendFileSync(path.join(DIR, `${line.registradoEm.slice(0, 10)}.jsonl`), JSON.stringify(line) + '\n');
  } catch (e) {
    console.error('[evidencias] não foi possível gravar:', e.message);
  }
}

module.exports = { ENABLED, DIR, middleware, record, mask, maskPath, normalizeRoute };
