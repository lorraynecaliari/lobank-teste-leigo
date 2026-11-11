const express = require('express');
const crypto = require('crypto');
const QRCode = require('qrcode');
const db = require('./db');
const celcoin = require('./celcoin');
const auth = require('./auth');
const v = require('./validators');

const router = express.Router();
const TERMINAL = new Set(['RESOURCE_CREATED', 'REPROVED', 'RESOURCE_ERROR']);

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const bad = (res, error, message, status = 400) => res.status(status).json({ error, message });

// Mensagens para quem usa o app. Códigos técnicos ficam no log do servidor.
const FRIENDLY = {
  CBE180: 'Não encontramos essa chave Pix. Confira e tente de novo.',
  CPD0013: 'Essa chave está restrita por suspeita de fraude e não pode receber Pix.',
  CBE190: 'Essa chave não está vinculada à sua conta.',
  PCE002: 'Esse código Pix não é válido. Confira se copiou o código inteiro.',
  CBE220: 'Não é possível transferir para a sua própria conta.',
  CBE123: 'Saldo insuficiente para essa transferência.',
  CBE039: 'Conta inválida.',
  CBE468: 'Esta operação não está liberada para o ambiente de testes da sua empresa.',
  OBE016: 'Data de nascimento inválida.',
  celcoin_auth_failed: 'Não conseguimos conectar com a Celcoin. Confira as credenciais de sandbox.',
  APP_CONFIG: 'O app não está configurado: faltam as credenciais de sandbox no arquivo .env.',
  TRANSPORT: 'A Celcoin não respondeu agora. Tente de novo em instantes.',
  HTTP_429: 'A Celcoin pediu para esperar um pouco. Tente de novo em instantes.',
};

// ---------------------------------------------------------------- sessão / login
router.post('/auth/login', wrap(async (req, res) => {
  const document = v.onlyDigits(req.body.document);
  const password = String(req.body.password || '');
  if (!(document.length === 11 || document.length === 14) || !password) return bad(res, 'INVALID', 'Informe CPF/CNPJ e senha.');
  const lockedUntil = auth.checkLock(document);
  if (lockedUntil) return bad(res, 'LOCKED', 'Muitas tentativas. Tente de novo em alguns minutos.', 429);
  const user = db.prepare('SELECT * FROM users WHERE document = ?').get(document);
  if (!user || !auth.verifySecret(password, user.password_hash)) {
    auth.registerFailure(document);
    return bad(res, 'INVALID_CREDENTIALS', 'CPF/CNPJ ou senha incorretos.', 401);
  }
  auth.clearFailures(document);
  auth.createSession(res, user.id);
  res.json({ ok: true });
}));

router.post('/auth/logout', (req, res) => { auth.destroySession(req, res); res.json({ ok: true }); });

router.get('/me', auth.requireUser, (req, res) => {
  const proposal = db.prepare('SELECT status, documentscopy_url FROM proposals WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(req.user.id);
  res.json({
    name: req.user.social_name || req.user.full_name.split(' ')[0],
    fullName: req.user.full_name,
    personType: req.user.person_type,
    document: req.user.document,
    account: req.account ? { branch: req.account.branch, account: req.account.account } : null,
    proposalStatus: proposal ? proposal.status : null,
  });
});

router.get('/config', (req, res) => res.json({ mode: celcoin.MODE, queryIntervalMs: celcoin.MIN_QUERY_INTERVAL_MS }));

// ---------------------------------------------------------------- validação comum
function parseAddress(a) {
  a = a || {};
  const address = {
    postalCode: v.onlyDigits(a.postalCode), street: String(a.street || '').trim(), number: String(a.number || '').trim(),
    addressComplement: String(a.complement || '').trim() || undefined, neighborhood: String(a.neighborhood || '').trim(),
    city: String(a.city || '').trim(), state: String(a.state || '').trim().toUpperCase(),
  };
  const ok = address.postalCode.length === 8 && address.street && address.number && address.neighborhood && address.city && address.state.length === 2;
  return ok ? address : null;
}
function checkPasswords(b) {
  const password = String(b.password || '');
  const txPassword = String(b.txPassword || '');
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) return { error: ['WEAK_PASSWORD', 'A senha precisa ter 8 caracteres ou mais, com letras e números.'] };
  if (!/^\d{4}$/.test(txPassword)) return { error: ['INVALID_TX_PASSWORD', 'A senha de transferência precisa ter 4 números.'] };
  return { password, txPassword };
}
// Pessoa física dentro da proposta PJ (responsável e sócios). Devolve [erro] ou { owner }.
function parseOwner(o, label) {
  o = o || {};
  const cpf = v.onlyDigits(o.cpf);
  if (!v.isValidCpf(cpf)) return { error: ['INVALID_CPF', `CPF inválido (${label}).`] };
  const fullName = String(o.fullName || '').trim();
  if (fullName.split(/\s+/).length < 2) return { error: ['INVALID_NAME', `Informe o nome completo (${label}).`] };
  const motherName = String(o.motherName || '').trim();
  if (motherName.length < 3) return { error: ['INVALID_MOTHER', `Informe o nome da mãe (${label}).`] };
  const birthDate = v.isoToCelcoinDate(o.birthDate);
  if (!birthDate) return { error: ['INVALID_BIRTH', `Data de nascimento inválida (${label}).`] };
  const phone = v.toE164(o.phone);
  if (!phone) return { error: ['INVALID_PHONE', `Telefone inválido (${label}).`] };
  if (!v.isEmail(o.email)) return { error: ['INVALID_EMAIL', `E-mail inválido (${label}).`] };
  const address = parseAddress(o.address);
  if (!address) return { error: ['INVALID_ADDRESS', `Endereço incompleto (${label}).`] };
  return { owner: { documentNumber: cpf, fullName, phoneNumber: phone, email: String(o.email).trim(), motherName, birthDate, address, isPoliticallyExposedPerson: o.isPep === true } };
}

// ---------------------------------------------------------------- onboarding PF
router.post('/onboarding/pf', wrap(async (req, res) => {
  const b = req.body || {};
  const cpf = v.onlyDigits(b.cpf);
  if (!v.isValidCpf(cpf)) return bad(res, 'INVALID_CPF', 'CPF inválido.');
  if (db.prepare('SELECT 1 FROM users WHERE document = ?').get(cpf)) return bad(res, 'ALREADY_REGISTERED', 'Já existe um cadastro com esse CPF. Faça login.', 409);
  const fullName = String(b.fullName || '').trim();
  const motherName = String(b.motherName || '').trim();
  if (fullName.split(/\s+/).length < 2 || fullName.length > 120) return bad(res, 'INVALID_NAME', 'Informe seu nome completo.');
  if (motherName.length < 3) return bad(res, 'INVALID_MOTHER', 'Informe o nome da sua mãe.');
  const birthDate = v.isoToCelcoinDate(b.birthDate);
  if (!birthDate) return bad(res, 'INVALID_BIRTH', 'Data de nascimento inválida.');
  const phone = v.toE164(b.phone);
  if (!phone) return bad(res, 'INVALID_PHONE', 'Telefone inválido. Use DDD + número.');
  if (!v.isEmail(b.email)) return bad(res, 'INVALID_EMAIL', 'E-mail inválido.');
  const a = b.address || {};
  const address = {
    postalCode: v.onlyDigits(a.postalCode), street: String(a.street || '').trim(), number: String(a.number || '').trim(),
    addressComplement: String(a.complement || '').trim() || undefined, neighborhood: String(a.neighborhood || '').trim(),
    city: String(a.city || '').trim(), state: String(a.state || '').trim().toUpperCase(),
  };
  if (address.postalCode.length !== 8 || !address.street || !address.number || !address.neighborhood || !address.city || address.state.length !== 2) {
    return bad(res, 'INVALID_ADDRESS', 'Endereço incompleto.');
  }
  const password = String(b.password || '');
  const txPassword = String(b.txPassword || '');
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) return bad(res, 'WEAK_PASSWORD', 'A senha precisa ter 8 caracteres ou mais, com letras e números.');
  if (!/^\d{4}$/.test(txPassword)) return bad(res, 'INVALID_TX_PASSWORD', 'A senha de transferência precisa ter 4 números.');

  const clientCode = celcoin.uid('lobank-pf');
  const payload = {
    clientCode, documentNumber: cpf, phoneNumber: phone, email: String(b.email).trim(), motherName, fullName,
    socialName: String(b.socialName || '').trim() || undefined, birthDate, address,
    isPoliticallyExposedPerson: b.isPep === true, onboardingType: 'BAAS',
  };
  const result = await celcoin.createNaturalPersonProposal(payload);
  const proposalId = result.body && result.body.proposalId;

  const insert = db.transaction(() => {
    const info = db.prepare(`INSERT INTO users (document, person_type, full_name, social_name, email, phone, password_hash, tx_password_hash, profile_json)
      VALUES (?, 'PF', ?, ?, ?, ?, ?, ?, ?)`).run(cpf, fullName, payload.socialName || null, payload.email, phone,
      auth.hashSecret(password), auth.hashSecret(txPassword),
      JSON.stringify({ income: b.income || null, assets: b.assets || null, profession: b.profession || null, postalCode: address.postalCode, city: address.city, address }));
    db.prepare('INSERT INTO proposals (user_id, proposal_id, client_code, status) VALUES (?, ?, ?, ?)').run(info.lastInsertRowid, proposalId, clientCode, 'PENDING');
    return info.lastInsertRowid;
  });
  const userId = insert();
  auth.createSession(res, userId);
  res.json({ ok: true });
}));

// Acompanhamento por consulta direta (o histórico de eventos não serve ao onboarding).
// ---------------------------------------------------------------- onboarding PJ
// Studio: board "Onboarding - PJ" (sem Procuração, por comentário). A Celcoin pede dados que as telas do Studio
// não coletam (endereço da empresa; nome da mãe, nascimento e endereço de cada sócio): o app acrescenta.
const COMPANY_TYPES = { MEI: 'MEI', EI: 'PJ', SLU: 'PJ', LTDA: 'PJ', SS: 'PJ', SA: 'PJ' }; // a API só aceita PJ ou MEI
router.post('/onboarding/pj', wrap(async (req, res) => {
  const b = req.body || {};
  const cnpj = v.onlyDigits(b.cnpj);
  if (!v.isValidCnpj(cnpj)) return bad(res, 'INVALID_CNPJ', 'CNPJ inválido.');
  if (db.prepare('SELECT 1 FROM users WHERE document = ?').get(cnpj)) return bad(res, 'ALREADY_REGISTERED', 'Já existe um cadastro com esse CNPJ. Faça login.', 409);
  const kind = String(b.companyKind || '').toUpperCase().replace(/\./g, '');
  if (!COMPANY_TYPES[kind]) return bad(res, 'INVALID_COMPANY_TYPE', 'Escolha o tipo de empresa.');
  const businessName = String(b.businessName || '').trim();
  const tradingName = String(b.tradingName || '').trim();
  if (businessName.length < 3 || businessName.length > 150) return bad(res, 'INVALID_BUSINESS_NAME', 'Informe a razão social.');
  if (tradingName.length < 2 || tradingName.length > 150) return bad(res, 'INVALID_TRADING_NAME', 'Informe o nome da empresa.');
  if (!v.isEmail(b.businessEmail)) return bad(res, 'INVALID_EMAIL', 'E-mail da empresa inválido.');
  const contactNumber = v.toE164(b.businessPhone);
  if (!contactNumber) return bad(res, 'INVALID_PHONE', 'Telefone da empresa inválido. Use DDD + número.');
  const businessAddress = parseAddress(b.businessAddress);
  if (!businessAddress) return bad(res, 'INVALID_ADDRESS', 'Endereço da empresa incompleto.');
  const role = b.fillerRole === 'representante' ? 'REPRESENTANTE' : 'SOCIO';
  // Regra da Celcoin (descoberta no sandbox): MEI tem um único owner, e ele é SOCIO.
  if (kind === 'MEI' && (role !== 'SOCIO' || (Array.isArray(b.partners) && b.partners.length))) {
    return bad(res, 'MEI_SINGLE_OWNER', 'MEI tem um único titular: informe só os seus dados, como sócio, sem outros sócios.');
  }
  const me = parseOwner(b.filler, 'responsável');
  if (me.error) return bad(res, ...me.error);
  const extra = Array.isArray(b.partners) ? b.partners : [];
  if (extra.length > 10) return bad(res, 'TOO_MANY_PARTNERS', 'No máximo 10 sócios.');
  const owners = [{ ownerType: role, ...me.owner }];
  for (let i = 0; i < extra.length; i++) {
    const r = parseOwner(extra[i], `sócio ${i + 1}`);
    if (r.error) return bad(res, ...r.error);
    if (owners.some((o) => o.documentNumber === r.owner.documentNumber)) return bad(res, 'DUPLICATE_PARTNER', `CPF repetido (sócio ${i + 1}).`);
    owners.push({ ownerType: role === 'REPRESENTANTE' && i === 0 ? 'SOCIO' : 'DEMAIS_SOCIOS', ...r.owner });
  }
  const pw = checkPasswords(b);
  if (pw.error) return bad(res, ...pw.error);

  const clientCode = celcoin.uid('lobank-pj');
  const payload = {
    clientCode, contactNumber, documentNumber: cnpj, businessEmail: String(b.businessEmail).trim(), businessName, tradingName,
    companyType: COMPANY_TYPES[kind], owner: owners, businessAddress, onboardingType: 'BAAS',
  };
  const result = await celcoin.createLegalPersonProposal(payload);
  const proposalId = result.body && result.body.proposalId;
  const userId = db.transaction(() => {
    const info = db.prepare(`INSERT INTO users (document, person_type, full_name, social_name, email, phone, password_hash, tx_password_hash, profile_json)
      VALUES (?, 'PJ', ?, ?, ?, ?, ?, ?, ?)`).run(cnpj, businessName, tradingName, payload.businessEmail, contactNumber,
      auth.hashSecret(pw.password), auth.hashSecret(pw.txPassword),
      JSON.stringify({ companyKind: kind, revenue: b.revenue || null, fillerRole: role, postalCode: businessAddress.postalCode, city: businessAddress.city, address: businessAddress,
        owners: owners.map((o, i) => ({ cpf: o.documentNumber, name: o.fullName, type: o.ownerType, share: i ? (extra[i - 1].share || null) : (b.filler.share || null) })) }));
    db.prepare('INSERT INTO proposals (user_id, proposal_id, client_code, status) VALUES (?, ?, ?, ?)').run(info.lastInsertRowid, proposalId, clientCode, 'PENDING');
    return info.lastInsertRowid;
  })();
  auth.createSession(res, userId);
  res.json({ ok: true });
}));

router.get('/onboarding/status', auth.requireUser, wrap(async (req, res) => {
  const p = db.prepare('SELECT * FROM proposals WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(req.user.id);
  if (!p) return bad(res, 'NO_PROPOSAL', 'Nenhuma proposta encontrada.', 404);
  let { status, documentscopy_url: url } = p;
  let docs = url ? [{ url, status: null }] : [];
  if (!TERMINAL.has(status) || (status === 'RESOURCE_CREATED' && !req.account)) {
    if (p.proposal_id) {
      const data = await celcoin.getProposal(p.proposal_id);
      const prop = (data.body && data.body.proposal && data.body.proposal[0]) || {};
      status = prop.status || status;
      docs = (prop.documentscopys || []).filter((d) => d.url).map((d) => ({ documentNumber: d.documentNumber, status: d.status, url: d.url }));
      url = (docs[0] && docs[0].url) || url;
      db.prepare("UPDATE proposals SET status = ?, documentscopy_url = ?, updated_at = datetime('now') WHERE id = ?").run(status, url, p.id);
    }
  }
  let account = req.account;
  if (status === 'RESOURCE_CREATED' && !account) {
    try {
      const pj = req.user.person_type === 'PJ';
      const acc = pj ? await celcoin.fetchAccountPJ(req.user.document) : await celcoin.fetchAccountPF(req.user.document);
      // PF: body.account.account; PJ: body.businessAccount.account
      const info = acc.body && (pj ? acc.body.businessAccount : acc.body.account);
      if (info && info.account) {
        db.prepare('INSERT OR IGNORE INTO accounts (user_id, branch, account) VALUES (?, ?, ?)').run(req.user.id, info.branch, info.account);
        account = { branch: info.branch, account: info.account };
      }
    } catch (e) {
      if (e.code !== 'CBE078') throw e; // CBE078 = "ainda não": a conta pode demorar a aparecer
    }
  }
  // PJ: devolve cada documentoscopia com o nome do sócio. No sandbox veio só a do 1º owner, mesmo com 2 sócios.
  const owners = (JSON.parse(req.user.profile_json || '{}').owners) || [];
  const named = docs.map((d) => { const o = owners.find((x) => x.cpf === d.documentNumber); return { url: d.url, status: d.status, name: o ? o.name : (req.user.person_type === 'PF' ? req.user.full_name : null) }; });
  const pending = status === 'PENDING_DOCUMENTSCOPY';
  res.json({ status, documentscopyUrl: pending ? url : null, documentscopies: pending ? named : [], account: account ? { branch: account.branch, account: account.account } : null });
}));

// ---------------------------------------------------------------- Minha conta
// Studio: "Minha conta | Editar dados". A Celcoin não deixa mudar nome, documento, nome da mãe e nascimento
// (PF), nem razão social e nome fantasia (PJ). Sócios só pelo time de Compliance da Celcoin.
router.put('/me', auth.requireUser, auth.requireAccount, wrap(async (req, res) => {
  const b = req.body || {};
  const phone = v.toE164(b.phone);
  if (!phone) return bad(res, 'INVALID_PHONE', 'Telefone inválido. Use DDD + número.');
  if (!v.isEmail(b.email)) return bad(res, 'INVALID_EMAIL', 'E-mail inválido.');
  const address = parseAddress(b.address);
  if (!address) return bad(res, 'INVALID_ADDRESS', 'Endereço incompleto.');
  const email = String(b.email).trim();
  const pj = req.user.person_type === 'PJ';
  if (pj) {
    // A Celcoin exige "owners" (1 a 10) no PUT da PJ, mesmo sem mudar sócios (sandbox, 17:49). O app reenvia os
    // sócios exatamente como a Celcoin os tem, lidos agora da conta; mudança de sócios só pelo Compliance.
    const cur = (await celcoin.fetchAccountPJ(req.user.document)).body || {};
    const owners = (cur.owners || []).map((o) => ({
      documentNumber: o.documentNumber, fullName: o.fullName, phoneNumber: o.phoneNumber, email: o.email, motherName: o.motherName,
      socialName: o.socialName || undefined, birthDate: o.birthDate, address: o.address, isPoliticallyExposedPerson: o.isPoliticallyExposedPerson === true,
    }));
    if (!owners.length) return bad(res, 'OWNERS_UNAVAILABLE', 'Não conseguimos ler os sócios da conta na Celcoin. Tente de novo em instantes.', 502);
    await celcoin.updateAccountPJ(req.account.account, req.user.document, {
      businessEmail: email, contactNumber: phone, documentNumber: req.user.document,
      businessName: cur.businessName, tradeName: cur.tradingName, owners, businessAddress: address,
    });
  } else {
    const socialName = String(b.socialName || '').trim() || undefined;
    await celcoin.updateAccountPF(req.account.account, req.user.document, { phoneNumber: phone, email, socialName, isPoliticallyExposedPerson: b.isPep === true, address });
    db.prepare('UPDATE users SET social_name = ? WHERE id = ?').run(socialName || null, req.user.id);
  }
  const profile = JSON.parse(req.user.profile_json || '{}');
  Object.assign(profile, { postalCode: address.postalCode, city: address.city, address });
  db.prepare('UPDATE users SET email = ?, phone = ?, profile_json = ? WHERE id = ?').run(email, phone, JSON.stringify(profile), req.user.id);
  res.json({ ok: true });
}));

router.get('/me/details', auth.requireUser, (req, res) => {
  const profile = JSON.parse(req.user.profile_json || '{}');
  res.json({ personType: req.user.person_type, document: req.user.document, fullName: req.user.full_name, socialName: req.user.social_name,
    email: req.user.email, phone: req.user.phone, address: profile.address || { postalCode: profile.postalCode, city: profile.city },
    owners: req.user.person_type === 'PJ' ? (profile.owners || []).map((o) => ({ name: o.name, type: o.type, share: o.share })) : undefined });
});

// Senhas ficam só no app (a Celcoin não guarda a senha de acesso nem a de transferência).
router.post('/me/passwords', auth.requireUser, (req, res) => {
  const b = req.body || {};
  if (!auth.verifySecret(String(b.current || ''), req.user.password_hash)) return bad(res, 'INVALID_CREDENTIALS', 'Senha atual incorreta.', 401);
  if (b.kind === 'login') {
    const p = String(b.next || '');
    if (p.length < 8 || !/[A-Za-z]/.test(p) || !/\d/.test(p)) return bad(res, 'WEAK_PASSWORD', 'A senha precisa ter 8 caracteres ou mais, com letras e números.');
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(auth.hashSecret(p), req.user.id);
  } else if (b.kind === 'tx') {
    if (!/^\d{4}$/.test(String(b.next || ''))) return bad(res, 'INVALID_TX_PASSWORD', 'A senha de transferência precisa ter 4 números.');
    db.prepare('UPDATE users SET tx_password_hash = ? WHERE id = ?').run(auth.hashSecret(String(b.next)), req.user.id);
  } else return bad(res, 'INVALID', 'Escolha qual senha trocar.');
  res.json({ ok: true });
});

// ---------------------------------------------------------------- conta
router.get('/balance', auth.requireUser, auth.requireAccount, wrap(async (req, res) => {
  const data = await celcoin.getBalance(req.account.account);
  res.json({ amount: Number(data.body && data.body.amount) || 0 });
}));

// Datas no fuso de Brasília (UTC-3): a Celcoin trabalha em horário local.
const ymdBr = (ms) => new Date(ms - 3 * 3600e3).toISOString().slice(0, 10);
const DAY = 864e5;
const STATEMENT_MAX_DAYS = 7; // janela máxima de consulta do extrato

router.get('/statement', auth.requireUser, auth.requireAccount, wrap(async (req, res) => {
  const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));
  const to = isDate(req.query.to) ? req.query.to : ymdBr(Date.now());
  const from = isDate(req.query.from) ? req.query.from : ymdBr(Date.parse(to + 'T12:00:00Z') - (STATEMENT_MAX_DAYS - 1) * DAY);
  const span = Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / DAY) + 1;
  if (span < 1) return bad(res, 'INVALID_PERIOD', 'A data inicial precisa ser anterior à final.');
  if (span > STATEMENT_MAX_DAYS) return bad(res, 'PERIOD_TOO_LONG', `O extrato pode ser consultado em períodos de até ${STATEMENT_MAX_DAYS} dias.`);
  const data = await celcoin.getMovements(req.account.account, from, to);
  const brlTxt = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const STATUS = { CONFIRMED: 'Concluído', PROCESSING: 'Em processamento', ERROR: 'Não concluído' };
  const moves = ((data.body && data.body.movements) || []).map((m) => {
    const a = m.additionalInformation || {};
    const party = m.balanceType === 'CREDIT' ? a.debitParty : a.creditParty; // Pix: quem pagou ou quem recebeu
    return {
      id: m.id, clientCode: m.clientCode, date: String(m.createDate || '').replace(/Z$/, ''), // horário de Brasília, apesar do "Z"
      amount: Number(m.amount) || 0, direction: m.balanceType === 'CREDIT' ? 'in' : 'out', type: m.movementType,
      description: m.description || null, status: STATUS[m.status] || m.status, counterpart: (party && party.name) || null,
      endToEndId: a.endToEndId || null, balanceBefore: num(a.oldBalance), balanceAfter: num(a.currentBalance),
    };
  });
  // Saldo que muda sem lançamento: no sandbox (11/11), R$ 1.309,95 de dois boletos recusados saíram do saldo
  // sem aparecer no extrato detalhado. O app mostra a diferença em vez de esconder.
  // A Celcoin devolve do mais novo para o mais antigo; a ordem dela é a da cadeia de saldo (horários podem empatar).
  const chain = moves.filter((m) => m.balanceBefore != null && m.balanceAfter != null).reverse();
  const gaps = [];
  for (let k = 1; k < chain.length; k++) {
    const diff = Math.round((chain[k].balanceBefore - chain[k - 1].balanceAfter) * 100) / 100;
    if (Math.abs(diff) >= 0.01) {
      gaps.push({ id: `gap-${chain[k].id}`, date: chain[k - 1].date, amount: Math.abs(diff), direction: diff > 0 ? 'in' : 'out', type: 'BALANCEGAP',
        description: `O saldo foi de ${brlTxt(chain[k - 1].balanceAfter)} para ${brlTxt(chain[k].balanceBefore)} sem lançamento no extrato da Celcoin`, status: 'Sem lançamento', gap: true });
    }
  }
  // Pix enviados que ainda não liquidaram aparecem como "em processamento", sem afetar o total.
  const known = new Set(moves.map((m) => m.clientCode));
  const pending = db.prepare("SELECT * FROM transactions WHERE user_id = ? AND status IN ('PROCESSING','UNKNOWN') ORDER BY id DESC").all(req.user.id)
    .filter((t) => !known.has(t.client_code))
    .map((t) => ({ id: `local-${t.id}`, txId: t.id, kind: t.kind, clientCode: t.client_code, date: t.created_at.replace(' ', 'T') + 'Z', amount: t.amount, direction: 'out',
      type: t.kind === 'BILL' ? 'BILLPAYMENT' : 'PIXPAYMENTOUT', description: t.kind === 'BILL' ? 'Pagamento de conta' : 'Pix enviado', status: 'Em processamento', pending: true }));
  const txByCode = new Map(db.prepare('SELECT id, kind, client_code, counterpart_json FROM transactions WHERE user_id = ?').all(req.user.id).map((t) => [t.client_code, t]));
  for (const m of moves) {
    const t = txByCode.get(m.clientCode);
    if (t) { m.txId = t.id; m.kind = t.kind; m.counterpart = m.counterpart || JSON.parse(t.counterpart_json).name; }
  }
  // Diferença depois do último lançamento: compara com o saldo de agora (só no período que termina hoje e sem
  // pagamento em processamento, que ainda pode lançar).
  if (chain.length && to === ymdBr(Date.now()) && !pending.length) {
    const lastOne = chain[chain.length - 1];
    const now = Number((await celcoin.getBalance(req.account.account)).body.amount);
    const diff = Math.round((now - lastOne.balanceAfter) * 100) / 100;
    if (Number.isFinite(now) && Math.abs(diff) >= 0.01) {
      moves.unshift({ id: 'gap-now', date: lastOne.date, amount: Math.abs(diff), direction: diff > 0 ? 'in' : 'out', type: 'BALANCEGAP',
        description: `O saldo foi de ${brlTxt(lastOne.balanceAfter)} para ${brlTxt(now)} sem lançamento no extrato da Celcoin`, status: 'Sem lançamento', gap: true });
    }
  }
  for (const g of gaps) moves.splice(moves.findIndex((m) => `gap-${m.id}` === g.id) + 1, 0, g); // logo abaixo do lançamento seguinte
  res.json({ from, to, movements: [...pending, ...moves] });
}));

// ---------------------------------------------------------------- chaves Pix
router.get('/pix/keys', auth.requireUser, auth.requireAccount, wrap(async (req, res) => {
  const data = await celcoin.listKeys(req.account.account);
  const keys = ((data.body && data.body.listKeys) || []).map((k) => ({ type: k.keyType, key: k.key }));
  res.json({ keys });
}));

router.post('/pix/keys/evp', auth.requireUser, auth.requireAccount, wrap(async (req, res) => {
  const current = await celcoin.listKeys(req.account.account);
  if (((current.body && current.body.listKeys) || []).some((k) => k.keyType === 'EVP')) {
    return bad(res, 'ALREADY_HAS_KEY', 'Você já tem uma chave aleatória.', 409);
  }
  const data = await celcoin.createEvpKey(req.account.account);
  // Confere relendo: não declara sucesso só pela resposta da criação.
  const after = await celcoin.listKeys(req.account.account);
  const key = ((after.body && after.body.listKeys) || []).find((k) => k.key === (data.body && data.body.key));
  if (!key) return bad(res, 'NOT_CONFIRMED', 'A chave foi solicitada, mas ainda não aparece na sua conta. Tente atualizar em instantes.', 202);
  res.json({ type: key.keyType, key: key.key });
}));

router.delete('/pix/keys/:key', auth.requireUser, auth.requireAccount, wrap(async (req, res) => {
  const key = String(req.params.key || '');
  const own = (d) => ((d.body && d.body.listKeys) || []).some((k) => k.key === key);
  // Só exclui chave que esteja na conta da pessoa logada.
  if (!own(await celcoin.listKeys(req.account.account))) return bad(res, 'NOT_FOUND', 'Essa chave não está na sua conta.', 404);
  await celcoin.deleteKey(req.account.account, key);
  // Confere relendo: não declara sucesso só pela resposta da exclusão.
  if (own(await celcoin.listKeys(req.account.account))) {
    return bad(res, 'NOT_CONFIRMED', 'A exclusão foi pedida, mas a chave ainda aparece na sua conta. Atualize em instantes.', 202);
  }
  res.json({ ok: true });
}));

// ---------------------------------------------------------------- Pix out
router.post('/pix/lookup', auth.requireUser, auth.requireAccount, wrap(async (req, res) => {
  let key = String(req.body.key || '').trim();
  if (!key) return bad(res, 'INVALID_KEY', 'Informe a chave Pix.');
  const digits = v.onlyDigits(key);
  if (/^[\d.\-/\s]+$/.test(key) && (digits.length === 11 || digits.length === 14)) key = digits;
  else if (/^\+?[\d\s()-]+$/.test(key) && v.toE164(key)) key = v.toE164(key);
  else if (key.includes('@')) key = key.toLowerCase();
  const data = await celcoin.lookupKey(req.account.account, key);
  const body = data.body || {};
  const e2e = body.endtoEndId || body.endToEndId || body.endtoendid || body.endtoendId; // 4 grafias na API
  if (!e2e) return bad(res, 'LOOKUP_FAILED', 'Não foi possível preparar a transferência para essa chave.', 502);
  const own = db.prepare('SELECT 1 FROM accounts WHERE user_id = ? AND account = ?').get(req.user.id, body.account && body.account.account);
  if (own) return bad(res, 'OWN_ACCOUNT', 'Essa chave é da sua própria conta.', 422);
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO pix_lookups (id, user_id, key, data_json, expires_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, req.user.id, key, JSON.stringify({ ...body, endToEndId: e2e }), Date.now() + 1000 * 60 * 30);
  res.json({
    lookupId: id, key, keyType: body.keyType,
    name: body.owner && (body.owner.tradeName || body.owner.name),
    document: body.owner && body.owner.documentNumber, personType: body.owner && body.owner.type,
    participant: body.account && body.account.participant,
  });
}));

// ---------------------------------------------------------------- Pix Copia e Cola
// Decodifica na Celcoin, resolve a chave no DICT a partir da conta pagadora e guarda tudo para o pagamento.
router.post('/pix/emv', auth.requireUser, auth.requireAccount, wrap(async (req, res) => {
  // Só tira quebras de linha e espaços das pontas: o código tem espaços de verdade (nome, cidade, descrição)
  // e tirá-los quebra o CRC (a Celcoin responde PCE002 "Invalid Crc").
  const emv = String(req.body.emv || '').replace(/[\r\n\t]+/g, '').trim();
  if (!/^000201/.test(emv) || emv.length < 50) return bad(res, 'INVALID_EMV', 'Esse não parece um código Pix Copia e Cola. Ele começa com 000201.');
  const dec = (await celcoin.decodeEmv(emv)).body || {};
  if (!dec.key) return bad(res, 'EMV_NO_KEY', 'Não encontramos a chave Pix dentro desse código.', 422);
  const amt = dec.amount || {};
  const amount = Number(amt.final || amt.original) || null;
  const qr = { type: String(dec.type || 'STATIC').toUpperCase(), txid: dec.transactionIdentification || '***', amount, canModify: amount == null || amt.canModifyFinalAmount === true };
  const data = await celcoin.lookupKey(req.account.account, dec.key);
  const body = data.body || {};
  const e2e = body.endtoEndId || body.endToEndId || body.endtoendid || body.endtoendId;
  if (!e2e) return bad(res, 'LOOKUP_FAILED', 'Não foi possível preparar o pagamento desse código.', 502);
  const own = db.prepare('SELECT 1 FROM accounts WHERE user_id = ? AND account = ?').get(req.user.id, body.account && body.account.account);
  if (own) return bad(res, 'OWN_ACCOUNT', 'Esse código é de uma cobrança da sua própria conta.', 422);
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO pix_lookups (id, user_id, key, data_json, expires_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, req.user.id, dec.key, JSON.stringify({ ...body, endToEndId: e2e, qr }), Date.now() + 1000 * 60 * 30);
  res.json({
    lookupId: id, key: dec.key, keyType: body.keyType, qrType: qr.type, amount: qr.amount, amountLocked: !qr.canModify,
    name: body.owner && (body.owner.tradeName || body.owner.name), document: body.owner && body.owner.documentNumber,
    personType: body.owner && body.owner.type, participant: body.account && body.account.participant,
    city: dec.merchantAccountInformation && dec.merchantAccountInformation.merchantCity,
  });
}));

// ---------------------------------------------------------------- Pix por agência e conta
router.get('/pix/participants', auth.requireUser, wrap(async (req, res) => {
  const list = await celcoin.listParticipants();
  res.json({ participants: list.map((p) => ({ ispb: p.ispb, name: p.shortName || p.name, fullName: p.name })) });
}));

const ACCOUNT_TYPES = { CACC: 'Conta corrente', SVGS: 'Poupança', TRAN: 'Conta de pagamento', SLRY: 'Conta salário' };
router.post('/pix/manual', auth.requireUser, auth.requireAccount, wrap(async (req, res) => {
  const b = req.body || {};
  const bank = v.onlyDigits(b.ispb);
  if (bank.length !== 8) return bad(res, 'INVALID_BANK', 'Escolha o banco.');
  const list = await celcoin.listParticipants();
  const inst = list.find((p) => p.ispb === bank);
  if (!inst) return bad(res, 'INVALID_BANK', 'Banco não encontrado na lista do Pix.');
  const branch = v.onlyDigits(b.branch);
  const account = v.onlyDigits(b.account);
  if (!branch || branch.length > 4) return bad(res, 'INVALID_BRANCH', 'Agência inválida (até 4 números, sem dígito).');
  if (!account || account.length > 20) return bad(res, 'INVALID_ACCOUNT', 'Conta inválida.');
  const accountType = String(b.accountType || '').toUpperCase();
  if (!ACCOUNT_TYPES[accountType]) return bad(res, 'INVALID_ACCOUNT_TYPE', 'Escolha o tipo de conta.');
  const taxId = v.onlyDigits(b.taxId);
  if (!(v.isValidCpf(taxId) || v.isValidCnpj(taxId))) return bad(res, 'INVALID_DOCUMENT', 'CPF ou CNPJ do destinatário inválido.');
  const name = String(b.name || '').trim();
  if (name.length < 3) return bad(res, 'INVALID_NAME', 'Informe o nome do destinatário.');
  if (bank === '13935893' && account === String(req.account.account)) return bad(res, 'OWN_ACCOUNT', 'Essa é a sua própria conta.', 422);
  const id = crypto.randomUUID();
  const manual = { bank, bankName: inst.shortName || inst.name, branch, account, accountType, taxId, name };
  db.prepare('INSERT INTO pix_lookups (id, user_id, key, data_json, expires_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, req.user.id, `${bank}/${branch}/${account}`, JSON.stringify({ manual }), Date.now() + 1000 * 60 * 30);
  res.json({ lookupId: id, name, document: taxId, personType: taxId.length === 14 ? 'LEGAL_PERSON' : 'NATURAL_PERSON', bankName: manual.bankName, branch, account, accountType, accountTypeLabel: ACCOUNT_TYPES[accountType] });
}));

router.post('/pix/transfer', auth.requireUser, auth.requireAccount, wrap(async (req, res) => {
  const lookup = db.prepare('SELECT * FROM pix_lookups WHERE id = ? AND user_id = ?').get(String(req.body.lookupId || ''), req.user.id);
  if (!lookup || lookup.expires_at < Date.now()) return bad(res, 'LOOKUP_EXPIRED', 'A consulta da chave expirou. Informe a chave de novo.', 410);
  const amount = v.parseAmount(req.body.amount);
  if (!amount) return bad(res, 'INVALID_AMOUNT', 'Valor inválido.');
  if (!auth.verifySecret(String(req.body.txPassword || ''), req.user.tx_password_hash)) return bad(res, 'INVALID_TX_PASSWORD', 'Senha de transferência incorreta.', 401);
  const message = String(req.body.message || '').trim().slice(0, 140) || undefined;

  // A Celcoin aceita (200 PROCESSING) mesmo sem saldo e só falha depois; checamos antes para avisar já.
  const balance = Number((await celcoin.getBalance(req.account.account)).body.amount) || 0;
  if (balance < amount) return res.status(422).json({ error: 'INSUFFICIENT_BALANCE', message: FRIENDLY.CBE123, balance });

  const d = JSON.parse(lookup.data_json);
  // Copia e Cola com valor travado: paga exatamente o valor do código.
  if (d.qr && d.qr.amount && !d.qr.canModify && Math.abs(d.qr.amount - amount) > 0.001) {
    return bad(res, 'AMOUNT_LOCKED', `Esse código Pix é de ${d.qr.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} e o valor não pode ser alterado.`);
  }
  const clientCode = celcoin.uid('lobank-pix');
  const counterpart = d.manual
    ? { name: d.manual.name, document: d.manual.taxId, bankName: d.manual.bankName, branch: d.manual.branch, account: d.manual.account, participant: d.manual.bank, via: 'MANUAL' }
    : { name: d.owner && (d.owner.tradeName || d.owner.name), document: d.owner && d.owner.documentNumber, key: lookup.key, participant: d.account && d.account.participant, via: d.qr ? 'QRCODE' : 'DICT' };
  const info = db.prepare("INSERT INTO transactions (user_id, kind, client_code, end_to_end_id, amount, status, counterpart_json, message) VALUES (?, 'PIX_OUT', ?, ?, ?, 'PROCESSING', ?, ?)")
    .run(req.user.id, clientCode, d.endToEndId || null, amount, JSON.stringify(counterpart), message || null);
  db.prepare('DELETE FROM pix_lookups WHERE id = ?').run(lookup.id); // endToEndId não se reaproveita

  const debitParty = { account: req.account.account, branch: req.account.branch, taxId: req.user.document, name: req.user.full_name, accountType: 'TRAN', bank: '13935893' };
  let payload;
  if (d.manual) {
    // Agência e conta: sem DICT, sem key, endToEndId nem transactionIdentification. bank = ISPB.
    const m = d.manual;
    payload = { amount, clientCode, initiationType: 'MANUAL', paymentType: 'IMMEDIATE', urgency: 'HIGH', transactionType: 'TRANSFER', debitParty,
      creditParty: { bank: m.bank, account: m.account, branch: m.branch, taxId: m.taxId, name: m.name, accountType: m.accountType }, remittanceInformation: message };
  } else {
    payload = {
      amount, clientCode, endToEndId: d.endToEndId, paymentType: 'IMMEDIATE', urgency: 'HIGH', transactionType: 'TRANSFER', debitParty,
      // Tipo derivado do decode do QR (estático ou dinâmico), não da presença de transactionIdentification.
      initiationType: d.qr ? (d.qr.type === 'DYNAMIC' ? 'DYNAMIC_QRCODE' : 'STATIC_QRCODE') : 'DICT',
      ...(d.qr ? { transactionIdentification: d.qr.txid } : {}),
      // Campos do DICT replicados exatamente como vieram, inclusive mascarados.
      creditParty: { bank: d.account.participant, key: lookup.key, account: d.account.account, branch: d.account.branch, taxId: d.owner.documentNumber, name: d.owner.name, accountType: d.account.accountType },
      remittanceInformation: message,
    };
  }
  try {
    const r = await celcoin.pixPayment(payload);
    db.prepare("UPDATE transactions SET celcoin_id = ?, updated_at = datetime('now') WHERE id = ?").run(r.body && r.body.id, info.lastInsertRowid);
  } catch (e) {
    if (e.code === 'TRANSPORT') {
      // Mutação ambígua: mantém o clientCode e não reenvia às cegas.
      db.prepare("UPDATE transactions SET status = 'UNKNOWN', error_code = 'TRANSPORT' WHERE id = ?").run(info.lastInsertRowid);
      return res.status(202).json({ txId: info.lastInsertRowid, status: 'UNKNOWN' });
    }
    db.prepare("UPDATE transactions SET status = 'ERROR', error_code = ? WHERE id = ?").run(e.code || 'ERROR', info.lastInsertRowid);
    throw e;
  }
  res.json({ txId: info.lastInsertRowid, status: 'PROCESSING' });
}));

router.get('/pix/transfer/:id', auth.requireUser, wrap(async (req, res) => {
  const t = db.prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?').get(Number(req.params.id), req.user.id);
  if (!t) return bad(res, 'NOT_FOUND', 'Transação não encontrada.', 404);
  if (t.status === 'PROCESSING' && t.celcoin_id) {
    try {
      const s = await celcoin.pixPaymentStatus(t.celcoin_id);
      const e2e = s.body && (s.body.endToEndId || s.body.endtoEndId);
      if (e2e && !t.end_to_end_id) { db.prepare('UPDATE transactions SET end_to_end_id = ? WHERE id = ?').run(e2e, t.id); t.end_to_end_id = e2e; }
      if (s.status && s.status !== t.status) {
        db.prepare("UPDATE transactions SET status = ?, error_code = ?, updated_at = datetime('now') WHERE id = ?").run(s.status, s.error ? s.error.errorCode : null, t.id);
        t.status = s.status;
        t.error_code = s.error ? s.error.errorCode : null;
      }
    } catch (e) {
      if (e.code === 'CBE106' || e.code === 'TRANSPORT' || e.status === 429 || e.status >= 500) {
        // Ainda não localizada ou Celcoin indisponível: segue "em processamento", sem inventar desfecho.
      } else if (e.payload && e.payload.status === 'ERROR') {
        db.prepare("UPDATE transactions SET status = 'ERROR', error_code = ? WHERE id = ?").run(e.code, t.id);
        t.status = 'ERROR';
        t.error_code = e.code;
      } else throw e;
    }
  }
  res.json({
    id: t.id, status: t.status, amount: t.amount, endToEndId: t.end_to_end_id, createdAt: t.created_at, message: t.message,
    counterpart: JSON.parse(t.counterpart_json), errorMessage: t.status === 'ERROR' ? (FRIENDLY[t.error_code] || 'A transferência não foi concluída.') : null,
  });
}));

// ---------------------------------------------------------------- Pix in (QR estático)
router.post('/pix/qrcode', auth.requireUser, auth.requireAccount, wrap(async (req, res) => {
  const keys = ((await celcoin.listKeys(req.account.account)).body.listKeys) || [];
  const evp = keys.find((k) => k.keyType === 'EVP');
  if (!evp) return bad(res, 'NO_KEY', 'Cadastre sua chave aleatória antes de cobrar com Pix.', 409);
  const amount = req.body.amount ? v.parseAmount(req.body.amount) : null;
  if (req.body.amount && !amount) return bad(res, 'INVALID_AMOUNT', 'Valor inválido.');
  const profile = JSON.parse(req.user.profile_json || '{}');
  const payload = {
    key: evp.key,
    merchant: {
      postalCode: profile.postalCode || '01001000', city: String(profile.city || 'Sao Paulo').normalize('NFD').replace(/[̀-ͯ]/g, '').slice(0, 15),
      merchantCategoryCode: '0000', name: req.user.full_name.normalize('NFD').replace(/[̀-ͯ]/g, '').slice(0, 25),
    },
    additionalInformation: String(req.body.description || '').trim().slice(0, 72) || undefined,
  };
  if (amount) payload.amount = amount;
  const data = await celcoin.createStaticQr(payload);
  const emv = data.emvqrcps || (data.body && data.body.emvqrcps);
  if (!emv) return bad(res, 'QR_FAILED', 'Não foi possível gerar o QR Code.', 502);
  const svg = await QRCode.toString(emv, { type: 'svg', margin: 0, color: { dark: '#302d3fff', light: '#ffffffff' } });
  res.json({ emv, svg, amount, key: evp.key });
}));

// ---------------------------------------------------------------- pagamento de contas (boleto)
// Fluxo: authorize (dados e valor atualizado) → billpayment (200 PROCESSING) → status a cada 10 s
// → recibo oficial pelo histórico do evento billpayment. Sem trava de horário: o sandbox não aplica 07–20.
const brTs = (ms) => new Date(ms - 3 * 3600e3).toISOString().slice(0, 19); // horário de Brasília, sem fuso
const num = (x) => (x == null || x === '' ? null : Number(x));
const BILL_FRIENDLY = {
  822: 'Esse código de boleto não é válido. Confira os números e tente de novo.',
  620: 'O banco emissor do boleto não respondeu agora. Espere alguns minutos e tente de novo.',
  623: 'O valor deste boleto passa do limite de R$ 1.000.000,00 por pagamento.',
  PCE020: 'A Celcoin não conseguiu concluir o pagamento.',
  PCE048: 'A consulta do boleto no banco emissor não foi encontrada na hora de pagar.',
  PCE088: 'Esse pagamento passa do limite de pagamentos da conta. Tente um valor menor ou fale com o suporte.',
};

router.post('/bills/authorize', auth.requireUser, auth.requireAccount, wrap(async (req, res) => {
  const code = v.onlyDigits(req.body.code);
  if (code.startsWith('8')) return bad(res, 'CONVENIO_NOT_SUPPORTED', 'Contas de consumo e tributos (água, luz, telefone, impostos) ainda não podem ser pagas no LoBank. Por enquanto, só boletos bancários.', 422);
  if (code.length !== 47 && code.length !== 44) return bad(res, 'INVALID_CODE', 'O código do boleto tem 47 números (ou 44, se veio de um leitor). Confira e tente de novo.');
  let r;
  try { r = await celcoin.authorizeBill(req.account.account, code); }
  catch (e) {
    if (e instanceof celcoin.CelcoinError && BILL_FRIENDLY[e.code]) return bad(res, e.code === '822' ? 'INVALID_CODE' : String(e.code), BILL_FRIENDLY[e.code], e.code === '620' ? 503 : 422);
    throw e;
  }
  const rd = r.registerData || {};
  const total = num(rd.totalUpdated);
  // Sem registerData a CIP não respondeu de verdade (no sandbox, 10/11 19:23: vencimento de 2022, sem mínimo e máximo,
  // e o pagamento terminou em PCE048 com o valor debitado). Não deixa pagar com dados incompletos.
  if (!total || !r.transactionId) return bad(res, 'AUTHORIZE_INCOMPLETE', 'O banco emissor não devolveu os dados completos desse boleto. Espere alguns minutos e tente de novo.', 503);
  const due = rd.dueDateRegister || r.dueDate || null;
  const today = ymdBr(Date.now());
  const bill = {
    code, digitable: r.digitable || (code.length === 47 ? code : null), barCode: code.length === 44 ? code : null,
    transactionId: r.transactionId, assignor: r.assignor || null,
    recipient: rd.recipient || r.assignor || null, recipientDoc: rd.documentRecipient || null, payer: rd.payer || null, payerDoc: rd.documentPayer || null,
    dueDate: due, overdue: !!(due && String(due).slice(0, 10) < today),
    originalValue: num(rd.originalValue) ?? num(r.value), discount: num(rd.discountValue) || 0,
    fine: num(rd.fineValueCalculated) || 0, interest: num(rd.interestValueCalculated) || 0, total,
    allowChangeValue: rd.allowChangeValue === true, minValue: num(rd.minValue), maxValue: num(rd.maxValue),
  };
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO pix_lookups (id, user_id, key, data_json, expires_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, req.user.id, `bill:${code}`, JSON.stringify({ bill }), Date.now() + 1000 * 60 * 30);
  const { transactionId, ...pub } = bill; // eslint-disable-line no-unused-vars
  res.json({ lookupId: id, ...pub });
}));

router.post('/bills/pay', auth.requireUser, auth.requireAccount, wrap(async (req, res) => {
  const lookup = db.prepare('SELECT * FROM pix_lookups WHERE id = ? AND user_id = ?').get(String(req.body.lookupId || ''), req.user.id);
  const d = lookup && JSON.parse(lookup.data_json);
  if (!lookup || !d.bill || lookup.expires_at < Date.now()) return bad(res, 'LOOKUP_EXPIRED', 'A consulta do boleto expirou. Digite o código de novo.', 410);
  const b = d.bill;
  const amount = v.parseAmount(req.body.amount);
  if (!amount) return bad(res, 'INVALID_AMOUNT', 'Valor inválido.');
  const brl = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  if (!b.allowChangeValue && Math.abs(amount - b.total) > 0.001) return bad(res, 'AMOUNT_LOCKED', `Esse boleto é de ${brl(b.total)} e o valor não pode ser alterado.`);
  if (b.allowChangeValue && ((b.minValue && amount < b.minValue - 0.001) || (b.maxValue && amount > b.maxValue + 0.001))) {
    return bad(res, 'AMOUNT_OUT_OF_RANGE', `Para esse boleto, o valor precisa ficar entre ${brl(b.minValue || 0)} e ${brl(b.maxValue || b.total)}.`);
  }
  if (!auth.verifySecret(String(req.body.txPassword || ''), req.user.tx_password_hash)) return bad(res, 'INVALID_TX_PASSWORD', 'Senha de transferência incorreta.', 401);
  const balance = Number((await celcoin.getBalance(req.account.account)).body.amount) || 0;
  if (balance < amount) return res.status(422).json({ error: 'INSUFFICIENT_BALANCE', message: 'Saldo insuficiente para pagar esse boleto.', balance });

  const clientCode = celcoin.uid('lobank-boleto');
  const counterpart = { name: b.recipient, document: b.recipientDoc, assignor: b.assignor, payer: b.payer, payerDoc: b.payerDoc, dueDate: b.dueDate, overdue: b.overdue,
    originalValue: b.originalValue, discount: b.discount, fine: b.fine, interest: b.interest, total: b.total, digitable: b.digitable, barCode: b.barCode, via: 'BOLETO' };
  const info = db.prepare("INSERT INTO transactions (user_id, kind, client_code, amount, status, counterpart_json) VALUES (?, 'BILL', ?, ?, 'PROCESSING', ?)")
    .run(req.user.id, clientCode, amount, JSON.stringify(counterpart));
  db.prepare('DELETE FROM pix_lookups WHERE id = ?').run(lookup.id); // o transactionId do authorize vale para um pagamento
  try {
    const r = await celcoin.payBill({ clientRequestId: clientCode, amount, account: req.account.account, transactionIdAuthorize: b.transactionId,
      barCodeInfo: b.digitable ? { digitable: b.digitable } : { barCode: b.barCode } });
    db.prepare("UPDATE transactions SET celcoin_id = ?, updated_at = datetime('now') WHERE id = ?").run(r.body && r.body.id, info.lastInsertRowid);
  } catch (e) {
    if (e.code === 'TRANSPORT') {
      db.prepare("UPDATE transactions SET status = 'UNKNOWN', error_code = 'TRANSPORT' WHERE id = ?").run(info.lastInsertRowid);
      return res.status(202).json({ txId: info.lastInsertRowid, status: 'UNKNOWN' });
    }
    db.prepare("UPDATE transactions SET status = 'ERROR', error_code = ?, message = ? WHERE id = ?").run(e.code || 'ERROR', e.message || null, info.lastInsertRowid);
    return res.status(200).json({ txId: info.lastInsertRowid, status: 'ERROR' });
  }
  res.json({ txId: info.lastInsertRowid, status: 'PROCESSING' });
}));

function billView(t) {
  const c = JSON.parse(t.counterpart_json);
  return {
    id: t.id, status: t.status, amount: t.amount, createdAt: t.created_at, clientCode: t.client_code, celcoinId: t.celcoin_id,
    bill: { ...c, receipt: undefined, debitOnError: undefined, debitChecked: undefined },
    receipt: c.receipt || null, debitOnError: c.debitOnError || null, debitChecked: !!c.debitChecked, errorCode: t.error_code || null,
    errorMessage: t.status === 'ERROR' ? (BILL_FRIENDLY[t.error_code] || FRIENDLY[t.error_code] || t.message || 'O pagamento não foi concluído.') : null,
  };
}

router.get('/bills/:id', auth.requireUser, auth.requireAccount, wrap(async (req, res) => {
  const t = db.prepare("SELECT * FROM transactions WHERE id = ? AND user_id = ? AND kind = 'BILL'").get(Number(req.params.id), req.user.id);
  if (!t) return bad(res, 'NOT_FOUND', 'Pagamento não encontrado.', 404);
  if (t.status === 'PROCESSING' || t.status === 'UNKNOWN') {
    try {
      const s = await celcoin.billStatus(t.client_code);
      const st = s.status;
      if (st && st !== t.status && ['CONFIRMED', 'ERROR', 'PROCESSING'].includes(st)) {
        const er = s.error || (s.body && s.body.error) || null;
        db.prepare("UPDATE transactions SET status = ?, error_code = ?, message = ?, celcoin_id = COALESCE(celcoin_id, ?), updated_at = datetime('now') WHERE id = ?")
          .run(st, er && er.errorCode, er && er.message, s.body && s.body.id, t.id);
        Object.assign(t, { status: st, error_code: er && er.errorCode, message: er && er.message });
      }
    } catch (e) {
      if (e.code === 'TRANSPORT' || e.status === 429 || e.status === 404 || e.status >= 500) { /* segue em processamento */ }
      else if (e.payload && e.payload.status === 'ERROR') {
        db.prepare("UPDATE transactions SET status = 'ERROR', error_code = ?, message = ? WHERE id = ?").run(e.code, e.message || null, t.id);
        Object.assign(t, { status: 'ERROR', error_code: e.code, message: e.message });
      } else throw e;
    }
  }
  const c = JSON.parse(t.counterpart_json);
  // Falha com dinheiro preso: no sandbox (10/11), dois pagamentos terminaram em ERROR (PCE020, PCE048) e o valor
  // continuou debitado no extrato. Então o app confere o extrato em vez de afirmar que nada foi debitado.
  if (t.status === 'ERROR' && t.client_code) {
    const day = t.created_at.slice(0, 10);
    try {
      const mv = await celcoin.getMovementsSimple(req.account.account, day, ymdBr(Date.now()));
      const list = (mv.body && mv.body.movements) || [];
      const hit = list.find((m) => m.clientCode === t.client_code && m.balanceType === 'DEBIT');
      const back = list.find((m) => m.clientCode === t.client_code && m.balanceType === 'CREDIT');
      c.debitOnError = hit && !back ? { amount: hit.amount, status: hit.status, at: hit.createDate } : null;
      c.debitChecked = true;
    } catch (_) { c.debitChecked = false; }
    t.counterpart_json = JSON.stringify(c);
    db.prepare('UPDATE transactions SET counterpart_json = ? WHERE id = ?').run(t.counterpart_json, t.id);
  }
  // Recibo oficial: só depois de confirmado e só até achar (fica guardado no app).
  if (t.status === 'CONFIRMED' && !c.receipt) {
    const created = Date.parse(t.created_at.replace(' ', 'T') + 'Z');
    try {
      const ev = await celcoin.billReceipt(t.client_code, brTs(created - 5 * 60e3), brTs(created + 60 * 60e3));
      const b = ev && ev.body;
      if (b && b.receipt) {
        c.receipt = { formatted: b.receipt.receiptformatted || '', protocol: b.transactionId || null, authentication: b.authentication || null,
          authenticationCode: (b.authenticationAPI && b.authenticationAPI.BlocoCompleto) || null, convenant: b.convenant || null,
          settleDate: b.settleDate || null, paidAt: b.createDate || null };
        db.prepare('UPDATE transactions SET counterpart_json = ? WHERE id = ?').run(JSON.stringify(c), t.id);
        t.counterpart_json = JSON.stringify(c);
      }
    } catch (e) {
      if (!(e instanceof celcoin.CelcoinError)) throw e; // evento ainda não disponível (ex.: 404 CBE238): tenta na próxima
    }
  }
  res.json(billView(t));
}));

// ---------------------------------------------------------------- DDA (Débito Direto Autorizado)
// Adesão, saída e boletos chegam só por evento (dda-events.js). O status vem do último evento do
// documento; um pedido do app ainda sem evento fica "em processamento".
const ddaEvents = require('./dda-events');
const DDA_TERMS_VERSION = 'modelo-termo-adesao-dda (Celcoin)';
const DDA_FRIENDLY = {
  CDDA106: 'Já existe um pedido de adesão em andamento para esse documento.',
  CDDA101: 'A Celcoin não aceitou o documento.',
  CDDA115: 'Limite de documentos por pedido.',
};
// Adesão e saída só correm em dia útil, das 6h às 22h (horário de Brasília); fora disso ficam para o próximo dia útil.
function ddaInWindow(ms = Date.now()) {
  const br = new Date(ms - 3 * 3600e3);
  const wd = br.getUTCDay(), h = br.getUTCHours();
  return wd >= 1 && wd <= 5 && h >= 6 && h < 22;
}
const cents = (n) => Math.round(Number(n) || 0) / 100;
const PAID = /liquida/i;
function ddaInvoiceView(e, paidCodes) {
  const r = e.body.registerData || {};
  const due = r.dueDate ? String(r.dueDate).slice(0, 10) : null;
  const st = String(r.status || '');
  const situation = (paidCodes.has(r.digitable) || paidCodes.has(r.barCode)) ? 'PAGO' : PAID.test(st) ? 'PAGO'
    : /^aberto/i.test(st) ? (due && due < ymdBr(Date.now()) ? 'VENCIDO' : 'PENDENTE') : 'CANCELADO';
  const ben = r.originalBeneficiary || {};
  return {
    id: r.transactionId || e.id, situation, celcoinStatus: st, paymentSituation: r.paymentSituation || null,
    beneficiary: ben.fantasyName || ben.name || 'Beneficiário', beneficiaryDoc: ben.documentNumber || null,
    bankCode: r.addresseeBank && r.addresseeBank.code, dueDate: due, registeredAt: r.dueDateRegister || null,
    amount: cents(r.calculatedAmount || r.originalValue), originalValue: cents(r.originalValue),
    fine: r.fine ? { code: r.fine.code, description: r.fine.description, amount: r.fine.amount, date: r.fine.date } : null,
    interest: r.interest ? { code: r.interest.code, description: r.interest.description, amount: r.interest.amount, date: r.interest.date } : null,
    discount: (r.discounts || []).find((d) => d.code && d.code !== '0') || null,
    digitable: r.digitable || null, barCode: r.barCode || null, ourNumber: r.ourNumber || null,
    blocked: !!r.blockedPayment, receivedAt: e.received_at,
  };
}
function ddaState(user) {
  const doc = user.document;
  const evs = [...ddaEvents.events(doc, 'SUBSCRIPTION'), ...ddaEvents.events(doc, 'DELETION')].sort((a, b) => a.received_at.localeCompare(b.received_at));
  const last = evs[evs.length - 1];
  const req = db.prepare('SELECT * FROM dda_requests WHERE document = ? ORDER BY id DESC LIMIT 1').get(doc);
  const forReq = req && evs.find((e) => e.body.clientRequestId === req.client_request_id);
  let status = 'NONE', error = null, deleteFailed = false;
  if (req && !forReq) status = req.kind === 'SUBSCRIBE' ? 'PROCESSING' : 'CANCELLING';
  else if (last) {
    const st = String(last.body.status).toUpperCase();
    if (st === 'CREATED') status = 'ACTIVE';
    else if (st === 'ERROR') { status = 'ERROR'; error = (last.body.error && last.body.error[0]) || null; }
    else if (st === 'INACTIVE') status = 'NONE';
    else if (st === 'INACTIVE_FAILED') { status = 'ACTIVE'; deleteFailed = true; }
  }
  return { status, error: error && { code: error.ErrorCode || error.errorCode, message: DDA_FRIENDLY[error.ErrorCode] || error.ErrorMessage || error.message },
    deleteFailed, request: req ? { kind: req.kind, at: req.created_at } : null, since: last && String(last.body.status).toUpperCase() === 'CREATED' ? last.received_at : null };
}
const ddaHasEvents = (doc) => !!db.prepare('SELECT 1 FROM dda_events WHERE document = ? LIMIT 1').get(doc);
function ddaInvoices(user) {
  const paid = new Set();
  for (const t of db.prepare("SELECT counterpart_json FROM transactions WHERE user_id = ? AND kind = 'BILL' AND status = 'CONFIRMED'").all(user.id)) {
    const c = JSON.parse(t.counterpart_json); if (c.digitable) paid.add(c.digitable); if (c.barCode) paid.add(c.barCode);
  }
  const byId = new Map();
  for (const e of ddaEvents.events(user.document, 'INVOICE')) { const v = ddaInvoiceView(e, paid); byId.set(v.id, v); } // o último evento do boleto vale
  return [...byId.values()].sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
}

router.get('/dda', auth.requireUser, auth.requireAccount, wrap(async (req, res) => {
  const sync = await ddaEvents.sync();
  const st = ddaState(req.user);
  const invoices = st.status === 'ACTIVE' ? ddaInvoices(req.user) : [];
  // Sem conseguir ler os avisos e sem nada guardado, "sem DDA" não é confiável: pode já estar ativo.
  const unknown = !sync.ok && st.status === 'NONE' && !st.request && !ddaHasEvents(req.user.document);
  res.json({ ...st, status: unknown ? 'UNKNOWN' : st.status, inWindow: ddaInWindow(), configured: sync.configured, eventsError: sync.error || null, invoices,
    canGenerateTest: celcoin.MODE === 'mock' || /sandbox/.test(celcoin.BASE_URL) });
}));

router.post('/dda/subscribe', auth.requireUser, auth.requireAccount, wrap(async (req, res) => {
  if (req.body.accept !== true) return bad(res, 'TERMS_REQUIRED', 'Para aderir, é preciso aceitar o termo de adesão do DDA.');
  const sync = await ddaEvents.sync();
  const st = ddaState(req.user);
  if (!sync.ok && st.status === 'NONE' && !ddaHasEvents(req.user.document)) {
    return bad(res, 'EVENTS_UNAVAILABLE', `Não conseguimos confirmar se o DDA já está ativo (${sync.error}). Tente de novo em instantes.`, 503);
  }
  if (st.status === 'ACTIVE') return bad(res, 'ALREADY_ACTIVE', 'O DDA já está ativo para essa conta.', 409);
  if (st.status === 'PROCESSING' || st.status === 'CANCELLING') return bad(res, 'IN_PROGRESS', 'Já existe um pedido do DDA em andamento. Aguarde o retorno da Celcoin.', 409);
  const crid = celcoin.uid('lobank-dda');
  const contact = { email: String(req.body.email || '').trim(), phone: v.onlyDigits(req.body.phone), cep: v.onlyDigits(req.body.cep) };
  try {
    const r = await celcoin.ddaSubscribe(req.user.document, req.user.full_name, crid);
    db.prepare("INSERT INTO dda_requests (user_id, document, kind, client_request_id, subscription_id, terms_version, terms_accepted_at, contact_json) VALUES (?, ?, 'SUBSCRIBE', ?, ?, ?, datetime('now'), ?)")
      .run(req.user.id, req.user.document, crid, r.body && r.body.subscriptionId, DDA_TERMS_VERSION, JSON.stringify(contact));
  } catch (e) {
    if (e instanceof celcoin.CelcoinError && DDA_FRIENDLY[e.code]) return bad(res, e.code, DDA_FRIENDLY[e.code], 422);
    throw e;
  }
  res.json({ status: 'PROCESSING', inWindow: ddaInWindow() });
}));

router.post('/dda/cancel', auth.requireUser, auth.requireAccount, wrap(async (req, res) => {
  if (!auth.verifySecret(String(req.body.txPassword || ''), req.user.tx_password_hash)) return bad(res, 'INVALID_TX_PASSWORD', 'Senha de transferência incorreta.', 401);
  await ddaEvents.sync();
  if (ddaState(req.user).status !== 'ACTIVE') return bad(res, 'NOT_ACTIVE', 'O DDA não está ativo para essa conta.', 409);
  const crid = celcoin.uid('lobank-dda-saida');
  const r = await celcoin.ddaUnsubscribe(req.user.document, crid);
  db.prepare("INSERT INTO dda_requests (user_id, document, kind, client_request_id, subscription_id) VALUES (?, ?, 'DELETE', ?, ?)")
    .run(req.user.id, req.user.document, crid, r.body && r.body.subscriptionId);
  res.json({ status: 'CANCELLING', inWindow: ddaInWindow() });
}));

// Só sandbox: pede à Celcoin boletos de teste para o documento da conta.
router.post('/dda/test-invoices', auth.requireUser, auth.requireAccount, wrap(async (req, res) => {
  await ddaEvents.sync();
  if (ddaState(req.user).status !== 'ACTIVE') return bad(res, 'NOT_ACTIVE', 'Ative o DDA antes de gerar boletos de teste.', 409);
  const r = await celcoin.ddaTestInvoices([req.user.document]);
  const ok = ((r.body || [])[0] || {}).status === 'Success';
  if (!ok) return bad(res, 'TEST_INVOICE_FAIL', 'A Celcoin não gerou boletos para esse documento.', 422);
  res.json({ ok: true });
}));

router.get('/dda/invoices/:id', auth.requireUser, auth.requireAccount, wrap(async (req, res) => {
  await ddaEvents.sync();
  const inv = ddaInvoices(req.user).find((i) => i.id === req.params.id);
  if (!inv) return bad(res, 'NOT_FOUND', 'Boleto não encontrado.', 404);
  res.json(inv);
}));

// ---------------------------------------------------------------- modo simulado
if (celcoin.MODE === 'mock') {
  const mock = require('./celcoin-mock');
  router.post('/dev/approve-documentscopy', auth.requireUser, (req, res) => {
    const p = db.prepare('SELECT proposal_id FROM proposals WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(req.user.id);
    res.json({ ok: p ? mock.approveDocumentscopy(p.proposal_id) : false });
  });
  router.post('/dev/credit', auth.requireUser, auth.requireAccount, (req, res) => {
    res.json({ ok: mock.devCredit(req.account.account, v.parseAmount(req.body.amount) || 1000) });
  });
}

// ---------------------------------------------------------------- erros
router.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err instanceof celcoin.CelcoinError) {
    console.warn(`[celcoin] ${req.method} ${req.path} -> ${err.status} ${err.code}`); // sem payload nem segredos
    const status = err.status >= 500 || err.status === 401 ? 502 : err.status;
    return res.status(status).json({ error: err.code, message: FRIENDLY[err.code] || err.message || 'Erro ao falar com a Celcoin.' });
  }
  console.error('[app]', err && err.stack ? err.stack.split('\n')[0] : err);
  res.status(500).json({ error: 'INTERNAL', message: 'Algo deu errado. Tente de novo.' });
});

module.exports = router;
