// Simulação LOCAL da Celcoin, só para desenvolvimento e testes automatizados.
// Ativada apenas com CELCOIN_MODE=mock. O app mostra uma faixa "MODO SIMULADO"
// em todas as telas nesse modo, para que ninguém confunda com integração real.
// O comportamento reproduz o que foi observado no sandbox em 10/11/2026.
const crypto = require('crypto');

const state = { proposals: new Map(), accounts: new Map(), keys: new Map(), payments: new Map(), movements: new Map(), nextAccount: 50000001 };
const err = (status, errorCode, message) => Object.assign(new Error(message), { mockStatus: status, errorCode });
const now = () => new Date().toISOString().slice(0, 19);

function wrapError(e) {
  const { CelcoinError } = require('./celcoin');
  if (e.mockStatus) throw new CelcoinError(e.mockStatus, e.errorCode, e.message, { error: { errorCode: e.errorCode, message: e.message } });
  throw e;
}

// Leitura TLV do EMV (BR Code), só para o modo simulado. No sandbox quem decodifica é a Celcoin.
function tlv(str) {
  const out = {}; let i = 0;
  while (i + 4 <= str.length) { const id = str.slice(i, i + 2); const len = Number(str.slice(i + 2, i + 4)); out[id] = str.slice(i + 4, i + 4 + len); i += 4 + len; }
  return out;
}
function decodeEmvMock(emv) {
  const s = String(emv || '').trim();
  if (!/^000201/.test(s)) {
    // No sandbox o código real vem dentro de description (code 999 por fora); o cliente já trata isso.
    throw err(400, 'PCE002', 'Código Pix inválido.');
  }
  // CRC16-CCITT do BR Code, como a Celcoin confere (PCE002 "Invalid Crc").
  const crc = (str) => { let c = 0xFFFF; for (const ch of Buffer.from(str, 'utf8')) { c ^= ch << 8; for (let i = 0; i < 8; i++) c = (c & 0x8000) ? ((c << 1) ^ 0x1021) & 0xFFFF : (c << 1) & 0xFFFF; } return c.toString(16).toUpperCase().padStart(4, '0'); };
  const at = s.lastIndexOf('6304');
  if (at < 0 || crc(s.slice(0, at + 4)) !== s.slice(at + 4, at + 8).toUpperCase()) throw err(400, 'PCE002', 'Error reading emv: [Invalid Crc].');
  const t = tlv(s); const mai = tlv(t['26'] || ''); const add = tlv(t['62'] || '');
  const dynamic = !!mai['25'];
  const amount = t['54'] ? Number(t['54']) : null;
  return { version: '1.0.0', status: 200, body: {
    type: dynamic ? 'DYNAMIC' : 'STATIC',
    merchantAccountInformation: { url: mai['25'] || null, merchantCategoryCode: t['52'] || '0000', merchantName: null, merchantCity: t['60'] || null, postalCode: t['61'] ? tlv(t['61'])['05'] || null : null },
    key: mai['01'] || null,
    amount: { original: amount, final: amount, canModifyFinalAmount: amount == null },
    transactionIdentification: add['05'] || '***',
    payload: dynamic ? { merchantName: t['59'] || null } : null,
  } };
}

function approveDocumentscopy(proposalId) {
  const p = state.proposals.get(proposalId);
  if (!p) return false;
  p.status = 'RESOURCE_CREATED';
  const account = String(state.nextAccount++);
  state.accounts.set(p.documentNumber, { branch: '0001', account, ...p.body });
  state.movements.set(account, []);
  return true;
}

async function handle(method, path, body) {
  try {
    const [p, qs] = path.split('?');
    const q = new URLSearchParams(qs || '');

    if (method === 'POST' && p === '/onboarding/v1/onboarding-proposal/natural-person') {
      const proposalId = crypto.randomUUID();
      const last = String(body.phoneNumber || '').slice(-1);
      state.proposals.set(proposalId, {
        proposalId, documentNumber: body.documentNumber, clientCode: body.clientCode, body,
        status: last === '2' ? 'REPROVED' : 'PENDING_DOCUMENTSCOPY',
        url: `https://celcoin.cadastro.io/mock-${proposalId.slice(0, 8)}`,
      });
      return { version: '1.0.0', status: 'PROCESSING', body: { proposalId, clientCode: body.clientCode, documentNumber: body.documentNumber } };
    }
    if (method === 'POST' && p === '/onboarding/v1/onboarding-proposal/legal-person') {
      if (!Array.isArray(body.owner) || !body.owner.length) throw err(400, 'OBE020', 'owner é obrigatório.');
      if (body.companyType === 'MEI' && (body.owner.length !== 1 || body.owner[0].ownerType !== 'SOCIO')) throw err(400, 'OBE000', 'Para companyType do tipo MEI ,o campo owner deve conter apenas um SOCIO.');
      const proposalId = crypto.randomUUID();
      const last = String(body.contactNumber || '').slice(-1);
      state.proposals.set(proposalId, {
        proposalId, documentNumber: body.documentNumber, clientCode: body.clientCode, body, type: 'PJ',
        status: last === '2' ? 'REPROVED' : 'PENDING_DOCUMENTSCOPY',
        // Igual ao sandbox (10/11, LTDA com 2 sócios): uma documentoscopia só, do 1º owner, não da empresa.
        docs: body.owner.slice(0, 1).map((o, i) => ({ documentNumber: o.documentNumber, url: `https://celcoin.cadastro.io/mock-${proposalId.slice(0, 6)}-${i}` })),
      });
      return { version: '1.0.0', status: 'PROCESSING', body: { proposalId, clientCode: body.clientCode, documentNumber: body.documentNumber } };
    }
    if (method === 'GET' && p === '/onboarding/v1/onboarding-proposal') {
      const pr = state.proposals.get(q.get('proposalId'));
      if (!pr) throw err(404, 'OBE049', 'Não foi encontrada nenhuma proposta referente aos dados informados.');
      const st = pr.status === 'RESOURCE_CREATED' ? 'APPROVED' : 'PENDING';
      const docs = pr.docs || [{ documentNumber: pr.documentNumber, url: pr.url }];
      return { status: 'SUCCESS', body: { proposal: [{ proposalId: pr.proposalId, clientCode: pr.clientCode, status: pr.status, proposalType: pr.type || 'PF',
        documentscopys: docs.map((d) => ({ documentNumber: d.documentNumber, status: st, url: d.url })) }] } };
    }
    if (method === 'GET' && p === '/baas/v2/account/fetch-business') {
      const a = state.accounts.get(q.get('documentNumber'));
      if (!a) throw err(404, 'CBE078', 'Nenhuma conta foi encontrada.');
      return { status: 'SUCCESS', body: { businessAccount: { branch: a.branch, account: a.account, statusAccount: 'ATIVO' }, businessName: a.businessName, tradingName: a.tradingName } };
    }
    if (method === 'GET' && p === '/baas/v2/account/fetch' && String(q.get('documentNumber')).length > 11) {
      throw err(400, 'CBE370', 'DocumentNumber possui tamanho maximo de 11 caracteres');
    }
    if (method === 'PUT' && (p === '/baas/v2/account/natural-person' || p === '/baas/v2/account/business')) {
      const found = [...state.accounts.values()].find((a) => a.account === q.get('Account'));
      if (!found) throw err(400, 'CBE039', 'Account invalido.');
      Object.assign(found, body);
      return { version: '1.0.0', status: '200' };
    }
    if (method === 'GET' && p === '/pix/v1/participants') {
      return require('./fixtures/participants.json');
    }
    if (method === 'POST' && p === '/pix/v1/emv/full') {
      return decodeEmvMock(body.emv);
    }
    if (method === 'GET' && p === '/baas/v2/account/fetch') {
      const a = state.accounts.get(q.get('documentNumber'));
      if (!a) throw err(404, 'CBE078', 'Nenhuma conta foi encontrada.');
      return { status: 'SUCCESS', body: { statusAccount: 'ATIVO', fullName: a.fullName, account: { branch: a.branch, account: a.account } } };
    }
    if (method === 'GET' && p === '/baas/v2/wallet/balance') {
      const acc = q.get('Account');
      const moves = state.movements.get(acc);
      if (!moves) throw err(400, 'CBE039', 'Account invalido.');
      const amount = moves.reduce((s, m) => s + (m.balanceType === 'CREDIT' ? m.amount : -m.amount), 0);
      return { status: 'SUCCESS', body: { amount } };
    }
    if (method === 'GET' && p === '/baas-walletreports/v1/wallet/movement') {
      const acc = q.get('Account');
      return { status: 'SUCCESS', body: { account: acc, movements: (state.movements.get(acc) || []).slice().reverse() } };
    }
    if (method === 'GET' && p.startsWith('/baas/v2/pix/dict/entry/external/')) {
      const key = q.get('key');
      if (key === 'naoexiste@example.com') throw err(404, 'CBE180', 'Não encontramos a chave informada.');
      return { status: 'SUCCESS', body: { keyType: key.includes('@') ? 'EMAIL' : 'EVP', key,
        account: { participant: '13935893', branch: '0', account: '*********', accountType: '***' },
        owner: { type: 'LEGAL_PERSON', documentNumber: '41878181000130', name: 'Pix Celcoin Teste 2 Avulso' },
        endtoEndId: 'E13935893' + Date.now() + 'MOCK' } };
    }
    if (method === 'GET' && p.startsWith('/baas/v2/pix/dict/entry/')) {
      const acc = p.split('/').pop();
      const list = state.keys.get(acc) || [];
      // Igual ao sandbox real: conta sem chave devolve 404 CBE180.
      if (!list.length) throw err(404, 'CBE180', 'Não encontramos a chave informada.');
      return { status: 'SUCCESS', body: { listKeys: list } };
    }
    if (method === 'POST' && p === '/baas/v2/pix/dict/entry') {
      if (body.key !== undefined) throw err(400, 'CBE178', 'Quando keyType igual a EVP o campo key não deve ser informado.');
      const k = { keyType: 'EVP', key: crypto.randomUUID(), account: { participant: '13935893', branch: '0001', account: body.account, accountType: 'TRAN' } };
      state.keys.set(body.account, [...(state.keys.get(body.account) || []), k]);
      return { status: 'CONFIRMED', body: k };
    }
    if (method === 'DELETE' && p.startsWith('/baas/v2/pix/dict/entry/')) {
      if (!body || !body.account) throw err(400, 'CBE091', 'É necessário informar o campo: account.');
      const key = decodeURIComponent(p.split('/').pop());
      const list = state.keys.get(body.account) || [];
      if (!list.some((k) => k.key === key)) throw err(400, 'CBE190', 'Operação Não permitida. Chave não esta vinculada a essa conta.');
      state.keys.set(body.account, list.filter((k) => k.key !== key));
      return { version: '1.0.0', status: 'SUCCESS' };
    }
    if (method === 'POST' && p === '/baas/v2/pix/payment') {
      // Regras por initiationType, como a skill descreve.
      const t = body.initiationType;
      if (t === 'MANUAL' && (body.creditParty.key || body.endToEndId || body.transactionIdentification)) throw err(400, 'CBE300', 'MANUAL não aceita key, endToEndId nem transactionIdentification.');
      if (t === 'DICT' && (!body.creditParty.key || !body.endToEndId || body.transactionIdentification)) throw err(400, 'CBE301', 'DICT exige key e endToEndId e não aceita transactionIdentification.');
      if ((t === 'STATIC_QRCODE' || t === 'DYNAMIC_QRCODE') && (!body.creditParty.key || !body.endToEndId || !body.transactionIdentification)) throw err(400, 'CBE302', 'QR Code exige key, endToEndId e transactionIdentification.');
      if (t === 'MANUAL' && (!body.creditParty.bank || !body.creditParty.account || !body.creditParty.branch || !body.creditParty.taxId)) throw err(400, 'CBE303', 'Dados da conta de destino incompletos.');
      const id = crypto.randomUUID();
      // No MANUAL a Celcoin gera o endToEndId; aparece na consulta de status.
      const e2e = body.endToEndId || `E13935893${Date.now()}MANUAL`;
      state.payments.set(id, { ...body, endToEndId: e2e, id, status: 'PROCESSING', at: Date.now() });
      return { status: 'PROCESSING', body: { id, clientCode: body.clientCode, endToEndId: body.endToEndId } };
    }
    if (method === 'GET' && p === '/baas/v2/pix/payment/status') {
      const pay = state.payments.get(q.get('id'));
      if (!pay) throw err(404, 'CBE106', 'Transação não encontrada.');
      if (pay.status === 'PROCESSING' && Date.now() - pay.at > 1500) {
        const acc = pay.debitParty.account;
        const moves = state.movements.get(acc) || [];
        const bal = moves.reduce((s, m) => s + (m.balanceType === 'CREDIT' ? m.amount : -m.amount), 0);
        if (bal < pay.amount) { pay.status = 'ERROR'; pay.errorCode = 'CBE123'; }
        else { pay.status = 'CONFIRMED'; moves.push({ id: pay.id, clientCode: pay.clientCode, description: 'pix', createDate: now(), amount: pay.amount, balanceType: 'DEBIT', movementType: 'PIXPAYMENTOUT' }); }
      }
      const out = { status: pay.status, body: { id: pay.id, amount: pay.amount, endToEndId: pay.endToEndId, creditParty: pay.creditParty } };
      if (pay.errorCode) out.error = { errorCode: pay.errorCode, message: 'Transação não permitida.Conta com saldo insuficiente.' };
      return out;
    }
    if (method === 'POST' && p === '/pix/v1/brcode/static') {
      return { transactionId: Date.now(), emvqrcps: `00020126580014br.gov.bcb.pix0136${body.key}5204000053039865802BR5913MOCK LOBANK6009SAO PAULO62070503***6304ABCD`, transactionIdentification: '***' };
    }
    throw err(404, 'MOCK_ROUTE', `Rota não simulada: ${method} ${p}`);
  } catch (e) { return wrapError(e); }
}

// Utilitários exclusivos do modo simulado (rotas /dev, desligadas fora do mock).
function devCredit(account, amount) {
  const moves = state.movements.get(account);
  if (!moves) return false;
  moves.push({ id: crypto.randomUUID(), clientCode: 'mock-credit', description: 'Crédito simulado', createDate: now(), amount, balanceType: 'CREDIT', movementType: 'ENTRYCREDIT' });
  return true;
}

module.exports = { handle, approveDocumentscopy, devCredit, state };
