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

// Massa de teste de boletos (linhas oficiais do sandbox; valores conferidos no authorize de 10/11 18:45).
const BILLS = {
  '23793381286008301352856000063307789840000150000': { assignor: 'BANCO BRADESCO S.A.', recipient: 'BENEFICIARIO AMBIENTE HOMOLOGACAO', value: 1500, original: 1500, total: 1500 },
  '34198862666531252277792218900006890430000039322': { assignor: 'ITAU UNIBANCO S.A.', recipient: 'BENEFICIARIO AMBIENTE HOMOLOGACAO', value: 393.22, original: 436.92, discount: 43.70, total: 393.22 },
  '00190000090100159000700117369173390420000098888': { assignor: 'BANCO DO BRASIL S.A.', recipient: 'BENEFICIARIO AMBIENTE HOMOLOGACAO', value: 988.88, original: 957.24, fine: 28.71, interest: 1.98, total: 987.93, overdue: true },
  '23790124009217400000702005449802190400000191577': { assignor: 'BANCO BRADESCO S.A.', recipient: 'BENEFICIARIO AMBIENTE HOMOLOGACAO', value: 1915.77, original: 1915.77, fine: 19.15, total: 1934.92, overdue: true },
  // Só no simulado: reproduzem o que o sandbox fez em 10/11 (19:05 e 19:23).
  '11111111111111111111111111111111111111111111111': { assignor: 'BANCO SIMULADO', degraded: true, value: 322.02 },
  '22222222222222222222222222222222222222222222222': { assignor: 'BANCO SIMULADO', recipient: 'FALHA COM DEBITO', value: 50, original: 50, total: 50, failDebited: true },
  '34191570070404695481642042200008290440000032202': { assignor: 'ITAU UNIBANCO S.A.', recipient: 'BENEFICIARIO AMBIENTE HOMOLOGACAO', value: 322.02, original: 322.02, interest: 1.22, total: 323.24, allow: true, min: 305.92, max: 338.12 },
};

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
      return { status: 'SUCCESS', body: { businessAccount: { branch: a.branch, account: a.account, statusAccount: 'ATIVO' }, businessName: a.businessName, tradingName: a.tradingName,
        owners: (a.owner || []).map(({ ownerType, ...o }) => o) } };
    }
    if (method === 'GET' && p === '/baas/v2/account/fetch' && String(q.get('documentNumber')).length > 11) {
      throw err(400, 'CBE370', 'DocumentNumber possui tamanho maximo de 11 caracteres');
    }
    if (method === 'PUT' && (p === '/baas/v2/account/natural-person' || p === '/baas/v2/account/business')) {
      const found = [...state.accounts.values()].find((a) => a.account === q.get('Account'));
      if (!found) throw err(400, 'CBE039', 'Account invalido.');
      // Igual ao sandbox: na PJ o owners é obrigatório (1 a 10).
      if (p === '/baas/v2/account/business' && (!Array.isArray(body.owners) || body.owners.length < 1 || body.owners.length > 10)) throw err(400, 'CBE400', 'O campo Owners deve conter um array de no mínimo 1 e máximo 10.');
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
    if (method === 'GET' && p === '/baas/v2/wallet/power-movement') {
      // Como o sandbox: saldo antes e depois, status CONFIRMED, "Z" no horário de Brasília, paginado,
      // e boleto recusado com débito fica de fora (mas mexe no saldo).
      const acc = q.get('Account');
      const from = q.get('DateFrom'), to = q.get('DateTo');
      if ((Date.parse(to) - Date.parse(from)) / 864e5 > 6) throw err(400, 'CBE376', 'Consulta conta não permitida. Diferença entre dateFrom e dateTo não pode ultrapassar 7 dias.');
      let bal = 0;
      const out = [];
      for (const m of state.movements.get(acc) || []) {
        const old = bal; bal = Math.round((bal + (m.balanceType === 'CREDIT' ? m.amount : -m.amount)) * 100) / 100;
        if (m.hiddenInPower) continue;
        out.push({ id: m.id, clientCode: m.clientCode, description: m.movementType.startsWith('ENTRY') ? m.description : null, createDate: `${m.createDate}Z`, amount: m.amount,
          status: 'CONFIRMED', balanceType: m.balanceType, movementType: m.movementType, additionalInformation: { oldBalance: old, currentBalance: bal, ...(m.extra || {}) } });
      }
      out.reverse();
      const page = Number(q.get('Page') || 1), per = Number(q.get('LimitPerPage') || 50);
      return { status: 'SUCCESS', version: '2.0.0', totalItems: out.length, currentPage: page, limitPerPage: per, totalPages: Math.max(1, Math.ceil(out.length / per)),
        body: { account: acc, movements: out.slice((page - 1) * per, page * per) } };
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
        else if (pay.failDebited) {
          pay.status = 'ERROR'; pay.errorCode = 'PCE020';
          moves.push({ id: pay.id, clientCode: pay.clientRequestId, description: 'PAGAMENTO DE CONTAS', createDate: now(), amount: pay.amount, status: 'Saldo Bloqueado', balanceType: 'DEBIT', movementType: 'BILLPAYMENT', hiddenInPower: true });
        }
        else { pay.status = 'CONFIRMED'; moves.push({ id: pay.id, clientCode: pay.clientCode, description: 'pix', createDate: now(), amount: pay.amount, balanceType: 'DEBIT', movementType: 'PIXPAYMENTOUT' }); }
      }
      const out = { status: pay.status, body: { id: pay.id, amount: pay.amount, endToEndId: pay.endToEndId, creditParty: pay.creditParty } };
      if (pay.errorCode) out.error = { errorCode: pay.errorCode, message: 'Transação não permitida.Conta com saldo insuficiente.' };
      return out;
    }
    // ---- Boleto: massa de teste da Celcoin, como o sandbox respondeu em 10/11/2026 às 18:45.
    if (method === 'POST' && p === '/v5/transactions/billpayments/authorize') {
      const code = (body.barCode && (body.barCode.digitable || body.barCode.barCode)) || '';
      const m = BILLS[code] || BILLS[Object.keys(BILLS).find((k) => BILLS[k].barCode === code)];
      if (!m) throw err(400, '822', 'Erro na conversão de linha digitável');
      const today = now().slice(0, 10), yesterday = new Date(Date.now() - 3 * 3600e3 - 864e5).toISOString().slice(0, 10);
      const transactionId = Math.floor(Math.random() * 1e9);
      state.bills = state.bills || new Map();
      state.bills.set(transactionId, m);
      if (m.degraded) return { assignor: m.assignor, transactionId, digitable: code, value: m.value, dueDate: '2022-07-12T00:00:00', registerData: null, errorCode: '000', message: null, status: 0 };
      return { assignor: m.assignor, transactionId, digitable: m.digitable || code, value: m.value, type: 2, errorCode: '000', message: null, status: 0,
        initeHour: '07:00', endHour: '20:00', settleDate: today,
        registerData: { recipient: m.recipient, documentRecipient: '87754347000108', payer: 'PAGADOR AMBIENTE DE HOMOLOGACA', documentPayer: '69844780144',
          dueDateRegister: `${m.overdue ? yesterday : today}T00:00:00`, allowChangeValue: !!m.allow, minValue: m.min || 0, maxValue: m.max || 0,
          originalValue: m.original, discountValue: m.discount || 0, fineValueCalculated: m.fine || 0, interestValueCalculated: m.interest || 0, totalUpdated: m.total } };
    }
    if (method === 'POST' && p === '/baas/v2/billpayment') {
      if (!body.clientRequestId || !body.transactionIdAuthorize || !body.account) throw err(400, 'CBE001', 'Campos obrigatórios ausentes.');
      const id = crypto.randomUUID();
      state.billPays = state.billPays || new Map();
      const auth = (state.bills || new Map()).get(body.transactionIdAuthorize) || {};
      state.billPays.set(body.clientRequestId, { ...body, id, status: 'PROCESSING', at: Date.now(), failDebited: !!auth.failDebited });
      return { version: '1.0.0', status: 'PROCESSING', body: { id, clientRequestId: body.clientRequestId, amount: body.amount, transactionIdAuthorize: body.transactionIdAuthorize, barCodeInfo: body.barCodeInfo } };
    }
    if (method === 'GET' && p === '/baas/v2/billpayment/status') {
      const pay = (state.billPays || new Map()).get(q.get('ClientRequestId'));
      if (!pay) throw err(404, 'CBE106', 'Transação não encontrada.');
      if (pay.status === 'PROCESSING' && Date.now() - pay.at > 1500) {
        const moves = state.movements.get(pay.account) || [];
        const bal = moves.reduce((s, m) => s + (m.balanceType === 'CREDIT' ? m.amount : -m.amount), 0);
        if (bal < pay.amount) { pay.status = 'ERROR'; pay.errorCode = 'CBE123'; }
        else if (pay.failDebited) {
          pay.status = 'ERROR'; pay.errorCode = 'PCE020';
          moves.push({ id: pay.id, clientCode: pay.clientRequestId, description: 'PAGAMENTO DE CONTAS', createDate: now(), amount: pay.amount, status: 'Saldo Bloqueado', balanceType: 'DEBIT', movementType: 'BILLPAYMENT', hiddenInPower: true });
        }
        else {
          pay.status = 'CONFIRMED'; pay.paidAt = now();
          moves.push({ id: pay.id, clientCode: pay.clientRequestId, description: 'PAGAMENTO DE CONTAS', createDate: pay.paidAt, amount: pay.amount, status: 'Saldo Bloqueado', balanceType: 'DEBIT', movementType: 'BILLPAYMENT' });
        }
      }
      // Igual ao sandbox: o status confirmado não traz recibo.
      // Como o sandbox (versão 1.2.0): o erro vem dentro de body.error.
      const out = { version: '1.2.0', status: pay.status, body: { id: pay.id, clientRequestId: pay.clientRequestId, amount: pay.amount, paymentDate: pay.paidAt || null, hasOccurrence: false } };
      if (pay.errorCode) out.body.error = { errorCode: pay.errorCode, message: pay.errorCode === 'PCE020' ? 'Falha ao realizar o pagamento por motivos desconhecidos. Tente novamente' : 'Saldo insuficiente.' };
      return out;
    }
    if (method === 'GET' && p === '/baas/v2/webhook/replay/billpayment/details') {
      const list = [...(state.billPays || new Map()).values()].filter((x) => x.status === 'CONFIRMED').map((x) => ({
        webhookId: x.id.replace(/-/g, ''), webhookUrl: null, status: 'PENDENTE', filter: { account: x.account, id: x.id, clientRequestId: x.clientRequestId },
        request: JSON.stringify({ entity: 'billpayment', status: 'CONFIRMED', body: { clientRequestId: x.clientRequestId, id: x.id, account: x.account, amount: x.amount, status: 'CONFIRMED',
          transactionId: 2150000000 + (x.transactionIdAuthorize % 1e6), authentication: 8934, convenant: '655 | BANCO VOTORANTIN / AGENCIA 0001', createDate: x.paidAt, settleDate: `${x.paidAt.slice(0, 10)}T00:00:00`,
          authenticationAPI: { BlocoCompleto: 'A5.A6.D2.0A.64.E9.BD.C9.A6.88.05.DA.0A.47.E9.49' },
          receipt: { receiptData: '', receiptformatted: `      RECIBO SIMULADO\r\n  PROTOCOLO ${2150000000 + (x.transactionIdAuthorize % 1e6)}\r\nVALOR COBRADO   ${x.amount.toFixed(2).replace('.', ',')}\r\n VALIDO COMO RECIBO DE PAGAMENTO\r\n` } } }),
      }));
      return { version: '1.0.0', status: 'SUCCESS', body: { totalItems: list.length, webhookDetails: list } };
    }
    // ---- DDA (como o sandbox em 11/11): resposta PROCESSING e resultado por evento, ~2 s depois.
    if (p === '/dda-subscription-webservice/v1/subscription/Register' && (method === 'POST' || method === 'DELETE')) {
      const doc = String(body.document || '').replace(/\D/g, '');
      if (doc.length !== 11 && doc.length !== 14) throw err(400, 'CDDA101', 'Documento Inválido');
      const subscriptionId = crypto.randomUUID();
      const del = method === 'DELETE';
      const status = del ? (doc === '26817625025' ? 'Inactive_failed' : 'Inactive') : (doc === '26817625025' ? 'Error' : 'Created');
      if (!del) ddaState.active.delete(doc);
      ddaPush({ document: doc, clientRequestId: body.clientRequestId, subscriptionId, clientName: body.clientName || 'Mock Client', status,
        error: status === 'Error' ? [{ ErrorCode: 'CDDA101', ErrorMessage: 'Ocorreu um erro inesperado' }] : null }, () => {
        if (status === 'Created') ddaState.active.add(doc);
        if (status === 'Inactive') ddaState.active.delete(doc);
      });
      return { status: 201, body: { document: doc, clientRequestId: body.clientRequestId, responseDate: new Date().toISOString(), status: 'PROCESSING', subscriptionId } };
    }
    if (method === 'POST' && p === '/dda-serviceinvoice-webservice/v1/invoice/register') {
      const docs = body.document || [];
      if (docs.length > 20) throw err(400, 'CDDA115', 'A requisição possui um limite de até 20 documentos');
      const out = docs.map((d) => {
        const ok = ddaState.active.has(d) && d !== '71929784007';
        if (ok) for (let k = 0; k < 3; k++) ddaPush(ddaInvoice(d, k));
        return { document: d, status: ok ? 'Success' : 'Fail' };
      });
      return { status: 200, body: out };
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

// ---- eventos do DDA simulados (o app lê como leria do webhook.site)
const ddaState = { events: [], active: new Set(), seq: 0 };
function ddaPush(body, onReady) {
  ddaState.events.push({ id: `mock-dda-${++ddaState.seq}`, readyAt: Date.now() + 1500, body, onReady, done: false });
}
// Boleto de teste, no formato do sandbox; o 2º já está vencido e o 3º com a linha de 48 números, como em 11/11.
function ddaInvoice(doc, k) {
  const today = new Date(Date.now() - 3 * 3600e3);
  const due = new Date(today.getTime() + (k === 1 ? -2 : 1) * 864e5).toISOString().slice(0, 10);
  const value = [11341, 8507, 93040][k];
  return { registerData: {
    addresseeBank: { assignor: '', ispb: 43520091, code: '124' },
    originalBeneficiary: { personType: 'J', documentNumber: '87201417000109', name: ['Escola Aprender Ltda', 'Condominio Edificio Sol', 'Seguros Bem Estar S.A.'][k], fantasyName: '' },
    payer: { personType: doc.length === 14 ? 'J' : 'F', documentNumber: doc, name: 'Pagador Simulado', fantasyName: '' },
    dueDate: `${due}T00:00:00`, dueDateRegister: `${today.toISOString().slice(0, 10)}T12:00:00`, hasDiscount: false, hasInterest: true, description: 'Fixed DueDate',
    originalValue: value, calculatedAmount: value,
    digitable: k === 2 ? '273918702728289954911078320595024406309764603298' : '52795885665913414879687308882619506303199330113',
    barCode: '52795063031993301135885659134148798730888261', status: 'Aberto',
    paymentSituation: 'Boleto de pagamento encontrado na base centralizada e cliente beneficiário apto',
    transactionId: crypto.randomUUID(), ourNumber: String(1e8 + ddaState.seq), speciesCode: '2', overdueDate: `${due}T00:00:00`,
    paymentType: 3, blockedPayment: false, partialPayment: false, allowanceAmount: 0,
    interest: { date: `${due}T00:00:00`, code: '1', description: 'Value (Calendar days)', amount: 95 },
    fine: { date: `${due}T00:00:00`, code: '2', description: 'Percentage', amount: 200 },
    discounts: [{ date: null, code: '0', description: 'Exempt', amount: 0 }],
  } };
}
function ddaEvents() {
  const now = Date.now();
  const ready = ddaState.events.filter((e) => e.readyAt <= now);
  for (const e of ready) if (!e.done) { e.done = true; if (e.onReady) e.onReady(); }
  return ready.map((e) => ({ id: e.id, at: new Date(e.readyAt).toISOString().replace('T', ' ').slice(0, 19), body: e.body }));
}

module.exports = { handle, approveDocumentscopy, devCredit, state, ddaEvents };
