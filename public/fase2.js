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
    const cur = ob().fillerRole;
    root.innerHTML = wizardFrame(8, `<h1 class="headline">Quem está preenchendo este <strong>cadastro?</strong></h1>
      <p class="subtext">Isso nos ajuda a saber quais documentos pedir a seguir.</p>
      <div class="options">
        <button type="button" class="option ${cur === 'socio' ? 'is-selected' : ''}" data-v="socio"><span class="option-avatar">${I.person}</span><span class="option-label">Sou sócio da empresa</span><span class="option-radio"></span></button>
        <button type="button" class="option ${cur === 'representante' ? 'is-selected' : ''}" data-v="representante"><span class="option-avatar">${I.briefcase}</span><span class="option-label">Sou representante legal</span><span class="option-radio"></span></button>
      </div>`, null, '728d5ec6 Quem está preenchendo');
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
