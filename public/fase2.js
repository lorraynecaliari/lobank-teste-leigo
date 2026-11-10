/* LoBank — Fase 2. Telas novas registradas no mesmo roteador da Fase 1 (app.js).
   Cada tela indica em data-studio o conceito de origem (ou "novo" quando não veio do Studio). */
(function () {
  'use strict';
  const L = window.LoBank;
  const { $, $$, esc, money, onlyDigits, fmtCpf, fmtCnpj, fmtPhone, fmtCep, isValidCpf, api, I, state, route, go, back,
    frame, toast, sheet, setLoading, wizardFrame, wire, ob } = L;

  function isValidCnpj(value) {
    const d = onlyDigits(value);
    if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
    const calc = (len) => {
      const w = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      const r = w.reduce((s, x, i) => s + x * Number(d[i]), 0) % 11;
      return r < 2 ? 0 : 11 - r;
    };
    return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
  }
  L.isValidCnpj = isValidCnpj;

  const brToIso = (v) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v || ''); if (!m) return null; const d = new Date(`${m[3]}-${m[2]}-${m[1]}T12:00:00`); return d.getDate() === Number(m[1]) && d.getMonth() + 1 === Number(m[2]) ? `${m[3]}-${m[2]}-${m[1]}` : null; };
  const fmtBr = (v) => onlyDigits(v).slice(0, 8).replace(/(\d{2})(\d)/, '$1/$2').replace(/(\d{2})\/(\d{2})(\d)/, '$1/$2/$3');
  const isAdult = (iso) => { const age = (Date.now() - new Date(iso)) / (365.25 * 864e5); return age >= 18 && age <= 120; };
  const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim());
  const fld = (id, label, ph, val, attrs) => `<div class="field"><span class="field-label">${label}</span><div class="field-box"><input id="${id}" placeholder="${ph}" value="${esc(val || '')}" ${attrs || ''}/></div><p class="field-error" id="${id}-er"></p></div>`;
  const pj = () => { const o = ob(); return o.kind === 'PJ' ? o : null; };
  const guard = () => { if (!pj() || !pj().termsAccepted) { go('/cadastro'); return false; } return true; };

  // Busca de CEP (ViaCEP) que preenche os campos de um formulário de endereço.
  function wireCep(root, prefix, onFilled) {
    const cep = $(`#${prefix}cep`, root);
    let seq = 0;
    cep.addEventListener('input', async () => {
      cep.value = fmtCep(cep.value);
      const d = onlyDigits(cep.value);
      const er = $(`#${prefix}cep-er`, root);
      er.classList.remove('is-visible');
      if (d.length !== 8) return;
      const my = ++seq;
      try {
        const r = await fetch(`https://viacep.com.br/ws/${d}/json/`);
        const j = await r.json();
        if (my !== seq) return;
        if (j.erro) throw new Error('CEP não encontrado. Confira ou preencha o endereço à mão.');
        const set = (k, v) => { const el = $(`#${prefix}${k}`, root); if (el && v && !el.value) el.value = v; };
        set('street', j.logradouro); set('nb', j.bairro); set('city', j.localidade); set('uf', j.uf);
        if (onFilled) onFilled();
      } catch (e) {
        if (my !== seq) return;
        er.textContent = e.message.startsWith('CEP') ? e.message : 'Não foi possível buscar o CEP. Preencha o endereço à mão.';
        er.classList.add('is-visible');
      }
    });
  }
  const addrFields = (prefix, a) => `${fld(prefix + 'cep', 'CEP', '00000-000', fmtCep(a.postalCode || ''), 'inputmode="numeric" maxlength="9"')}
    ${fld(prefix + 'street', 'Rua', 'Nome da rua', a.street, 'maxlength="200"')}
    <div class="row2">${fld(prefix + 'num', 'Número', 'Nº', a.number, 'maxlength="10"')}${fld(prefix + 'comp', 'Complemento', 'Opcional', a.complement, 'maxlength="60"')}</div>
    ${fld(prefix + 'nb', 'Bairro', 'Bairro', a.neighborhood, 'maxlength="200"')}
    <div class="row2 row2--wide-first">${fld(prefix + 'city', 'Cidade', 'Cidade', a.city, 'maxlength="100"')}${fld(prefix + 'uf', 'UF', 'SP', a.state, 'maxlength="2" style="text-transform:uppercase"')}</div>`;
  const readAddr = (root, prefix) => ({
    postalCode: onlyDigits($(`#${prefix}cep`, root).value), street: $(`#${prefix}street`, root).value.trim(), number: $(`#${prefix}num`, root).value.trim(),
    complement: $(`#${prefix}comp`, root).value.trim(), neighborhood: $(`#${prefix}nb`, root).value.trim(), city: $(`#${prefix}city`, root).value.trim(),
    state: $(`#${prefix}uf`, root).value.trim().toUpperCase(),
  });
  const addrOk = (a) => a.postalCode.length === 8 && a.street && a.number && a.neighborhood && a.city && /^[A-Z]{2}$/.test(a.state);

  // Lista de opções em linha (padrão das telas "Tipo de empresa" e "Faturamento" do Studio).
  function optionsStep(o) {
    route(o.path, (root) => {
      if (!guard()) return;
      const cur = ob()[o.key];
      root.innerHTML = wizardFrame(o.step, `<h1 class="headline">${o.title}</h1>${o.desc ? `<p class="subtext">${o.desc}</p>` : ''}
        <div class="option-list" style="margin-top:8px">${o.options.map((x) => `<button type="button" class="option-row ${x.v === cur ? 'is-selected' : ''}" data-v="${esc(x.v)}" style="height:auto;min-height:56px">
          <span class="option-row-label">${esc(x.label)}${x.sub ? `<span class="option-sub">${esc(x.sub)}</span>` : ''}</span><span class="option-row-radio"></span></button>`).join('')}</div>`, null, o.studio);
      const next = wire(root, () => go(o.next));
      next.disabled = !cur;
      $$('.option-row', root).forEach((r) => { r.onclick = () => { $$('.option-row', root).forEach((x) => x.classList.remove('is-selected')); r.classList.add('is-selected'); ob()[o.key] = r.dataset.v; next.disabled = false; }; });
    });
  }

  // Tela de um campo de texto no cadastro PJ.
  function pjText(o) {
    route(o.path, (root) => {
      if (!guard()) return;
      root.innerHTML = wizardFrame(o.step, `<h1 class="headline">${o.title}</h1>${o.desc ? `<p class="subtext">${o.desc}</p>` : ''}
        <div class="field-group"><div class="field"><div class="field-box"><input id="f" ${o.attrs || ''} placeholder="${esc(o.placeholder)}" value="${esc(o.format ? o.format(ob()[o.key] || '') : ob()[o.key] || '')}"/>${o.icon ? '<span class="icon-r" id="ic"></span>' : ''}</div>
        <p class="field-error" id="er"></p></div>${o.extra || ''}</div>`, null, o.studio);
      const f = $('#f'), er = $('#er');
      const next = wire(root, () => { ob()[o.key] = o.store ? o.store(f.value) : f.value.trim(); go(o.next); });
      const check = () => {
        const msg = o.validate(f.value);
        next.disabled = !!msg;
        const show = !!(msg && o.showWhen && o.showWhen(f.value));
        er.textContent = show ? msg : ''; er.classList.toggle('is-visible', show);
        const ic = $('#ic');
        if (ic) { const full = o.showWhen && o.showWhen(f.value); ic.classList.toggle('is-visible', !!full); ic.innerHTML = full ? (msg ? I.err : I.ok) : ''; }
      };
      f.oninput = () => { if (o.format) f.value = o.format(f.value); check(); };
      check();
      if (o.after) o.after(root);
    });
  }

  // ============================================================ CADASTRO PJ
  // Studio: board "Onboarding - PJ". Procuração retirada por comentário ("Essa tela não deve ser criada").
  // O comentário "Teste" em "Tipo de conta" não é requisito.

  // Studio: "PJ | Termos de uso" (opcional). Conteúdo do app, não um contrato real.
  route('/cadastro-pj/termos', (root) => {
    if (!pj()) return go('/cadastro');
    root.innerHTML = frame(`
      <header class="topbar"><button class="back-btn" data-back aria-label="Voltar">${I.back}</button><div class="crumb"><div class="crumb-row"><span class="crumb-title">Cadastro de Conta Empresarial</span></div></div></header>
      <div class="content">
        <h1 class="headline">Antes de começar, <strong>leia os termos</strong></h1>
        <div class="note-box"><ul>
          <li>Esta é uma conta de <strong>teste</strong> no ambiente sandbox da Celcoin. Nenhum dinheiro real é movimentado.</li>
          <li>Os dados da empresa e dos sócios serão enviados à Celcoin para abertura da conta. <strong>Cada sócio</strong> informado fará a própria validação de identidade (documento e selfie).</li>
          <li>Os termos jurídicos definitivos do LoBank ainda não foram redigidos.</li>
        </ul></div>
        <button type="button" class="option" id="acc"><span class="option-label">Li e aceito os termos de uso e a política de privacidade</span><span class="option-radio"></span></button>
      </div>
      <div class="actions"><button class="btn btn-primary" data-next disabled>Aceitar e continuar</button></div>`, { studio: '58d0ae68 PJ Termos de uso (conteúdo do app)' });
    const next = wire(root, () => { ob().termsAccepted = true; go('/cadastro-pj/tipo'); });
    $('#acc').onclick = (e) => { e.currentTarget.classList.toggle('is-selected'); next.disabled = !e.currentTarget.classList.contains('is-selected'); };
  });

  // Studio: "PJ | Tipo de empresa" (lido). A API só distingue PJ e MEI; a escolha detalhada fica no app.
  optionsStep({ path: '/cadastro-pj/tipo', step: 1, key: 'companyKind', title: 'Qual o tipo de <strong>classificação da sua empresa?</strong>', next: '/cadastro-pj/cnpj',
    studio: 'c1ad4ca7 Tipo de empresa', options: [
      { v: 'MEI', label: 'MEI', sub: 'Microempreendedor Individual' }, { v: 'EI', label: 'EI', sub: 'Empreendedor Individual' },
      { v: 'SLU', label: 'SLU', sub: 'Sociedade Limitada Unipessoal' }, { v: 'LTDA', label: 'LTDA', sub: 'Sociedade Limitada' },
      { v: 'SS', label: 'SS', sub: 'Sociedade Simples' }, { v: 'SA', label: 'S.A', sub: 'Sociedade Anônima' }] });

  // Studio: "PJ | CNPJ" + "Modal | Por que o CNPJ" (modelo comum, como o CPF da PF)
  pjText({ path: '/cadastro-pj/cnpj', step: 2, key: 'cnpj', title: '<strong>Digite o CNPJ</strong> da empresa', placeholder: '00.000.000/0000-00', attrs: 'inputmode="numeric" autocomplete="off" maxlength="18"',
    studio: '2562ee5b CNPJ + b0dac0a4 Modal Por que o CNPJ (modelo comum)', icon: true, format: fmtCnpj, store: onlyDigits,
    validate: (v) => (isValidCnpj(v) ? '' : 'CNPJ inválido. Confira os números.'), showWhen: (v) => onlyDigits(v).length === 14,
    extra: `<button type="button" class="link-inline" id="why">${I.shield} Por que informar o CNPJ?</button>`,
    after: () => {
      $('#why').onclick = () => {
        const s = sheet(`<h2 class="sheet-title">Por que o CNPJ?</h2>
          <p class="sheet-text">O CNPJ identifica a empresa na Receita Federal. Com ele validamos a razão social e a composição societária, e evitamos cadastros duplicados.</p>
          <div class="info-box" style="margin-top:16px"><span class="info-box-bar"></span><span class="info-box-text">Os dados da empresa ficam protegidos na Celcoin e não são compartilhados.</span></div>
          <div class="sheet-actions"><button class="btn btn-primary" data-x>Entendido</button></div>`);
        $('[data-x]', s.el).onclick = s.close;
      };
    },
    next: '/cadastro-pj/razao-social' });

  // Studio: "PJ | Razão social" e "PJ | Nome da empresa" (modelo comum)
  pjText({ path: '/cadastro-pj/razao-social', step: 3, key: 'businessName', title: 'Qual a <strong>razão social</strong> da empresa?', desc: 'O nome oficial da empresa, que aparece no cartão CNPJ e nos documentos.',
    placeholder: 'Ex.: Padaria Bom Dia LTDA', attrs: 'maxlength="150"', studio: '3ae92d6a Razão social (modelo comum)',
    validate: (v) => (v.trim().length >= 3 ? '' : 'Informe a razão social.'), next: '/cadastro-pj/nome' });
  pjText({ path: '/cadastro-pj/nome', step: 4, key: 'tradingName', title: 'Qual o <strong>nome da empresa</strong>?', desc: 'O nome fantasia, como seus clientes conhecem a empresa.',
    placeholder: 'Ex.: Padaria Bom Dia', attrs: 'maxlength="150"', studio: '0acf6c9a Nome da empresa (modelo comum)',
    validate: (v) => (v.trim().length >= 2 ? '' : 'Informe o nome da empresa.'), next: '/cadastro-pj/faturamento' });

  // Studio: "PJ | Faturamento" (lido). Fica só no app: a proposta PJ da Celcoin não tem esse campo.
  // Faixas copiadas do Studio, inclusive o salto de R$ 300 mil para R$ 360 mil.
  optionsStep({ path: '/cadastro-pj/faturamento', step: 5, key: 'revenue', title: 'Qual a <strong>média de faturamento</strong> da sua empresa por ano?', next: '/cadastro-pj/contato',
    studio: '3e11977a Faturamento', options: ['até R$ 81 mil', 'de R$ 81 mil a R$ 300 mil', 'de R$ 360 mil a R$ 4,8 milhões', 'de R$ 4,8 milhões a R$ 16 milhões',
      'de R$ 16 milhões a R$ 90 milhões', 'de R$ 90 milhões a R$ 300 milhões'].map((x) => ({ v: x, label: x })) });

  // Novo: e-mail e telefone da empresa. A Celcoin exige businessEmail e contactNumber; não há tela no Studio.
  route('/cadastro-pj/contato', (root) => {
    if (!guard()) return;
    const o = ob();
    root.innerHTML = wizardFrame(6, `<h1 class="headline"><strong>Contato</strong> da empresa</h1>
      <div class="field-group">${fld('em', 'E-mail da empresa', 'contato@empresa.com', o.businessEmail, 'type="email" maxlength="100"')}
      ${fld('ph', 'Telefone da empresa', '(00) 00000-0000', fmtPhone(o.businessPhone || ''), 'inputmode="tel" maxlength="15"')}
      <p class="field-helper">${state.mode === 'mock' ? 'Modo simulado: final 2 reprova a conta.' : 'No sandbox da Celcoin, o final deste telefone controla o teste: final 2 reprova a conta.'}</p></div>
      <p class="studio-note">Tela criada para o app: a Celcoin pede esses dados e o Studio não tem a tela.</p>`, null, 'novo:pj-contato');
    const next = wire(root, () => { o.businessEmail = $('#em').value.trim(); o.businessPhone = onlyDigits($('#ph').value); go('/cadastro-pj/endereco'); });
    const check = () => { next.disabled = !(isEmail($('#em').value) && onlyDigits($('#ph').value).length === 11); };
    $('#ph').oninput = () => { $('#ph').value = fmtPhone($('#ph').value); check(); };
    $('#em').oninput = check;
    check();
  });

  // Novo: endereço da empresa e endereço do responsável. A Celcoin exige os dois; o Studio PJ não tem tela de endereço.
  function addrStep(o) {
    route(o.path, (root) => {
      if (!guard()) return;
      const a = o.get() || {};
      root.innerHTML = wizardFrame(o.step, `<h1 class="headline">${o.title}</h1><p class="subtext">Digite o CEP para preencher o resto automaticamente.</p>
        <div class="field-group">${addrFields('a-', a)}</div>
        <p class="studio-note">Tela criada para o app: a Celcoin pede esse endereço e o Studio não tem a tela.</p>`, null, o.studio);
      const next = wire(root, () => { o.set(readAddr(root, 'a-')); go(o.next); });
      const check = () => { next.disabled = !addrOk(readAddr(root, 'a-')); };
      $$('input', root).forEach((i) => { i.addEventListener('input', check); });
      wireCep(root, 'a-', check);
      check();
    });
  }
  addrStep({ path: '/cadastro-pj/endereco', step: 7, title: 'Qual o <strong>endereço da empresa</strong>?', studio: 'novo:pj-endereco-empresa',
    get: () => ob().businessAddress, set: (a) => { ob().businessAddress = a; }, next: '/cadastro-pj/quem' });

  // Studio: "PJ | Quem está preenchendo" (lido). Sócio -> ownerType SOCIO; representante -> REPRESENTANTE.
  route('/cadastro-pj/quem', (root) => {
    if (!guard()) return;
    const mei = ob().companyKind === 'MEI';
    if (mei) ob().fillerRole = 'socio';
    const cur = ob().fillerRole;
    root.innerHTML = wizardFrame(8, `<h1 class="headline">Quem está preenchendo este <strong>cadastro?</strong></h1>
      <p class="subtext">Isso nos ajuda a saber quais documentos pedir a seguir.</p>
      <div class="options">
        <button type="button" class="option ${cur === 'socio' ? 'is-selected' : ''}" data-v="socio"><span class="option-avatar">${I.person}</span><span class="option-label">Sou sócio da empresa</span><span class="option-radio"></span></button>
        ${mei ? '' : `<button type="button" class="option ${cur === 'representante' ? 'is-selected' : ''}" data-v="representante"><span class="option-avatar">${I.briefcase}</span><span class="option-label">Sou representante legal</span><span class="option-radio"></span></button>`}
      </div>${mei ? '<div class="info-box" style="margin-top:16px"><span class="info-box-bar"></span><span class="info-box-text">No MEI, o cadastro é feito pelo próprio titular da empresa.</span></div>' : ''}`, null, '728d5ec6 Quem está preenchendo' + (mei ? ' (MEI: só titular)' : ''));
    const next = wire(root, () => go('/cadastro-pj/seus-dados'));
    next.disabled = !cur;
    $$('.option', root).forEach((x) => { x.onclick = () => { $$('.option', root).forEach((y) => y.classList.remove('is-selected')); x.classList.add('is-selected'); ob().fillerRole = x.dataset.v; next.disabled = false; }; });
  });

  // Interruptor Sim/Não (padrão do Studio em "Seus dados" e no modal de sócio)
  const toggleHtml = (id, on) => `<div class="ppe"><span class="ppe__label">Pessoa publicamente exposta?</span>
    <label class="tgl"><span class="tgl__side ${on ? '' : 'is-on'}">Não</span><input type="checkbox" id="${id}" ${on ? 'checked' : ''}/><span class="tgl__track"><span class="tgl__thumb"></span></span><span class="tgl__side ${on ? 'is-on' : ''}">Sim</span></label></div>`;
  const wireToggle = (root, id) => { const t = $('#' + id, root); t.onchange = () => { const s = $$('.tgl__side', t.closest('.tgl')); s[0].classList.toggle('is-on', !t.checked); s[1].classList.toggle('is-on', t.checked); }; };

  // Formulário de pessoa física (responsável ou sócio): nome, CPF, nascimento, nome da mãe, telefone, e-mail, PPE.
  // O Studio não pede nome da mãe, mas a Celcoin exige para cada sócio.
  const personFields = (p, prefix) => `${fld(prefix + 'name', 'Nome completo', 'Nome e sobrenome', p.fullName, 'maxlength="120" autocomplete="off"')}
    ${fld(prefix + 'cpf', 'CPF', '000.000.000-00', fmtCpf(p.cpf || ''), 'inputmode="numeric" maxlength="14" autocomplete="off"')}
    ${fld(prefix + 'birth', 'Data de nascimento', 'DD/MM/AAAA', p.birthBr, 'inputmode="numeric" maxlength="10"')}
    ${fld(prefix + 'mother', 'Nome da mãe', 'Nome completo da mãe', p.motherName, 'maxlength="120"')}
    ${fld(prefix + 'phone', 'Telefone', '(00) 00000-0000', fmtPhone(p.phone || ''), 'inputmode="tel" maxlength="15"')}
    ${fld(prefix + 'email', 'E-mail', 'nome@email.com', p.email, 'type="email" maxlength="100"')}`;
  function readPerson(root, prefix, exclude) {
    const g = (k) => $(`#${prefix}${k}`, root).value;
    const p = { fullName: g('name').trim(), cpf: onlyDigits(g('cpf')), birthBr: g('birth'), birthDate: brToIso(g('birth')), motherName: g('mother').trim(), phone: onlyDigits(g('phone')), email: g('email').trim() };
    const errs = {};
    if (p.fullName.split(/\s+/).length < 2) errs.name = 'Informe nome e sobrenome.';
    if (p.cpf.length === 11 && !isValidCpf(p.cpf)) errs.cpf = 'CPF inválido.';
    else if (p.cpf.length === 11 && exclude && exclude.includes(p.cpf)) errs.cpf = 'Esse CPF já foi informado.';
    else if (p.cpf.length !== 11) errs.cpf = 'Informe o CPF.';
    if (p.birthBr.length === 10 && (!p.birthDate || !isAdult(p.birthDate))) errs.birth = 'Data inválida ou menor de 18 anos.';
    else if (p.birthBr.length !== 10) errs.birth = 'Informe a data.';
    if (p.motherName.length < 3) errs.mother = 'Informe o nome da mãe.';
    if (p.phone.length !== 11) errs.phone = 'Informe DDD + 9 dígitos.';
    if (!isEmail(p.email)) errs.email = 'E-mail inválido.';
    return { p, errs };
  }
  function wirePerson(root, prefix, onChange) {
    const on = (k, fmt) => { const el = $(`#${prefix}${k}`, root); el.addEventListener('input', () => { if (fmt) el.value = fmt(el.value); onChange(); }); };
    on('name'); on('cpf', fmtCpf); on('birth', fmtBr); on('mother'); on('phone', fmtPhone); on('email');
  }
  // Só mostra erro de campo já preenchido por completo (CPF, data) ou de campo que a pessoa já deixou.
  function showErrs(root, prefix, errs, touched) {
    ['name', 'cpf', 'birth', 'mother', 'phone', 'email'].forEach((k) => {
      const er = $(`#${prefix}${k}-er`, root);
      const el = $(`#${prefix}${k}`, root);
      const full = (k === 'cpf' && onlyDigits(el.value).length === 11) || (k === 'birth' && el.value.length === 10);
      const show = !!errs[k] && (full || touched.has(k));
      er.textContent = show ? errs[k] : ''; er.classList.toggle('is-visible', show);
    });
  }

  // Studio: "PJ | Seus dados" (lido) + nome da mãe (exigido pela Celcoin)
  route('/cadastro-pj/seus-dados', (root) => {
    if (!guard()) return;
    const o = ob();
    const me = o.filler || {};
    root.innerHTML = wizardFrame(9, `<h1 class="headline">Informe os <strong>seus dados</strong></h1><p class="subtext">Informe os dados do responsável pelo cadastro.</p>
      <div class="field-group">${personFields(me, 'p-')}</div>${toggleHtml('p-pep', me.isPep === true)}`, null, '277d3802 Seus dados (+ nome da mãe)');
    const touched = new Set();
    const next = wire(root, () => { const { p } = readPerson(root, 'p-'); o.filler = { ...p, isPep: $('#p-pep').checked }; o.address = o.address && o.address.number ? o.address : {}; go('/cadastro-pj/seu-endereco'); });
    const check = () => { const { errs } = readPerson(root, 'p-'); showErrs(root, 'p-', errs, touched); next.disabled = Object.keys(errs).length > 0; };
    $$('input', root).forEach((i) => i.addEventListener('blur', () => { touched.add(i.id.replace('p-', '')); check(); }));
    wirePerson(root, 'p-', check);
    wireToggle(root, 'p-pep');
    check();
  });

  addrStep({ path: '/cadastro-pj/seu-endereco', step: 10, title: 'Qual o <strong>seu endereço</strong>?', studio: 'novo:pj-endereco-responsavel',
    get: () => ob().address, set: (a) => { ob().address = a; }, next: '/cadastro-pj/socios' });

  // Studio: "PJ | Adicionar sócios" + "Modal | Adicionar sócio" (lidos).
  // Adaptações: sócio pessoa jurídica fica indisponível (a API só aceita CPF em owner); o modal ganha nascimento,
  // nome da mãe, telefone, e-mail e endereço, que a Celcoin exige de cada sócio.
  const MAX_PARTNERS = 10;
  route('/cadastro-pj/socios', (root) => {
    if (!guard()) return;
    const o = ob();
    o.partners = o.partners || [];
    if (o.companyKind === 'MEI') {
      // Regra da Celcoin: MEI tem um único owner (SOCIO). Não há sócios a adicionar.
      o.partners = [];
      root.innerHTML = wizardFrame(11, `<h1 class="headline">MEI tem <strong>um único titular</strong></h1>
        <p class="subtext">Como a empresa é MEI, a conta é aberta só com os seus dados. Não é preciso adicionar sócios.</p>
        <div class="info-box" style="margin-top:16px"><span class="info-box-bar"></span><span class="info-box-text">Se a empresa tiver sócios, ela não é MEI. Volte ao início e escolha o tipo certo.</span></div>`,
        `<button type="button" class="btn btn-primary" data-next>Continuar</button><button type="button" class="btn btn-ghost" data-back>Voltar</button>`, 'a631c7eb Adicionar sócios (MEI: sem sócios, regra da Celcoin)');
      wire(root, () => go('/cadastro/senha'));
      return;
    }
    const list = o.partners.length
      ? `<div class="card" style="margin-top:16px">${o.partners.map((s, i) => `<div class="row"><span class="row__icon">${I.person}</span><div class="row__info"><span class="row__label">${esc(s.fullName)}</span>
          <span class="row__caption">CPF ${esc(fmtCpf(s.cpf))}${s.share ? ' · ' + esc(s.share) + '%' : ''}</span></div><button class="key-card__btn key-card__btn--danger" data-rm="${i}" aria-label="Remover sócio">${I.trash}</button></div>`).join('')}</div>`
      : `<div class="empty-card"><span class="empty-card__icon">${I.person}</span><p class="empty-card__title">Nenhum sócio adicionado ainda</p></div>`;
    root.innerHTML = wizardFrame(11, `<h1 class="headline">Quer adicionar <strong>outros sócios?</strong></h1>
      <p class="subtext">Inclua todos os sócios da empresa com 25% de participação ou mais. Isso ajuda a evitar que sua conta seja reprovada depois.</p>
      <div class="info-box" style="margin-top:16px"><span class="info-box-bar"></span><span class="info-box-text">Essa informação é cruzada com a Receita Federal para validar a composição societária da empresa. Cada sócio fará a própria validação de identidade.</span></div>
      ${list}<p class="empty-card__count">${o.partners.length} de ${MAX_PARTNERS} sócios adicionados</p>`,
      `<button type="button" class="btn btn-outline" id="add" ${o.partners.length >= MAX_PARTNERS ? 'disabled' : ''}>+ Adicionar sócio</button><button type="button" class="btn btn-primary" data-next>Continuar</button>`,
      'a631c7eb Adicionar sócios + 0f726f1e Modal Adicionar sócio (com campos exigidos pela Celcoin)');
    wire(root, () => go('/cadastro/senha'));
    $$('[data-rm]', root).forEach((b) => { b.onclick = () => { o.partners.splice(Number(b.dataset.rm), 1); L.render(); }; });
    $('#add').onclick = () => openPartner(root);
  });

  function openPartner() {
    const o = ob();
    const s = sheet(`<h2 class="sheet-title">Adicionar novo sócio</h2><p class="sheet-text">Esse sócio é uma pessoa física ou jurídica?</p>
      <div class="seg"><button type="button" class="seg__btn is-active" id="s-pf">Pessoa física</button><button type="button" class="seg__btn" id="s-pj">Pessoa jurídica</button></div>
      <div id="s-pjmsg" class="info-box info-box--warn hidden" style="margin-top:12px"><span class="info-box-bar"></span><span class="info-box-text">A abertura de conta da Celcoin só aceita sócios pessoa física (CPF). Um sócio empresa precisa ser cadastrado pelos sócios pessoa física dele.</span></div>
      <div id="s-form"><div class="field-group" style="margin-top:12px">${personFields({}, 's-')}${fld('s-share', 'Participação societária (%)', 'Ex.: 50', '', 'inputmode="numeric" maxlength="3"')}
      <p class="sheet-text" style="margin:8px 0 0;font-weight:600">Endereço do sócio</p>${addrFields('s-', {})}</div>${toggleHtml('s-pep', false)}</div>
      <div class="sheet-actions"><button class="btn btn-primary" data-ok disabled>Adicionar sócio</button><button class="btn btn-ghost" data-x>Cancelar</button></div>`);
    const el = s.el;
    $('.sheet', el).style.maxHeight = '90%';
    $('.sheet', el).style.overflowY = 'auto';
    const ok = $('[data-ok]', el);
    $('[data-x]', el).onclick = s.close;
    const isPf = () => $('#s-pf', el).classList.contains('is-active');
    $('#s-pf', el).onclick = () => { $('#s-pf', el).classList.add('is-active'); $('#s-pj', el).classList.remove('is-active'); $('#s-form', el).classList.remove('hidden'); $('#s-pjmsg', el).classList.add('hidden'); check(); };
    $('#s-pj', el).onclick = () => { $('#s-pj', el).classList.add('is-active'); $('#s-pf', el).classList.remove('is-active'); $('#s-form', el).classList.add('hidden'); $('#s-pjmsg', el).classList.remove('hidden'); ok.disabled = true; };
    const used = [(o.filler || {}).cpf, ...o.partners.map((p) => p.cpf)].filter(Boolean);
    const touched = new Set();
    const check = () => {
      if (!isPf()) { ok.disabled = true; return; }
      const { errs } = readPerson(el, 's-', used);
      showErrs(el, 's-', errs, touched);
      const share = Number($('#s-share', el).value);
      const shareOk = !$('#s-share', el).value || (share > 0 && share <= 100);
      ok.disabled = Object.keys(errs).length > 0 || !shareOk || !addrOk(readAddr(el, 's-'));
    };
    $$('input', el).forEach((i) => { i.addEventListener('input', check); i.addEventListener('blur', () => { touched.add(i.id.replace('s-', '')); check(); }); });
    $('#s-share', el).addEventListener('input', (e) => { e.target.value = onlyDigits(e.target.value).slice(0, 3); });
    wirePerson(el, 's-', check);
    wireCep(el, 's-', check);
    wireToggle(el, 's-pep');
    ok.onclick = () => {
      const { p } = readPerson(el, 's-', used);
      o.partners.push({ ...p, share: $('#s-share', el).value || null, isPep: $('#s-pep', el).checked, address: readAddr(el, 's-') });
      s.close();
      toast('Sócio adicionado.');
      L.render();
    };
  }
})();

/* ---------------------------------------------------------------- Pix Copia e Cola e agência e conta */
(function () {
  'use strict';
  const L = window.LoBank;
  const { $, $$, esc, money, onlyDigits, fmtCpf, fmtCnpj, fmtDoc, isValidCpf, api, I, state, route, go, back, frame, toast, setLoading, loadMe, LOGO } = L;
  const header = () => `<header class="hdr hdr--wl"><button class="hdr__icon" id="bk" aria-label="Voltar">${I.chevLeft}</button><span class="logo">${LOGO('#7664FA', 104)}</span><span class="hdr__icon"></span></header>`;
  async function needAccount() {
    if (!(await loadMe())) { go('/login'); return false; }
    if (!state.me.account) { go('/validacao'); return false; }
    return true;
  }

  // ============================================================ PIX COPIA E COLA (novo: não há tela no Studio)
  // Montada com o modelo da tela "Transferir | Chave Pix | Informar chave". Depois segue pelo fluxo de valor,
  // revisão e resultado já existentes. O valor fica travado quando o código traz valor fixo.
  route('/pix/copia-e-cola', async (root) => {
    if (!(await needAccount())) return;
    root.innerHTML = frame(`${header()}
      <div class="scroll"><section class="intro"><h1 class="intro__title intro__title--sm">Pagar com Pix Copia e Cola</h1><p class="intro__desc">Cole o código que você recebeu. Ele começa com 000201.</p></section>
        <section class="keyfield"><span class="keyfield__label">Código Pix</span>
          <div class="keyfield__input keyfield__input--area" id="box"><textarea id="emv" rows="5" autocomplete="off" spellcheck="false" placeholder="00020126...">${esc((state.emv && state.emv.code) || '')}</textarea></div>
          <p class="keyfield__err hidden" id="er"></p>
          <button type="button" class="link-inline" id="paste">${I.copy} Colar da área de transferência</button>
        </section>
        <p class="studio-note">Tela criada para o app: não existe no Studio.</p></div>
      <footer class="footbar"><button class="btn btn-primary btn--lg" id="next" disabled>Continuar</button></footer>`, { studio: 'novo:pix-copia-e-cola (modelo 5196768b Informar chave)' });
    $('#bk').onclick = () => go('/pix');
    const emv = $('#emv'), next = $('#next'), er = $('#er'), box = $('#box');
    const clean = () => emv.value.replace(/[\r\n\t]+/g, '').trim(); // espaços internos fazem parte do código
    const check = () => { next.disabled = clean().length < 50; er.classList.add('hidden'); box.classList.remove('is-error'); };
    emv.oninput = check;
    check();
    $('#paste').onclick = async () => {
      try { emv.value = (await navigator.clipboard.readText()).trim(); check(); }
      catch (_) { toast('Não deu para ler a área de transferência. Cole no campo com Ctrl+V.'); emv.focus(); }
    };
    next.onclick = async () => {
      setLoading(next, true);
      try {
        const code = clean();
        const r = await api('/pix/emv', { method: 'POST', body: { emv: code } });
        state.emv = { code };
        state.pix = { key: r.key, lookup: r, via: 'emv', amount: r.amount || null };
        go(r.amountLocked ? '/pix/transferir/revisao' : '/pix/transferir/valor');
      } catch (e) {
        box.classList.add('is-error'); er.textContent = e.message; er.classList.remove('hidden');
        setLoading(next, false); next.disabled = false;
      }
    };
  });

  // ============================================================ TRANSFERIR POR AGÊNCIA E CONTA
  // Studio: board "Transferir": Selecionar banco → Dados da conta destino (Outra conta / Minha conta) → Tipo de conta
  // do destinatário → Valor → Confirmação. Retirados: aba Favoritos (sem dados reais nesta fase).
  // O Pix sai como initiationType MANUAL; o banco vai pelo ISPB (lista /pix/v1/participants da Celcoin).
  const tr = () => (state.transfer = state.transfer || {});
  let participants = null;

  // Studio: "Transferir | Agência e conta | Selecionar banco" (modelo comum)
  route('/transferir/conta', async (root) => {
    if (!(await needAccount())) return;
    root.innerHTML = frame(`${header()}
      <div class="scroll"><section class="intro"><h1 class="intro__title intro__title--sm">Para qual <strong>banco</strong>?</h1><p class="intro__desc">Busque pelo nome do banco ou da instituição.</p></section>
        <section class="keyfield"><div class="keyfield__input" id="box"><input id="q" autocomplete="off" placeholder="Ex.: Itaú, Nubank, Celcoin"/></div></section>
        <section class="body-sec" id="list"><div class="empty">${I.spinner}</div></section></div>`, { studio: '14c51fac Selecionar banco (modelo comum)' });
    $('#bk').onclick = () => go('/pix');
    try { if (!participants) participants = (await api('/pix/participants')).participants; }
    catch (e) { $('#list').innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
    const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
    const FIRST = ['13935893', '00000000', '00360305', '60701190', '60746948', '90400888', '18236120', '00416968']; // Celcoin e grandes bancos primeiro
    const paint = () => {
      const q = norm($('#q').value.trim());
      let list = participants.filter((p) => !q || norm(p.name).includes(q) || norm(p.fullName).includes(q) || p.ispb.includes(q));
      if (!q) list = FIRST.map((i) => participants.find((p) => p.ispb === i)).filter(Boolean);
      $('#list').innerHTML = (q ? '' : '<div class="day">Mais usados</div>') + (list.slice(0, 40).map((p) => `<button class="mov" data-i="${esc(p.ispb)}"><span class="row__icon row__icon--soft">${I.coin}</span>
        <span class="mov__info"><span class="mov__title">${esc(p.name)}</span><span class="mov__sub">ISPB ${esc(p.ispb)}</span></span></button>`).join('') || '<div class="empty">Nenhum banco encontrado.</div>')
        + (list.length > 40 ? '<div class="empty">Continue digitando para refinar a busca.</div>' : '');
      $$('[data-i]', root).forEach((b) => { b.onclick = () => { const p = participants.find((x) => x.ispb === b.dataset.i); state.transfer = { bank: p }; go('/transferir/conta/dados'); }; });
    };
    $('#q').oninput = paint;
    paint();
  });

  // Studio: "Dados da conta destino | Novo | Outra conta" (lido) e "| Minha conta" (modelo comum)
  route('/transferir/conta/dados', async (root) => {
    if (!tr().bank) return go('/transferir/conta');
    if (!(await needAccount())) return;
    const t = tr();
    t.target = t.target || 'other';
    const mine = t.target === 'mine';
    if (mine) { t.name = state.me.fullName; t.taxId = state.me.document; }
    const f = (id, ph, val, attrs) => `<div class="field"><div class="field-box"><input id="${id}" placeholder="${ph}" value="${esc(val || '')}" ${attrs || ''}/></div><p class="field-error" id="${id}-er"></p></div>`;
    root.innerHTML = frame(`<header class="hdr"><button class="hdr__icon" id="bk" aria-label="Voltar">${I.chevLeft}</button></header>
      <div class="scroll"><section class="intro" style="padding-top:0"><h1 class="intro__title intro__title--sm">Transferência via Pix</h1><p class="intro__desc">${esc(t.bank.name)}</p></section>
        <section class="body-sec"><div class="group"><span class="group__title">Para que conta você quer transferir?</span>
          <div class="seg"><button type="button" class="seg__btn ${mine ? '' : 'is-active'}" data-t="other">Outra conta</button><button type="button" class="seg__btn ${mine ? 'is-active' : ''}" data-t="mine">Minha conta</button></div>
          ${mine ? '<p class="row__caption" style="margin-top:8px">Sua conta em outro banco, no mesmo CPF/CNPJ.</p>' : ''}</div>
          <div class="field-group">${f('nm', 'Nome do titular da conta', t.name, `maxlength="120" ${mine ? 'readonly' : ''}`)}
            ${f('doc', 'CPF/CNPJ do titular da conta', fmtDoc(t.taxId || ''), `inputmode="numeric" maxlength="18" ${mine ? 'readonly' : ''}`)}
            <div class="row2">${f('ag', 'Agência', t.branch, 'inputmode="numeric" maxlength="4"')}${f('ac', 'Conta', t.account, 'inputmode="numeric" maxlength="20"')}</div>
            <p class="field-helper" style="margin-top:-8px">Agência sem dígito. Conta com o dígito, sem traço.</p>
            <div class="field"><div class="field-box"><input id="ds" placeholder="Descrição da sua transação" maxlength="140" value="${esc(t.message || '')}"/></div><p class="field-helper">Opcional</p></div>
          </div></section></div>
      <footer class="footbar"><button class="btn btn-primary btn--lg" id="next" disabled>Continuar</button></footer>`, { studio: '59759b3d Dados da conta destino Outra conta + 21e4f9bf Minha conta (sem aba Favoritos)' });
    $('#bk').onclick = back;
    $$('[data-t]', root).forEach((b) => { b.onclick = () => { t.target = b.dataset.t; if (t.target === 'other') { t.name = ''; t.taxId = ''; } L.render(); }; });
    const next = $('#next');
    const validDoc = (d) => (d.length === 11 ? isValidCpf(d) : d.length === 14 ? L.isValidCnpj(d) : false);
    const check = () => {
      const d = onlyDigits($('#doc').value);
      const docEr = $('#doc-er');
      const bad = (d.length === 11 || d.length === 14) && !validDoc(d);
      docEr.textContent = bad ? 'CPF ou CNPJ inválido.' : ''; docEr.classList.toggle('is-visible', bad);
      next.disabled = !($('#nm').value.trim().length >= 3 && validDoc(d) && onlyDigits($('#ag').value).length >= 1 && onlyDigits($('#ac').value).length >= 2);
    };
    $('#doc').oninput = () => { $('#doc').value = fmtDoc($('#doc').value); check(); };
    $('#ag').oninput = () => { $('#ag').value = onlyDigits($('#ag').value).slice(0, 4); check(); };
    $('#ac').oninput = () => { $('#ac').value = onlyDigits($('#ac').value).slice(0, 20); check(); };
    $('#nm').oninput = check;
    check();
    next.onclick = () => {
      Object.assign(t, { name: $('#nm').value.trim(), taxId: onlyDigits($('#doc').value), branch: onlyDigits($('#ag').value), account: onlyDigits($('#ac').value), message: $('#ds').value.trim() });
      go('/transferir/conta/tipo');
    };
  });

  // Studio: "Transferir | Tipo de conta do destinatário" (modelo comum). Códigos do Pix: CACC, SVGS, TRAN, SLRY.
  route('/transferir/conta/tipo', (root) => {
    const t = tr();
    if (!t.account) return go('/transferir/conta');
    const opts = [['CACC', 'Conta corrente'], ['SVGS', 'Poupança'], ['TRAN', 'Conta de pagamento', 'Contas digitais, como as de instituições de pagamento'], ['SLRY', 'Conta salário']];
    root.innerHTML = frame(`<header class="hdr"><button class="hdr__icon" id="bk" aria-label="Voltar">${I.chevLeft}</button></header>
      <div class="scroll"><section class="intro" style="padding-top:0"><h1 class="intro__title intro__title--sm">Qual o <strong>tipo de conta</strong> do destinatário?</h1></section>
        <section class="body-sec"><div class="option-list">${opts.map(([v, l, sub]) => `<button type="button" class="option-row ${t.accountType === v ? 'is-selected' : ''}" data-v="${v}" style="height:auto;min-height:56px"><span class="option-row-label">${l}${sub ? `<span class="option-sub">${sub}</span>` : ''}</span><span class="option-row-radio"></span></button>`).join('')}</div>
        ${t.bank.ispb === '13935893' ? '<div class="info-box" style="margin-top:16px"><span class="info-box-bar"></span><span class="info-box-text">Contas na Celcoin são conta de pagamento.</span></div>' : ''}</section></div>
      <footer class="footbar"><button class="btn btn-primary btn--lg" id="next" ${t.accountType ? '' : 'disabled'}>Continuar</button></footer>`, { studio: '6570ae3c Tipo de conta do destinatário (modelo comum)' });
    $('#bk').onclick = back;
    const next = $('#next');
    $$('.option-row', root).forEach((r) => { r.onclick = () => { $$('.option-row', root).forEach((x) => x.classList.remove('is-selected')); r.classList.add('is-selected'); t.accountType = r.dataset.v; next.disabled = false; }; });
    next.onclick = async () => {
      setLoading(next, true);
      try {
        const r = await api('/pix/manual', { method: 'POST', body: { ispb: t.bank.ispb, branch: t.branch, account: t.account, accountType: t.accountType, taxId: t.taxId, name: t.name } });
        state.pix = { key: '', lookup: r, via: 'manual', message: t.message || '' };
        go('/pix/transferir/valor');
      } catch (e) { toast(e.message); setLoading(next, false); next.disabled = false; }
    };
  });
})();

/* ---------------------------------------------------------------- Receber, Extrato/Relatórios e Minha conta */
(function () {
  'use strict';
  const L = window.LoBank;
  const { $, $$, esc, money, onlyDigits, fmtPhone, fmtCep, fmtDoc, maskDoc, fmtDateTime, api, I, state, route, go, back, frame, toast, sheet, setLoading, loadMe, copy, detail, MOV, LOGO } = L;
  const header = (to) => `<header class="hdr hdr--wl"><button class="hdr__icon" id="bk" aria-label="Voltar" ${to ? `data-to="${to}"` : ''}>${I.chevLeft}</button><span class="logo">${LOGO('#7664FA', 104)}</span><span class="hdr__icon"></span></header>`;
  const wireBack = (root) => { const b = $('#bk', root); if (b) b.onclick = () => (b.dataset.to ? go(b.dataset.to) : back()); };
  async function needAccount() {
    if (!(await loadMe())) { go('/login'); return false; }
    if (!state.me.account) { go('/validacao'); return false; }
    return true;
  }

  // ============================================================ RECEBER | HOME (Único / Múltiplos)
  // Studio: "Receber | Home | Único" e "| Múltiplos" (lido). Os dois usam QR Code ESTÁTICO: o dinâmico (com validade e uso
  // único) precisa de outra API da Celcoin e fica para depois. O texto do "Único" foi ajustado para não prometer validade.
  route('/receber', async (root) => {
    if (!(await needAccount())) return;
    const cur = (state.receive && state.receive.mode) || 'single';
    root.innerHTML = frame(`${header('/home')}
      <div class="scroll"><section class="intro"><h1 class="intro__title">Como você quer <strong>receber</strong> esse pagamento?</h1></section>
        <section class="body-sec"><div class="card"><div class="row"><span class="row__icon row__icon--soft">${I.key}</span><div class="row__info"><span class="row__caption">Chave Pix para esse recebimento</span><span class="row__label" id="key">Carregando…</span></div></div></div>
        <div class="option-list">
          <button type="button" class="option-row ${cur === 'single' ? 'is-selected' : ''}" data-v="single" style="height:auto;min-height:56px;padding:12px 8px"><span class="option-row-label">Recebimento único<span class="option-sub">Para uma cobrança, com valor definido.</span></span><span class="option-row-radio"></span></button>
          <button type="button" class="option-row ${cur === 'multi' ? 'is-selected' : ''}" data-v="multi" style="height:auto;min-height:56px;padding:12px 8px"><span class="option-row-label">Vários recebimentos<span class="option-sub">Esse QR Code não expira e pode ser usado diversas vezes. Não é necessário definir um valor.</span></span><span class="option-row-radio"></span></button>
        </div></section></div>
      <footer class="footbar"><button class="btn btn-primary btn--lg" id="next" disabled>Continuar</button></footer>`, { studio: 'c3a90386 Home Único + ec14cb1b Home Múltiplos (texto do Único ajustado)' });
    wireBack(root);
    let mode = cur;
    $$('.option-row', root).forEach((r) => { r.onclick = () => { $$('.option-row', root).forEach((x) => x.classList.remove('is-selected')); r.classList.add('is-selected'); mode = r.dataset.v; }; });
    const next = $('#next');
    next.onclick = () => { state.receive = { mode }; go('/receber/valor'); };
    try {
      const { keys } = await api('/pix/keys');
      const evp = keys.find((k) => k.type === 'EVP');
      if (evp) { $('#key').textContent = evp.key; next.disabled = false; }
      else { $('#key').innerHTML = 'Você ainda não tem chave. <button class="link-inline" id="mk" style="padding:0">Cadastrar agora</button>'; $('#mk').onclick = () => go('/pix/chaves'); }
    } catch (e) { $('#key').textContent = e.message; }
  });

  // ============================================================ EXTRATO COMPLETO (Relatórios + Wallet | Extrato)
  // Studio: "Relatórios | Extrato completo", "Filtrar relatório" (+ estados), "Modal | Baixar Extrato";
  // "Extrato | Filtrar | Modal | Período / Tipo de transação / Categoria". Período limitado a 7 dias (pedido da usuária e
  // limite da Celcoin). Filtros de tipo, categoria e busca são aplicados no app sobre o que a Celcoin devolveu.
  const ymd = (d) => new Date(d.getTime() - 3 * 3600e3).toISOString().slice(0, 10);
  const today = () => ymd(new Date());
  const addDays = (s, n) => ymd(new Date(Date.parse(s + 'T12:00:00Z') + n * 864e5 + 3 * 3600e3));
  const brDate = (s) => s.split('-').reverse().join('/');
  const filters = () => (state.stmt = state.stmt || { period: '7d', from: addDays(today(), -6), to: today(), type: 'all', cats: [], q: '' });
  const CATS = [['pix', 'Pix'], ['entry', 'Crédito e débito em conta']];
  const catOf = (m) => (String(m.type || '').startsWith('PIX') ? 'pix' : 'entry');
  const applyFilters = (list, f) => list.filter((m) => (f.type === 'all' || m.direction === f.type)
    && (!f.cats.length || f.cats.includes(catOf(m)))
    && (!f.q || `${MOV[m.type] || ''} ${m.description || ''} ${m.counterpart || ''}`.toLowerCase().includes(f.q.toLowerCase())));
  const periodLabel = (f) => (f.period === '7d' ? 'Últimos 7 dias' : f.period === 'today' ? 'Hoje' : `${brDate(f.from)} a ${brDate(f.to)}`);

  route('/extrato', async (root) => {
    if (!(await needAccount())) return;
    const f = filters();
    const chips = [periodLabel(f), f.type === 'in' ? 'Entradas' : f.type === 'out' ? 'Saídas' : null, ...f.cats.map((c) => CATS.find((x) => x[0] === c)[1])].filter(Boolean);
    root.innerHTML = frame(`<header class="hdr"><button class="hdr__icon" id="bk" aria-label="Voltar" data-to="/home">${I.chevLeft}</button><h1 class="hdr__title">Extrato</h1><button class="hdr__icon" id="dl" aria-label="Baixar extrato">${I.download || I.copy}</button></header>
      <div class="scroll"><section class="balance-bar"><span class="row__caption">Saldo disponível</span><strong id="bal">…</strong></section>
        <section class="searchbar"><div class="keyfield__input"><input id="q" placeholder="Buscar no extrato" value="${esc(f.q)}"/></div><button class="filter-btn" id="flt" aria-label="Filtrar">${I.filter || I.chevDown}</button></section>
        <div class="chips">${chips.map((c) => `<span class="chip">${esc(c)}</span>`).join('')}${chips.length > 1 ? '<button class="chip chip--clear" id="clr">Limpar</button>' : ''}</div>
        <section class="body-sec" id="list"><div class="empty">${I.spinner}</div></section></div>`, { studio: '13e383e5 Extrato completo + e620afcc Filtros aplicados (+ 7c2160b2 Extrato Wallet)' });
    wireBack(root);
    $('#flt').onclick = () => go('/extrato/filtros');
    if ($('#clr')) $('#clr').onclick = () => { state.stmt = null; L.render(); };
    api('/balance').then((b) => { $('#bal').textContent = money(b.amount); }).catch(() => { $('#bal').textContent = 'indisponível'; });
    let all = [];
    const paint = () => {
      const list = applyFilters(all, f);
      state.movements = list;
      if (!list.length) { $('#list').innerHTML = `<div class="empty">${all.length ? 'Nenhum lançamento com esses filtros.' : 'Nenhuma movimentação no período.'}</div>`; return; }
      let html = '', lastDay = '';
      list.forEach((m, i) => {
        const d = new Date(String(m.date).replace(' ', 'T'));
        const day = isNaN(d) ? '' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
        if (day !== lastDay) { html += `<div class="day">${esc(day)}</div>`; lastDay = day; }
        html += `<button class="mov" data-i="${i}"><span class="row__icon row__icon--soft">${catOf(m) === 'pix' ? I.pix : I.coin}</span>
          <span class="mov__info"><span class="mov__title">${esc(MOV[m.type] || m.description || m.type)}${m.counterpart ? ' · ' + esc(m.counterpart) : ''}</span><span class="mov__sub">${m.pending ? '<span class="tag">Em processamento</span>' : esc(m.status || '')}</span></span>
          <span class="mov__amount mov__amount--${m.direction}">${m.direction === 'in' ? '+ ' : '− '}${money(m.amount)}</span></button>`;
      });
      $('#list').innerHTML = html;
      $$('.mov', root).forEach((b) => { b.onclick = () => { const m = list[Number(b.dataset.i)]; if (m.txId) go('/comprovante/' + m.txId); else detail(m); }; });
    };
    $('#q').oninput = () => { f.q = $('#q').value.trim(); paint(); };
    $('#dl').onclick = () => downloadSheet(applyFilters(all, f), f);
    try {
      const r = await api(`/statement?from=${f.from}&to=${f.to}`);
      all = r.movements;
      paint();
    } catch (e) { $('#list').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  });

  // Studio: "Relatórios | Filtrar relatório" (estado inicial / outro período / selecionar período) + modais do Wallet
  route('/extrato/filtros', (root) => {
    const f = { ...filters(), cats: [...filters().cats] };
    const radio = (name, v, label, cur) => `<button type="button" class="option-row ${cur === v ? 'is-selected' : ''}" data-${name}="${v}"><span class="option-row-label">${label}</span><span class="option-row-radio"></span></button>`;
    const box = (v, label) => `<button type="button" class="check-row ${f.cats.includes(v) ? 'is-selected' : ''}" data-cat="${v}"><span class="check-row__box">${I.ok}</span><span class="option-row-label">${label}</span></button>`;
    root.innerHTML = frame(`<header class="hdr"><button class="hdr__icon" id="bk" aria-label="Voltar">${I.chevLeft}</button><h1 class="hdr__title">Filtrar extrato</h1><span class="hdr__icon"></span></header>
      <div class="scroll"><section class="body-sec">
        <div class="group"><span class="group__title">Período</span><div class="option-list">${radio('p', '7d', 'Últimos 7 dias', f.period)}${radio('p', 'today', 'Hoje', f.period)}${radio('p', 'custom', 'Outro período', f.period)}</div>
          <div id="custom" class="${f.period === 'custom' ? '' : 'hidden'}" style="margin-top:12px"><div class="row2">
            <div class="field"><span class="field-label">De</span><div class="field-box"><input id="from" type="date" value="${f.from}" max="${today()}"/></div></div>
            <div class="field"><span class="field-label">Até</span><div class="field-box"><input id="to" type="date" value="${f.to}" max="${today()}"/></div></div></div>
            <p class="field-helper">Até 7 dias por consulta.</p><p class="field-error" id="per-er"></p></div></div>
        <div class="group"><span class="group__title">Tipo de transação</span><div class="option-list">${radio('t', 'all', 'Todas', f.type)}${radio('t', 'in', 'Entradas', f.type)}${radio('t', 'out', 'Saídas', f.type)}</div></div>
        <div class="group"><span class="group__title">Categoria</span><div class="option-list">${CATS.map(([v, l]) => box(v, l)).join('')}</div></div>
      </section></div>
      <footer class="footbar" style="display:flex;flex-direction:column;gap:8px"><button class="btn btn-primary btn--lg" id="apply">Aplicar filtros</button><button class="btn btn-ghost" id="clear">Limpar filtros</button></footer>`,
      { studio: '8c4474c1 Filtrar relatório + 77833a7b Estado inicial + 92b424a3 Outro período + d63ba699/5fa7806f/8d31755d/50e1845b/8480a338 modais do Extrato (modelo comum)' });
    $('#bk').onclick = () => go('/extrato');
    const sel = (attr, key) => $$(`[data-${attr}]`, root).forEach((b) => { b.onclick = () => { $$(`[data-${attr}]`, root).forEach((x) => x.classList.remove('is-selected')); b.classList.add('is-selected'); f[key] = b.dataset[attr]; if (attr === 'p') $('#custom').classList.toggle('hidden', f.period !== 'custom'); check(); }; });
    sel('p', 'period'); sel('t', 'type');
    $$('[data-cat]', root).forEach((b) => { b.onclick = () => { const c = b.dataset.cat; f.cats = f.cats.includes(c) ? f.cats.filter((x) => x !== c) : [...f.cats, c]; b.classList.toggle('is-selected'); }; });
    const check = () => {
      let msg = '';
      if (f.period === 'custom') {
        const a = $('#from').value, b = $('#to').value;
        const span = Math.round((Date.parse(b) - Date.parse(a)) / 864e5) + 1;
        if (!a || !b) msg = 'Escolha as duas datas.'; else if (span < 1) msg = 'A data inicial precisa ser anterior à final.'; else if (span > 7) msg = 'O período pode ter no máximo 7 dias.';
      }
      $('#per-er').textContent = msg; $('#per-er').classList.toggle('is-visible', !!msg); $('#apply').disabled = !!msg;
    };
    $('#from').oninput = check; $('#to').oninput = check;
    check();
    $('#clear').onclick = () => { state.stmt = null; go('/extrato'); };
    $('#apply').onclick = () => {
      if (f.period === '7d') { f.from = addDays(today(), -6); f.to = today(); }
      else if (f.period === 'today') { f.from = today(); f.to = today(); }
      else { f.from = $('#from').value; f.to = $('#to').value; }
      state.stmt = f;
      go('/extrato');
    };
  });

  // Studio: "Relatórios | Modal | Baixar Extrato": PDF, XLS, OFX, e-mail. O arquivo é montado no app com o que está na tela.
  // XLS sai como planilha CSV (abre no Excel). E-mail fica indisponível: o app não envia e-mails.
  function downloadSheet(list, f) {
    const s = sheet(`<h2 class="sheet-title">Escolha qual formato você quer baixar seu extrato</h2><p class="sheet-text">${esc(periodLabel(f))} · ${list.length} lançamento${list.length === 1 ? '' : 's'}</p>
      <div class="option-list">
        <button class="option-row" data-f="pdf"><span class="option-row-label">Baixar PDF<span class="option-sub">Abre a impressão; escolha "Salvar como PDF".</span></span></button>
        <button class="option-row" data-f="csv"><span class="option-row-label">Baixar planilha (CSV)<span class="option-sub">Abre no Excel e no Google Planilhas.</span></span></button>
        <button class="option-row" data-f="ofx"><span class="option-row-label">Baixar OFX<span class="option-sub">Para programas de gestão financeira.</span></span></button>
        <button class="option-row" disabled style="opacity:.5"><span class="option-row-label">Receber em meu e-mail<span class="option-sub">Indisponível nesta versão do app.</span></span></button>
      </div><div class="sheet-actions"><button class="btn btn-ghost" data-x>Cancelar</button></div>`);
    $('[data-x]', s.el).onclick = s.close;
    const rows = list.map((m) => ({ date: String(m.date).replace(' ', 'T'), kind: MOV[m.type] || m.type, desc: [m.description, m.counterpart].filter(Boolean).join(' · '), value: (m.direction === 'in' ? 1 : -1) * Number(m.amount), id: m.id || '' }));
    const save = (name, mime, text) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: mime })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); };
    const base = `extrato-lobank-${f.from}-a-${f.to}`;
    $$('[data-f]', s.el).forEach((b) => { b.onclick = () => {
      const kind = b.dataset.f; s.close();
      if (!rows.length) return toast('Não há lançamentos para baixar.');
      if (kind === 'csv') {
        const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
        save(base + '.csv', 'text/csv;charset=utf-8', '﻿' + ['Data;Tipo;Descrição;Valor (R$);Identificador', ...rows.map((r) => [fmtDateTime(r.date), r.kind, r.desc, r.value.toFixed(2).replace('.', ','), r.id].map(q).join(';'))].join('\r\n'));
      } else if (kind === 'ofx') {
        const d = (s2) => s2.replace(/[-:T]/g, '').slice(0, 14);
        const tx = rows.map((r) => `<STMTTRN><TRNTYPE>${r.value >= 0 ? 'CREDIT' : 'DEBIT'}</TRNTYPE><DTPOSTED>${d(r.date)}</DTPOSTED><TRNAMT>${r.value.toFixed(2)}</TRNAMT><FITID>${esc(r.id)}</FITID><MEMO>${esc((r.kind + ' ' + r.desc).slice(0, 250))}</MEMO></STMTTRN>`).join('\n');
        save(base + '.ofx', 'application/x-ofx', `OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\nSECURITY:NONE\nENCODING:UTF-8\nCHARSET:NONE\nCOMPRESSION:NONE\nOLDFILEUID:NONE\nNEWFILEUID:NONE\n\n<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>BRL</CURDEF><BANKACCTFROM><BANKID>13935893</BANKID><BRANCHID>${esc(state.me.account.branch)}</BRANCHID><ACCTID>${esc(state.me.account.account)}</ACCTID><ACCTTYPE>CHECKING</ACCTTYPE></BANKACCTFROM>\n<BANKTRANLIST><DTSTART>${f.from.replace(/-/g, '')}</DTSTART><DTEND>${f.to.replace(/-/g, '')}</DTEND>\n${tx}\n</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>\n`);
      } else {
        const w = window.open('', '_blank');
        if (!w) return toast('O navegador bloqueou a janela de impressão. Permita pop-ups para este endereço.');
        w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${base}</title><style>body{font-family:Inter,Arial,sans-serif;margin:32px;color:#302d3f}h1{font-size:20px}table{width:100%;border-collapse:collapse;font-size:12px}td,th{padding:6px;border-bottom:1px solid #eee;text-align:left}td.v{text-align:right;white-space:nowrap}.in{color:#187b28}</style></head><body>
          <h1>Extrato LoBank</h1><p>${esc(state.me.fullName)} · ${maskDoc(state.me.document || '')} · Ag. ${esc(state.me.account.branch)} · Conta ${esc(state.me.account.account)}<br>Período: ${esc(periodLabel(f))}</p>
          <table><thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th style="text-align:right">Valor</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(fmtDateTime(r.date))}</td><td>${esc(r.kind)}</td><td>${esc(r.desc)}</td><td class="v ${r.value >= 0 ? 'in' : ''}">${r.value >= 0 ? '+ ' : '− '}${esc(money(Math.abs(r.value)))}</td></tr>`).join('')}</tbody></table>
          <p style="font-size:11px;color:#6f6b82;margin-top:24px">Gerado pelo app em ${esc(new Date().toLocaleString('pt-BR'))}. Ambiente de testes (sandbox da Celcoin).</p></body></html>`);
        w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
      }
    }; });
  }

  // ============================================================ MINHA CONTA (Wallet | Minha conta + Editar dados)
  // Só os itens que funcionam (mesma decisão dos atalhos da Home): Minhas chaves Pix, Minhas senhas, Meus dados e Sair.
  // Retirados: Gestão de usuário, Meus limites, Tarifas e planos, Meu DDA, Cancelar DDA, Dúvidas, Cancelar minha conta.
  route('/minha-conta', async (root) => {
    if (!(await needAccount())) return;
    const me = state.me;
    const row = (id, icon, label) => `<button class="row acc-row" id="${id}"><span class="row__icon row__icon--soft">${icon}</span><div class="row__info"><span class="row__label">${label}</span></div><span class="row__chevron">${I.chevRight}</span></button>`;
    root.innerHTML = frame(`<div class="acc-hero"><div class="acc-hero__bar"><button class="hdr__icon acc-hero__back" id="bk" aria-label="Voltar" data-to="/home">${I.chevLeft}</button><span>Minha conta</span><span class="hdr__icon"></span></div>
        <span class="acc-hero__avatar">${esc(L.initials(me.fullName))}</span><p class="acc-hero__name">${esc(me.fullName)}</p><p class="acc-hero__doc">CELCOIN IP S.A. · ${me.personType === 'PJ' ? 'CNPJ' : 'CPF'} ${maskDoc(me.document || '')}</p>
        <div class="acc-hero__meta"><span>Agência ${esc(me.account.branch)}</span><span>Conta ${esc(me.account.account)}</span></div>
        <button class="acc-hero__share" id="share">Compartilhar</button></div>
      <div class="scroll">${row('keys', I.key, 'Minhas chaves Pix')}${row('pw', I.shield, 'Minhas senhas')}${row('data', I.person, 'Meus dados')}
        <div style="padding:16px 24px"><button class="btn btn-ghost acc-out" id="out">Sair do aplicativo</button></div></div>`, { studio: '2d3d03ce Minha conta (só itens que funcionam)' });
    wireBack(root);
    $('#keys').onclick = () => go('/pix/chaves');
    $('#pw').onclick = () => go('/minha-conta/senhas');
    $('#data').onclick = () => go('/minha-conta/dados');
    $('#share').onclick = () => copy(`${me.fullName}\nCELCOIN IP S.A. (ISPB 13935893)\nAgência ${me.account.branch} · Conta ${me.account.account}\n${me.personType === 'PJ' ? 'CNPJ' : 'CPF'} ${fmtDoc(me.document || '')}`);
    $('#out').onclick = async () => { await api('/auth/logout', { method: 'POST', allow401: true }); state.me = null; go('/login'); };
  });

  // Studio: "Minha conta | Editar dados" (modelo comum). Campos que a Celcoin permite alterar: telefone, e-mail, endereço
  // (e nome social na PF). Nome, documento, nome da mãe, nascimento, razão social e sócios ficam só para leitura.
  route('/minha-conta/dados', async (root) => {
    if (!(await needAccount())) return;
    const d = await api('/me/details');
    const a = d.address || {};
    const pj = d.personType === 'PJ';
    const fld = (id, label, val, attrs) => `<div class="field"><span class="field-label">${label}</span><div class="field-box"><input id="${id}" value="${esc(val || '')}" ${attrs || ''}/></div><p class="field-error" id="${id}-er"></p></div>`;
    const ro = (label, val) => `<div class="receipt__row"><span>${label}</span><span>${esc(val)}</span></div>`;
    root.innerHTML = frame(`<header class="hdr"><button class="hdr__icon" id="bk" aria-label="Voltar" data-to="/minha-conta">${I.chevLeft}</button><h1 class="hdr__title">Meus dados</h1><span class="hdr__icon"></span></header>
      <div class="scroll"><section class="body-sec">
        <div class="card"><div class="receipt">${ro(pj ? 'Razão social' : 'Nome', d.fullName)}${pj && d.socialName ? ro('Nome da empresa', d.socialName) : ''}${ro(pj ? 'CNPJ' : 'CPF', fmtDoc(d.document))}
          ${pj ? (d.owners || []).map((o) => ro(o.type === 'REPRESENTANTE' ? 'Representante' : 'Sócio', o.name + (o.share ? ` (${o.share}%)` : ''))).join('') : ''}</div>
          <p class="row__caption">${pj ? 'Razão social, nome, CNPJ e sócios não podem ser alterados pelo app. Mudança de sócios é feita pelo time de Compliance da Celcoin.' : 'Nome, CPF, nome da mãe e data de nascimento não podem ser alterados.'}</p></div>
        <div class="field-group">
          ${pj ? '' : fld('soc', 'Nome social', d.socialName, 'maxlength="60" placeholder="Opcional"')}
          ${fld('em', pj ? 'E-mail da empresa' : 'E-mail', d.email, 'type="email" maxlength="100"')}
          ${fld('ph', pj ? 'Telefone da empresa' : 'Celular', fmtPhone(String(d.phone || '').replace(/^\+55/, '')), 'inputmode="tel" maxlength="15"')}
          <p class="sheet-text" style="margin:8px 0 0;font-weight:600">${pj ? 'Endereço da empresa' : 'Endereço'}</p>
          ${fld('cep', 'CEP', fmtCep(a.postalCode || ''), 'inputmode="numeric" maxlength="9"')}${fld('street', 'Rua', a.street, 'maxlength="200"')}
          <div class="row2">${fld('num', 'Número', a.number, 'maxlength="10"')}${fld('comp', 'Complemento', a.addressComplement || a.complement, 'maxlength="60" placeholder="Opcional"')}</div>
          ${fld('nb', 'Bairro', a.neighborhood, 'maxlength="200"')}<div class="row2 row2--wide-first">${fld('city', 'Cidade', a.city, 'maxlength="100"')}${fld('uf', 'UF', a.state, 'maxlength="2" style="text-transform:uppercase"')}</div>
        </div></section></div>
      <footer class="footbar"><button class="btn btn-primary btn--lg" id="save" disabled>Salvar alterações</button></footer>`, { studio: 'd5ea723e Minha conta Editar dados (modelo comum, limitado ao que a Celcoin permite)' });
    wireBack(root);
    const save = $('#save');
    const read = () => ({ email: $('#em').value.trim(), phone: onlyDigits($('#ph').value), socialName: $('#soc') ? $('#soc').value.trim() : undefined,
      address: { postalCode: onlyDigits($('#cep').value), street: $('#street').value.trim(), number: $('#num').value.trim(), complement: $('#comp').value.trim(), neighborhood: $('#nb').value.trim(), city: $('#city').value.trim(), state: $('#uf').value.trim().toUpperCase() } });
    const check = () => { const v = read(); const ad = v.address; save.disabled = !(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email) && v.phone.length === 11 && ad.postalCode.length === 8 && ad.street && ad.number && ad.neighborhood && ad.city && /^[A-Z]{2}$/.test(ad.state)); };
    $$('input', root).forEach((i) => { i.addEventListener('input', () => { if (i.id === 'ph') i.value = fmtPhone(i.value); if (i.id === 'cep') i.value = fmtCep(i.value); check(); }); });
    check();
    save.onclick = async () => {
      setLoading(save, true);
      try { await api('/me', { method: 'PUT', body: read() }); toast('Dados atualizados na Celcoin.'); go('/minha-conta'); }
      catch (e) { toast(e.message); setLoading(save, false); save.disabled = false; }
    };
  });

  // Studio: item "Minhas senhas" da tela Minha conta (sem tela própria no Studio): troca da senha de acesso ou de transferência.
  route('/minha-conta/senhas', async (root) => {
    if (!(await needAccount())) return;
    let kind = 'login';
    const paint = () => {
      root.innerHTML = frame(`<header class="hdr"><button class="hdr__icon" id="bk" aria-label="Voltar" data-to="/minha-conta">${I.chevLeft}</button><h1 class="hdr__title">Minhas senhas</h1><span class="hdr__icon"></span></header>
        <div class="scroll"><section class="body-sec">
          <div class="seg"><button type="button" class="seg__btn ${kind === 'login' ? 'is-active' : ''}" data-k="login">Senha de acesso</button><button type="button" class="seg__btn ${kind === 'tx' ? 'is-active' : ''}" data-k="tx">Senha de transferência</button></div>
          <div class="field-group">
            <div class="field"><span class="field-label">Senha de acesso atual</span><div class="field-box"><input id="cur" type="password" autocomplete="current-password"/></div></div>
            <div class="field"><span class="field-label">${kind === 'login' ? 'Nova senha de acesso' : 'Nova senha de transferência (4 números)'}</span><div class="field-box"><input id="nx" type="password" ${kind === 'tx' ? 'inputmode="numeric" maxlength="4"' : 'autocomplete="new-password"'}/></div>
              <p class="field-helper">${kind === 'login' ? 'Use 8 caracteres ou mais, com letras e números.' : 'Ela é pedida em todo Pix.'}</p></div>
            <div class="field"><span class="field-label">Repita a nova senha</span><div class="field-box"><input id="nx2" type="password" ${kind === 'tx' ? 'inputmode="numeric" maxlength="4"' : 'autocomplete="new-password"'}/></div><p class="field-error" id="er"></p></div>
          </div></section><p class="studio-note">Tela criada para o app: o Studio tem só o item no menu.</p></div>
        <footer class="footbar"><button class="btn btn-primary btn--lg" id="save" disabled>Trocar senha</button></footer>`, { studio: 'novo:minhas-senhas (item de 2d3d03ce Minha conta)' });
      wireBack(root);
      $$('[data-k]', root).forEach((b) => { b.onclick = () => { kind = b.dataset.k; paint(); }; });
      const save = $('#save'), er = $('#er');
      const valid = (v) => (kind === 'login' ? v.length >= 8 && /[A-Za-z]/.test(v) && /\d/.test(v) : /^\d{4}$/.test(v));
      const check = () => { const a = $('#nx').value, b = $('#nx2').value; const mismatch = b && a !== b; er.textContent = mismatch ? 'As senhas não conferem.' : ''; er.classList.toggle('is-visible', !!mismatch); save.disabled = !($('#cur').value && valid(a) && a === b); };
      $$('input', root).forEach((i) => { i.oninput = () => { if (kind === 'tx' && i.id !== 'cur') i.value = onlyDigits(i.value).slice(0, 4); check(); }; });
      save.onclick = async () => {
        setLoading(save, true);
        try { await api('/me/passwords', { method: 'POST', allow401: true, body: { kind, current: $('#cur').value, next: $('#nx').value } }); toast('Senha trocada.'); go('/minha-conta'); }
        catch (e) { er.textContent = e.message; er.classList.add('is-visible'); setLoading(save, false); save.disabled = false; }
      };
    };
    paint();
  });
})();
