/* LoBank — DDA (Débito Direto Autorizado). Board do Studio "DDA (Débito Direto Autorizado)", ce24e772.
   A Celcoin responde PROCESSING e manda o resultado (adesão, saída, boletos) só por evento; o app lê os
   eventos a cada 10 s. Pagar um boleto do DDA usa o fluxo do Pagar contas (authorize + billpayment). */
(function () {
  'use strict';
  const L = window.LoBank;
  const { $, $$, esc, money, onlyDigits, maskDoc, fmtPhone, fmtCep, api, I, state, route, route_prefix, go, back, frame, toast, sheet, copy, setLoading, loadMe, countdown, queryWaitSec, LOGO } = L;

  const DOTS = '<svg width="23" height="5" viewBox="0 0 23 5" fill="currentColor"><circle cx="2.5" cy="2.5" r="2.5"/><circle cx="11.5" cy="2.5" r="2.5"/><circle cx="20.5" cy="2.5" r="2.5"/></svg>';
  // Códigos de juros e multa do guia "Sobre DDA" da Celcoin. Valores em centavos; percentuais em centésimos.
  const INTEREST = { 1: (a) => `${money(a / 100)} por dia corrido`, 2: (a) => `${(a / 100).toLocaleString('pt-BR')}% ao dia (corrido)`, 3: (a) => `${(a / 100).toLocaleString('pt-BR')}% ao mês (corrido)`,
    4: (a) => `${(a / 100).toLocaleString('pt-BR')}% ao ano (corrido)`, 6: (a) => `${money(a / 100)} por dia útil`, 7: (a) => `${(a / 100).toLocaleString('pt-BR')}% ao dia (útil)`,
    8: (a) => `${(a / 100).toLocaleString('pt-BR')}% ao mês (útil)`, 9: (a) => `${(a / 100).toLocaleString('pt-BR')}% ao ano (útil)` };
  const FINE = { 1: (a) => money(a / 100), 2: (a) => `${(a / 100).toLocaleString('pt-BR')}%` };
  const rule = (x, map) => (x && x.amount && map[Number(x.code)] ? `${map[Number(x.code)](x.amount)}${x.date ? ` a partir de ${String(x.date).slice(0, 10).split('-').reverse().join('/')}` : ''}` : 'Não há');
  const TERMO_URL = 'https://static.celco.in/static/modelo-termo-adesao-dda.pdf';
  const header = (to, extra) => `<header class="hdr hdr--wl"><button class="hdr__icon" id="bk" aria-label="Voltar"${to ? ` data-to="${to}"` : ''}>${I.chevLeft}</button><span class="logo">${LOGO('#7664FA', 104)}</span>${extra || '<span class="hdr__icon"></span>'}</header>`;
  const wireBk = (root) => { const b = $('#bk', root); if (b) b.onclick = () => (b.dataset.to ? go(b.dataset.to) : back()); };
  const brDay = (s) => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : '—');
  const docLabel = (d) => (d ? `${onlyDigits(d).length === 14 ? 'CNPJ' : 'CPF'}: ${maskDoc(onlyDigits(d))}` : '');
  const BADGE = { PENDENTE: ['warn', 'Pendente'], VENCIDO: ['err', 'Vencido'], PAGO: ['ok', 'Pago'], CANCELADO: ['off', 'Cancelado'] };
  const windowNote = (s) => (s && !s.inWindow ? '<div class="info-box info-box--warn"><span class="info-box-bar"></span><span class="info-box-text">A Celcoin só processa o DDA em dias úteis, das 6h às 22h. Seu pedido fica para o próximo dia útil.</span></div>' : '');
  async function needAccount() {
    if (!(await loadMe())) { go('/login'); return false; }
    if (!state.me.account) { go('/validacao'); return false; }
    return true;
  }
  const loadDda = () => api('/dda');

  // ============================================================ entrada: decide a tela pelo status
  route('/dda', async (root) => {
    if (!(await needAccount())) return;
    root.innerHTML = frame('<div class="scroll"><div class="result" style="margin-top:160px"><span class="result__badge result__badge--wait" style="width:56px;height:56px">' + I.spinner + '</span></div></div>');
    try {
      const s = await loadDda();
      state.dda = s;
      go(s.status === 'ACTIVE' ? '/dda/boletos' : s.status === 'PROCESSING' || s.status === 'CANCELLING' ? '/dda/processando'
        : s.status === 'ERROR' ? '/dda/erro' : s.status === 'UNKNOWN' ? '/dda/indisponivel' : s.status === 'TIMEOUT' ? '/dda/sem-resposta' : '/dda/termos');
    } catch (e) { toast(e.message); go('/home'); }
  });

  // ============================================================ Sem conseguir ler os avisos do DDA (tela nova)
  route('/dda/indisponivel', (root) => {
    const s = state.dda || {};
    root.innerHTML = frame(`<div class="scroll"><div class="result" style="margin-top:96px"><span class="result__badge result__badge--err" style="width:72px;height:72px">${I.err}</span>
      <h1 class="result__title">Não conseguimos confirmar o seu DDA agora</h1>
      <p class="result__desc">Os avisos do DDA não puderam ser lidos, então não dá para saber se ele já está ativo. Tente de novo em instantes.</p>
      ${s.eventsError ? `<p class="result__desc" style="font-size:12px">Detalhe: ${esc(s.eventsError)}</p>` : ''}</div></div>
      <div class="actions"><button class="btn btn-primary" id="again">Tentar de novo</button><button class="btn btn-ghost" id="home">Voltar ao início</button></div>`,
    { studio: 'novo:dda-indisponivel (modelo 4e85d7cd Erro)' });
    $('#again').onclick = () => go('/dda');
    $('#home').onclick = () => go('/home');
  });

  // ============================================================ Pedido sem confirmação depois do prazo (tela nova)
  route('/dda/sem-resposta', async (root) => {
    if (!(await needAccount())) return;
    const s = state.dda = await loadDda();
    if (s.status !== 'TIMEOUT') return go('/dda');
    const leaving = s.request && s.request.kind === 'DELETE';
    root.innerHTML = frame(`<div class="scroll"><div class="result" style="margin-top:96px"><span class="result__badge result__badge--err" style="width:72px;height:72px">${I.err}</span>
      <h1 class="result__title">Não recebemos a confirmação da Celcoin</h1>
      <p class="result__desc">Seu pedido de ${leaving ? 'saída do' : 'adesão ao'} DDA foi enviado, mas a resposta não chegou em ${s.timeoutMinutes} minuto${s.timeoutMinutes > 1 ? 's' : ''}. O aviso pode ter se perdido. Você pode pedir de novo.</p></div>${windowNote(s)}</div>
      <div class="actions"><button class="btn btn-primary" id="again">${leaving ? 'Pedir a saída de novo' : 'Pedir a adesão de novo'}</button><button class="btn btn-ghost" id="home">Voltar ao início</button></div>`,
    { studio: 'novo:dda-sem-resposta (modelo 4e85d7cd Erro)' });
    $('#home').onclick = () => go('/home');
    $('#again').onclick = () => (leaving ? confirmCancel() : go('/dda/termos'));
  });

  // ============================================================ Termos de uso (b86afc13)
  route('/dda/termos', async (root) => {
    if (!(await needAccount())) return;
    root.innerHTML = frame(`${header('/home')}
      <div class="scroll"><section class="intro"><h1 class="intro__title">Ative o <strong>DDA</strong></h1>
        <p class="intro__desc">Com o Débito Direto Autorizado, os boletos emitidos no seu ${state.me.personType === 'PJ' ? 'CNPJ' : 'CPF'} aparecem aqui no app, sem precisar do papel.</p></section>
        <section class="body-sec"><div class="card"><div class="receipt">
          <div class="receipt__row"><span>O que aparece</span><span>Boletos bancários registrados, como aluguel, escola, condomínio e faturas</span></div>
          <div class="receipt__row"><span>O que não aparece</span><span>Contas de consumo (água, luz) e tributos</span></div>
          <div class="receipt__row"><span>Pagamento</span><span>Nada é pago sozinho: você escolhe o que e quando pagar</span></div>
        </div></div>
        <p class="row__caption">Para ativar, a Celcoin exige o seu aceite no termo de adesão. Guardamos a data e a hora do aceite.</p>
        <a class="link-inline" href="${TERMO_URL}" target="_blank" rel="noopener">${I.download} Ler o termo de adesão do DDA</a>
        <label class="dda-check"><input type="checkbox" id="acc"/><span>Li e aceito o termo de adesão do DDA</span></label></section></div>
      <footer class="footbar"><button class="btn btn-primary btn--lg" id="next" disabled>Continuar</button></footer>`, { studio: 'b86afc13 Aderir ao DDA | Termos de uso' });
    wireBk(root);
    $('#acc').onchange = (e) => { $('#next').disabled = !e.target.checked; };
    $('#next').onclick = () => { state.ddaAccept = true; go('/dda/cadastro'); };
  });

  // ============================================================ Cadastro (12b7e262)
  route('/dda/cadastro', async (root) => {
    if (!(await needAccount())) return;
    if (!state.ddaAccept) return go('/dda/termos');
    let d = {};
    try { d = await api('/me/details'); } catch (_) { /* segue com o que tiver */ }
    const fld = (id, label, val, attrs) => `<div class="field"><span class="field-label">${label}</span><div class="field-box"><input id="${id}" value="${esc(val || '')}" ${attrs || ''}/></div><p class="field-error" id="${id}-er"></p></div>`;
    root.innerHTML = frame(`${header('/dda/termos')}
      <div class="scroll"><section class="intro"><h1 class="intro__title">Confira <strong>seus dados</strong></h1><p class="intro__desc">São os dados da sua conta. Nome e documento não podem ser alterados aqui.</p></section>
        <section class="body-sec"><div class="field-group">
          ${fld('nm', 'Nome completo', state.me.fullName, 'readonly')}
          ${fld('doc', state.me.personType === 'PJ' ? 'CNPJ' : 'CPF', maskDoc(state.me.document || ''), 'readonly')}
          ${fld('em', 'E-mail', d.email, 'type="email" autocomplete="email"')}
          ${fld('ph', 'Telefone', d.phone ? fmtPhone(onlyDigits(d.phone).replace(/^55(?=\d{10,11}$)/, '')) : '', 'inputmode="tel"')}
          ${fld('cep', 'CEP', d.address && d.address.postalCode ? fmtCep(d.address.postalCode) : '', 'inputmode="numeric" maxlength="9"')}
        </div>${windowNote(state.dda)}</section></div>
      <footer class="footbar"><button class="btn btn-primary btn--lg" id="go">Confirmar cadastro</button></footer>`, { studio: '12b7e262 Aderir ao DDA | Cadastro (dados da conta)' });
    wireBk(root);
    const check = () => {
      const ok = /.+@.+\..+/.test($('#em').value) && onlyDigits($('#ph').value).length >= 10 && onlyDigits($('#cep').value).length === 8;
      $('#go').disabled = !ok;
    };
    ['#em', '#ph', '#cep'].forEach((s) => { $(s).oninput = check; });
    check();
    $('#go').onclick = async () => {
      setLoading($('#go'), true);
      try {
        await api('/dda/subscribe', { method: 'POST', body: { accept: true, email: $('#em').value, phone: $('#ph').value, cep: $('#cep').value } });
        state.ddaAccept = false; state.ddaJustSent = true; go('/dda/processando');
      } catch (e) {
        setLoading($('#go'), false); toast(e.message);
        if (e.data && e.data.error === 'ALREADY_ACTIVE') { state.ddaAccept = false; go('/dda/boletos'); }
      }
    };
  });

  // ============================================================ Processamento (0feb0a07) — adesão ou saída
  route('/dda/processando', async (root) => {
    if (!(await needAccount())) return;
    // A Celcoin leva cerca de 1 minuto para confirmar a adesão ou a saída: espera 30 s entre consultas (pedido da usuária).
    const WAIT = Math.max(30, queryWaitSec()), MAX = 6;
    let tries = 0, s = state.dda;
    const paint = () => {
      const leaving = s && s.status === 'CANCELLING';
      const stopped = tries >= MAX;
      root.innerHTML = frame(`<div class="scroll"><div class="result" style="margin-top:96px"><span class="result__badge result__badge--wait" style="width:72px;height:72px">${I.spinner}</span>
        <h1 class="result__title">${leaving ? 'Saindo do DDA' : 'Ativando o seu DDA'}</h1>
        <p class="result__desc">A Celcoin está processando o pedido. No ambiente de teste, a resposta pode levar até 10 minutos.</p>
        ${stopped ? '<p class="result__desc" style="font-size:13px">Ainda sem resposta. Você pode consultar de novo ou voltar depois: o pedido continua.</p>' : '<p class="result__timer" id="timer" aria-live="polite"></p>'}
        ${s && s.eventsError ? `<p class="result__desc" style="font-size:12px">Não conseguimos ler os avisos agora (${esc(s.eventsError)}).</p>` : ''}</div>${windowNote(s)}</div>
        <div class="actions">${stopped ? '<button class="btn btn-primary" id="again">Consultar de novo</button>' : ''}<button class="btn ${stopped ? 'btn-ghost' : 'btn-primary'}" id="home">Voltar ao início</button></div>`,
      { studio: leaving ? '0feb0a07 Cadastro | Processamento (saída do DDA)' : '0feb0a07 Aderir ao DDA | Cadastro | Processamento' });
      $('#home').onclick = () => go('/home');
      if ($('#again')) $('#again').onclick = () => { tries = 0; paint(); };
      if (!stopped) countdown('#timer', WAIT, (n) => (n > 0 ? `Consultando em ${n} s` : 'Consultando…'), query);
    };
    const query = async () => {
      tries++;
      try { s = state.dda = await loadDda(); } catch (e) { if (e.status === 401) return; toast(e.message); }
      if (s && s.status === 'ACTIVE') return go(s.deleteFailed ? '/dda/boletos' : '/dda/sucesso');
      if (s && s.status === 'ERROR') return go('/dda/erro');
      if (s && s.status === 'NONE') return go('/dda/desativado');
      if (s && s.status === 'TIMEOUT') return go('/dda/sem-resposta');
      paint();
    };
    if (state.ddaJustSent) { state.ddaJustSent = false; paint(); } else query();
  });

  // ============================================================ Sucesso (b138a51b) e Erro (4e85d7cd)
  route('/dda/sucesso', (root) => {
    root.innerHTML = frame(`<div class="scroll"><div class="result" style="margin-top:96px"><span class="result__badge result__badge--ok" style="width:72px;height:72px">${I.ok}</span>
      <h1 class="result__title">DDA ativado!</h1><p class="result__desc">A partir de agora, os boletos emitidos no seu documento aparecem em Meus boletos.</p></div></div>
      <div class="actions"><button class="btn btn-primary" id="go">Ver meus boletos</button><button class="btn btn-ghost" id="home">Voltar ao início</button></div>`,
    { studio: 'b138a51b Aderir ao DDA | Cadastro | Sucesso' });
    $('#go').onclick = () => go('/dda/boletos');
    $('#home').onclick = () => go('/home');
  });
  // Saída confirmada: mesma tela do "DDA ativado", para quem ainda estava esperando a resposta.
  route('/dda/desativado', (root) => {
    root.innerHTML = frame(`<div class="scroll"><div class="result" style="margin-top:96px"><span class="result__badge result__badge--ok" style="width:72px;height:72px">${I.ok}</span>
      <h1 class="result__title">DDA desativado</h1><p class="result__desc">A Celcoin confirmou a sua saída. Os boletos emitidos no seu documento não aparecem mais no app. Você pode ativar de novo quando quiser.</p></div></div>
      <div class="actions"><button class="btn btn-primary" id="home">Voltar ao início</button><button class="btn btn-ghost" id="again">Ativar de novo</button></div>`,
    { studio: 'novo:dda-desativado (modelo b138a51b Sucesso)' });
    $('#home').onclick = () => go('/home');
    $('#again').onclick = () => go('/dda/termos');
  });
  route('/dda/erro', async (root) => {
    const s = state.dda || (await loadDda().catch(() => null)) || {};
    root.innerHTML = frame(`<div class="scroll"><div class="result" style="margin-top:96px"><span class="result__badge result__badge--err" style="width:72px;height:72px">${I.err}</span>
      <h1 class="result__title">Não foi possível ativar o DDA</h1><p class="result__desc">${esc((s.error && s.error.message) || 'A Celcoin não concluiu a adesão.')}${s.error && s.error.code ? ` (${esc(s.error.code)})` : ''}</p></div></div>
      <div class="actions"><button class="btn btn-primary" id="again">Tentar de novo</button><button class="btn btn-ghost" id="home">Voltar ao início</button></div>`,
    { studio: '4e85d7cd Aderir ao DDA | Cadastro | Erro' });
    $('#again').onclick = () => go('/dda/termos');
    $('#home').onclick = () => go('/home');
  });

  // ============================================================ Sair do DDA (Minha conta e menu Opções)
  function confirmCancel() {
    const s = sheet(`<h2 class="sheet-title">Sair do DDA?</h2><p class="sheet-text">Os boletos do seu documento deixam de aparecer no app. Você pode ativar de novo quando quiser. Digite sua senha de transferência para confirmar.</p>
      <div class="field"><div class="field-box"><input id="tp" type="password" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="••••"/></div><p class="field-error" id="tpe"></p></div>
      <div class="sheet-actions"><button class="btn btn-danger" data-ok disabled>Sair do DDA</button><button class="btn btn-ghost" data-x>Voltar</button></div>`);
    const tp = $('#tp', s.el), ok = $('[data-ok]', s.el), tpe = $('#tpe', s.el);
    tp.oninput = () => { tp.value = onlyDigits(tp.value).slice(0, 4); ok.disabled = tp.value.length !== 4; };
    $('[data-x]', s.el).onclick = s.close;
    ok.onclick = async () => {
      setLoading(ok, true);
      try {
        const r = await api('/dda/cancel', { method: 'POST', body: { txPassword: tp.value } });
        s.close();
        if (r.status === 'NONE') return go('/dda/desativado'); // a Celcoin já não tinha adesão ativa
        state.dda = { status: 'CANCELLING', inWindow: true }; state.ddaJustSent = true; go('/dda/processando');
      } catch (e) { setLoading(ok, false); ok.disabled = false; tpe.textContent = e.message; tpe.classList.add('is-visible'); }
    };
  }
  L.ddaCancel = confirmCancel;

  function options() {
    const item = (id, label, danger) => `<button class="row" id="${id}" style="padding:14px 0"><div class="row__info"><span class="row__label"${danger ? ' style="color:var(--danger,#b42323)"' : ''}>${label}</span></div>${danger ? '' : `<span class="row__chevron">${I.chevRight}</span>`}</button>`;
    const s = sheet(`<h2 class="sheet-title">Opções</h2>${item('o-about', 'Sobre o DDA')}<span class="divider"></span>${item('o-terms', 'Termo de adesão')}<span class="divider"></span>
      ${state.dda && state.dda.canGenerateTest ? item('o-test', 'Gerar boletos de teste (sandbox)') + '<span class="divider"></span>' : ''}${item('o-cancel', 'Cancelar DDA', true)}
      <div class="sheet-actions"><button class="btn btn-ghost" data-x>Voltar</button></div>`);
    $('[data-x]', s.el).onclick = s.close;
    $('#o-about', s.el).onclick = () => { s.close(); go('/dda/termos-info'); };
    $('#o-terms', s.el).onclick = () => { window.open(TERMO_URL, '_blank', 'noopener'); };
    if ($('#o-test', s.el)) $('#o-test', s.el).onclick = () => { s.close(); genTest(); };
    $('#o-cancel', s.el).onclick = () => { s.close(); confirmCancel(); };
  }
  // Mensagem em modal com "Entendi", para a pessoa ler (o toast sumia rápido demais no D5).
  function notice(title, text) {
    const s = sheet(`<h2 class="sheet-title">${esc(title)}</h2><p class="sheet-text">${esc(text)}</p><div class="sheet-actions"><button class="btn btn-primary" data-x>Entendi</button></div>`);
    $('[data-x]', s.el).onclick = () => { s.close(); L.render(); };
  }
  async function genTest() {
    try {
      await api('/dda/test-invoices', { method: 'POST' });
      notice('Boletos de teste pedidos', 'A Celcoin vai gerar 3 boletos de teste para o seu documento. Eles costumam chegar em cerca de 1 minuto: use "Atualizar" em Meus boletos para ver.');
    } catch (e) { notice('Não foi possível gerar', e.message); }
  }

  route('/dda/termos-info', (root) => {
    root.innerHTML = frame(`${header('/dda/boletos')}<div class="scroll"><section class="intro"><h1 class="intro__title intro__title--sm">Sobre o <strong>DDA</strong></h1>
      <p class="intro__desc">O DDA mostra os boletos bancários registrados no seu documento. Ele só mostra: o pagamento é sempre feito por você, no Pagar contas. Contas de consumo e tributos não aparecem. A situação "Pago" vem do banco emissor e pode demorar a mudar.</p></section></div>`,
    { studio: 'novo:dda-sobre (item do menu Opções de 2fa3c1ee)' });
    wireBk(root);
  });

  // ============================================================ Meus boletos (c2ec3a50 vazia / 2fa3c1ee preenchida)
  route('/dda/boletos', async (root) => {
    if (!(await needAccount())) return;
    const s = state.dda = await loadDda();
    if (s.status !== 'ACTIVE') return go('/dda');
    const filter = state.ddaFilter || 'TODOS';
    const list = s.invoices.filter((i) => filter === 'TODOS' || i.situation === filter);
    const chips = [['TODOS', 'Todos'], ['PENDENTE', 'Pendentes'], ['VENCIDO', 'Vencidos'], ['PAGO', 'Pagos']];
    const card = (i) => `<button class="dda-card" data-id="${esc(i.id)}"><span class="dda-card__top"><span class="dda-card__payee">${esc(i.beneficiary)}</span><span class="dda-badge dda-badge--${BADGE[i.situation][0]}">${BADGE[i.situation][1]}</span></span>
      <span class="dda-card__line"></span><span class="dda-card__bottom"><span class="dda-card__amount">${money(i.amount)}</span><span class="dda-card__due">Venc. ${brDay(i.dueDate)}</span></span></button>`;
    const empty = !s.invoices.length;
    root.innerHTML = frame(`${header('/home', '<button class="hdr__icon" id="opts" aria-label="Mais opções">' + DOTS + '</button>')}
      <div class="scroll"><section class="intro"><h1 class="intro__title">Meus boletos</h1><p class="intro__desc">Boletos emitidos eletronicamente no seu ${state.me.personType === 'PJ' ? 'CNPJ' : 'CPF'} (DDA).</p></section>
        ${s.deleteFailed ? '<div class="info-box info-box--warn" style="margin:0 24px"><span class="info-box-bar"></span><span class="info-box-text">A Celcoin não concluiu a sua saída do DDA. Ele continua ativo.</span></div>' : ''}
        ${empty ? `<section class="body-sec"><div class="empty-card"><span class="empty-card__icon">${I.barcode}</span><p class="empty-card__title">Nenhum boleto por aqui</p>
            <p class="row__caption" style="text-align:center">Quando um boleto for emitido no seu documento, ele aparece aqui. Pode levar alguns minutos.</p>
            ${s.canGenerateTest ? '<button class="btn btn-outline" id="test">Gerar boletos de teste (sandbox)</button>' : ''}</div></section>`
        : `<div class="chips dda-chips">${chips.map(([k, t]) => `<button class="chip${k === filter ? ' chip--on' : ''}" data-f="${k}">${t}</button>`).join('')}</div>
          <section class="body-sec dda-list">${list.map(card).join('') || '<p class="row__caption" style="text-align:center">Nenhum boleto nesse filtro.</p>'}</section>`}
        <div style="display:flex;justify-content:center;align-items:center;gap:8px;padding:4px 24px 8px"><span class="row__caption" id="upd"></span><button class="link-inline" id="refresh">Atualizar</button></div>
        ${s.eventsError ? `<p class="row__caption" style="text-align:center;padding:0 24px">Não conseguimos atualizar agora (${esc(s.eventsError)}). Mostrando o que já tinha chegado.</p>` : ''}</div>
      <footer class="footbar"><button class="btn btn-primary btn--lg" id="pay">Pagar boleto ${I.chevRight}</button></footer>`,
    { studio: empty ? 'c2ec3a50 Meus boletos | Vazia' : '2fa3c1ee Meus boletos | Preenchida' });
    wireBk(root);
    $('#opts').onclick = options;
    // Atualizar: os avisos são lidos no máximo a cada 10 s, então o botão volta a funcionar depois desse tempo.
    const hhmm = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const rb = $('#refresh'); rb.disabled = true;
    rb.onclick = () => L.render();
    countdown('#upd', queryWaitSec(), (n) => (n > 0 ? `Atualizado às ${hhmm} · de novo em ${n} s` : `Atualizado às ${hhmm}`), () => { const x = $('#refresh'); if (x) x.disabled = false; });
    $('#pay').onclick = () => go('/boleto');
    if ($('#test')) $('#test').onclick = genTest;
    $$('[data-f]').forEach((b) => { b.onclick = () => { state.ddaFilter = b.dataset.f; L.render(); }; });
    $$('.dda-card').forEach((b) => { b.onclick = () => go('/dda/boleto/' + encodeURIComponent(b.dataset.id)); });
  });

  // ============================================================ Detalhe do boleto (b45f3550)
  route_prefix('/dda/boleto/', async (root, id) => {
    if (!(await needAccount())) return;
    let i;
    try { i = await api('/dda/invoices/' + encodeURIComponent(decodeURIComponent(id))); } catch (e) { toast(e.message); return go('/dda/boletos'); }
    const row = (k, val) => `<div class="receipt__row"><span>${k}</span><span>${val}</span></div>`;
    const code = i.digitable || i.barCode || '';
    const canPay = i.situation === 'PENDENTE' || i.situation === 'VENCIDO';
    root.innerHTML = frame(`${header('/dda/boletos')}
      <div class="scroll"><section class="intro"><h1 class="intro__title intro__title--sm">${esc(i.beneficiary)}</h1><p class="intro__desc"><span class="dda-badge dda-badge--${BADGE[i.situation][0]}">${BADGE[i.situation][1]}</span></p></section>
        <section class="body-sec">
          <div><div class="amount__label">Valor do boleto</div><div class="amount__row"><span class="amount__value">${money(i.amount)}</span></div></div>
          <p class="keyfield__err hidden" id="er"></p>
          <div class="card"><div class="receipt">
            ${row('Vencimento', brDay(i.dueDate))}
            ${row('Beneficiário', esc(i.beneficiary))}
            ${i.beneficiaryDoc ? row('Documento', esc(docLabel(i.beneficiaryDoc).replace(/^\w+: /, ''))) : ''}
            ${i.bankCode ? row('Banco emissor', esc(i.bankCode)) : ''}
            ${row('Juros', esc(rule(i.interest, INTEREST)))}
            ${row('Multa', esc(rule(i.fine, FINE)))}
            ${i.discount ? row('Desconto', esc(i.discount.description || 'Desconto')) : ''}
            ${i.ourNumber ? row('Nosso número', esc(i.ourNumber)) : ''}
            ${row('Situação na Celcoin', esc(i.celcoinStatus || '—'))}
            <div style="display:flex;flex-direction:column;gap:2px;font-size:14px;line-height:21px"><span style="color:var(--muted)">Código do boleto</span><span style="font-weight:600;word-break:break-all">${esc(code)}</span></div>
          </div></div>
          <p class="row__caption">O valor final, com juros e multa, é calculado pelo banco emissor na hora de pagar.</p>
        </section></div>
      <footer class="footbar" style="display:flex;flex-direction:column;gap:8px">${canPay ? '<button class="btn btn-primary btn--lg" id="pay">Pagar boleto</button>' : ''}<button class="btn btn-outline btn--lg" id="cp">Copiar código</button></footer>`,
    { studio: 'b45f3550 Meus boletos | Detalhe do boleto' });
    wireBk(root);
    $('#cp').onclick = () => copy(code);
    if ($('#pay')) $('#pay').onclick = async () => {
      const btn = $('#pay'); setLoading(btn, true);
      // Linha de 47 números ou, se a linha não for válida, o código de barras de 44 (o authorize aceita os dois).
      const send = onlyDigits(i.digitable).length === 47 ? i.digitable : i.barCode;
      try {
        const r = await api('/bills/authorize', { method: 'POST', body: { code: send } });
        state.billCode = onlyDigits(send); state.bill = { info: r, amount: r.total, fromDda: i.id };
        go(r.allowChangeValue ? '/boleto/valor' : '/boleto/confirmar');
      } catch (e) {
        setLoading(btn, false);
        // A linha dos boletos de teste do DDA não é válida no sandbox (822, ou 623 pelo código de barras).
        const msg = (e.data && (e.data.error === 'INVALID_CODE' || e.data.error === '623'))
          ? 'O banco emissor não reconheceu o código deste boleto.' + (state.dda && state.dda.canGenerateTest ? ' No ambiente de teste, os boletos gerados pelo DDA não podem ser pagos.' : '')
          : e.message;
        const er = $('#er'); er.textContent = msg; er.classList.remove('hidden');
      }
    };
  });
})();
