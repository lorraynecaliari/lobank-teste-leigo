/* LoBank — Pagamento de Contas (boleto). Board do Studio "Pagamento de Contas".
   Telas retiradas por comentário/decisão: leitores por câmera, "Conta de pagamento", agendamento e "Abrir PDF".
   Fluxo: authorize → billpayment (200 PROCESSING não é sucesso) → status a cada 10 s → recibo oficial. */
(function () {
  'use strict';
  const L = window.LoBank;
  const { $, $$, esc, money, onlyDigits, maskDoc, parseMoney, fmtDateTime, api, I, state, route, route_prefix, go, back, frame, toast, sheet, copy, setLoading, loadMe, countdown, queryWaitSec, LOGO } = L;

  const header = (to) => `<header class="hdr hdr--wl"><button class="hdr__icon" id="bk" aria-label="Voltar"${to ? ` data-to="${to}"` : ''}>${I.chevLeft}</button><span class="logo">${LOGO('#7664FA', 104)}</span><span class="hdr__icon"></span></header>`;
  const wireBk = (root) => { const b = $('#bk', root); if (b) b.onclick = () => (b.dataset.to ? go(b.dataset.to) : back()); };
  async function needAccount() {
    if (!(await loadMe())) { go('/login'); return false; }
    if (!state.me.account) { go('/validacao'); return false; }
    return true;
  }
  // Linha digitável no formato impresso: 00000.00000 00000.000000 00000.000000 0 00000000000000
  const fmtLine = (d) => {
    d = onlyDigits(d);
    if (d.length !== 47) return d;
    return `${d.slice(0, 5)}.${d.slice(5, 10)} ${d.slice(10, 15)}.${d.slice(15, 21)} ${d.slice(21, 26)}.${d.slice(26, 32)} ${d.slice(32, 33)} ${d.slice(33)}`;
  };
  const brDay = (s) => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : '—');
  // Código longo: rótulo em cima e número embaixo, para não quebrar o rótulo em três linhas.
  const codeRow = (d) => `<div style="display:flex;flex-direction:column;gap:2px;font-size:14px;line-height:21px"><span style="color:var(--muted)">Código do boleto</span><span style="font-weight:600;color:var(--ink-2);word-break:break-word">${esc(fmtLine(d || ''))}</span></div>`;
  // Depois de uma falha, o app diz o que o extrato mostra, sem prometer que nada foi debitado.
  const moneyNote = (t) => (t.debitOnError
    ? `<strong>Atenção:</strong> ${money(t.debitOnError.amount)} aparece debitado no seu extrato (${esc(t.debitOnError.status || 'bloqueado')}). Não pague de novo antes de resolver: guarde o ID ${esc(t.clientCode)}.`
    : t.debitChecked ? 'Conferimos o extrato: nenhum valor foi debitado.' : 'Confira o extrato para ver se algum valor foi debitado.');
  const docLabel = (d) => (d ? `${onlyDigits(d).length === 14 ? 'CNPJ' : 'CPF'}: ${maskDoc(onlyDigits(d))}` : '');

  // ============================================================ Formas de Pagamento
  // Studio: "Pagamento de contas | Formas de Pagamento". Fora: "Leitor de códigos" (câmera) e "Abrir PDF".
  route('/boleto', async (root) => {
    if (!(await needAccount())) return;
    state.bill = null;
    const opt = (id, icon, title, sub) => `<button class="row" id="${id}" style="padding:14px 0"><span class="row__icon row__icon--soft">${icon}</span><div class="row__info"><span class="row__label">${title}</span><span class="row__caption">${sub}</span></div><span class="row__chevron">${I.chevRight}</span></button>`;
    root.innerHTML = frame(`${header('/home')}
      <div class="scroll"><section class="intro"><h1 class="intro__title">Pagar <strong>boleto</strong></h1><p class="intro__desc">Como você quer informar o boleto?</p></section>
        <section class="body-sec"><div class="card">
          ${opt('type', I.barcode, 'Digitar código', 'Os números acima do código de barras')}<span class="divider"></span>
          ${opt('pix', I.copy, 'Pix Copia e Cola', 'Quando o boleto traz um código Pix')}
        </div>
        <p class="row__caption" style="text-align:center;margin-top:8px">Tem um leitor de código de barras USB ou bluetooth? Escolha <strong>Digitar código</strong> e use o leitor no campo.</p></section></div>`,
    { studio: 'Formas de Pagamento (sem leitor por câmera e sem Abrir PDF)' });
    wireBk(root);
    $('#type').onclick = () => go('/boleto/codigo');
    $('#pix').onclick = () => go('/pix/copia-e-cola');
  });

  // ============================================================ Digitar código manualmente
  route('/boleto/codigo', async (root) => {
    if (!(await needAccount())) return;
    root.innerHTML = frame(`${header('/boleto')}
      <div class="scroll"><section class="intro"><h1 class="intro__title intro__title--sm">Digite o <strong>código do boleto</strong></h1><p class="intro__desc">São 47 números. Pode colar com pontos e espaços: a gente arruma.</p></section>
        <section class="keyfield"><span class="keyfield__label">Código do boleto</span>
          <div class="keyfield__input keyfield__input--area" id="box"><textarea id="code" rows="3" inputmode="numeric" autocomplete="off" spellcheck="false" placeholder="00000.00000 00000.000000 00000.000000 0 00000000000000">${esc((state.billCode && fmtLine(state.billCode)) || '')}</textarea></div>
          <p class="row__caption" id="cnt"></p>
          <p class="keyfield__err hidden" id="er"></p>
          <button type="button" class="link-inline" id="paste">${I.copy} Colar da área de transferência</button>
          ${state.mode === 'mock' ? '<p class="keyfield__alt">Modo simulado: use as linhas da massa de teste da Celcoin.</p>' : ''}
        </section></div>
      <footer class="footbar"><button class="btn btn-primary btn--lg" id="next" disabled>Continuar</button></footer>`, { studio: 'Digitar código manualmente' });
    wireBk(root);
    const code = $('#code'), next = $('#next'), er = $('#er'), box = $('#box'), cnt = $('#cnt');
    const showErr = (msg) => { box.classList.add('is-error'); er.textContent = msg; er.classList.remove('hidden'); };
    const check = () => {
      const d = onlyDigits(code.value);
      cnt.textContent = d.length ? `${d.length} de 47 números` : '';
      next.disabled = !(d.length === 47 || d.length === 44);
      er.classList.add('hidden'); box.classList.remove('is-error');
      if (d.startsWith('8')) { next.disabled = true; showErr('Esse é um código de conta de consumo ou tributo (começa com 8). Por enquanto, o LoBank paga só boletos bancários.'); }
      else if (d.length > 47) showErr('Tem números a mais. O código do boleto tem 47 números.');
    };
    code.oninput = () => { const d = onlyDigits(code.value); if (d.length === 47) code.value = fmtLine(d); check(); };
    code.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); if (!next.disabled) next.click(); } }; // leitores USB terminam com Enter
    check();
    $('#paste').onclick = async () => {
      try { const t = await navigator.clipboard.readText(); code.value = t; code.oninput(); } catch (_) { toast('Não foi possível colar. Use Ctrl+V no campo.'); }
    };
    next.onclick = async () => {
      setLoading(next, true);
      try {
        const r = await api('/bills/authorize', { method: 'POST', body: { code: code.value } });
        state.billCode = onlyDigits(code.value);
        state.bill = { info: r, amount: r.total };
        go(r.allowChangeValue ? '/boleto/valor' : '/boleto/confirmar');
      } catch (e) { setLoading(next, false); showErr(e.message); }
    };
  });

  // ============================================================ Informar valor (sem data)
  // Studio: "Informar valor e data" sem a data (sem agendamento). Só aparece quando o boleto deixa mudar o valor.
  route('/boleto/valor', async (root) => {
    const b = state.bill;
    if (!b || !b.info) return go('/boleto/codigo');
    const i = b.info;
    root.innerHTML = frame(`${header()}
      <div class="scroll"><section class="intro"><h1 class="intro__title">Quanto você quer <strong>pagar</strong>?</h1><p class="intro__desc">Saldo disponível <strong id="bal">…</strong></p></section>
        <section class="body-sec"><div class="amount-input"><span>R$</span><input id="amt" inputmode="numeric" placeholder="0,00" value="${esc(b.amount.toFixed(2).replace('.', ','))}"/></div>
          <p class="keyfield__err hidden" id="er"></p>
          <div class="info-box"><span class="info-box-bar"></span><span class="info-box-text">Esse boleto aceita valores de <strong>${money(i.minValue || 0)}</strong> a <strong>${money(i.maxValue || i.total)}</strong>. O valor atualizado é ${money(i.total)}.</span></div></section></div>
      <footer class="footbar"><button class="btn btn-primary btn--lg" id="next">Continuar</button></footer>`, { studio: 'Informar valor (sem data)' });
    wireBk(root);
    const amt = $('#amt'), next = $('#next'), er = $('#er');
    const val = () => parseMoney(amt.value) || 0;
    const check = () => {
      const n = val();
      const bad = !n ? 'Informe o valor.' : (i.minValue && n < i.minValue - 0.001) ? `O valor mínimo é ${money(i.minValue)}.` : (i.maxValue && n > i.maxValue + 0.001) ? `O valor máximo é ${money(i.maxValue)}.` : '';
      er.textContent = bad; er.classList.toggle('hidden', !bad); next.disabled = !!bad;
    };
    amt.oninput = () => { const n = Number(onlyDigits(amt.value) || 0) / 100; amt.value = n ? n.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''; check(); };
    check();
    next.onclick = () => { b.amount = val(); go('/boleto/confirmar'); };
    try { const r = await api('/balance'); b.balance = r.amount; $('#bal').textContent = money(r.amount); } catch (_) { $('#bal').textContent = 'indisponível'; }
  });

  // ============================================================ Confirmar Valor
  // Studio: "Pagamento de contas | Confirmar Valor" (deb4ee82). "Pagar com" mostra a conta de pagamento (comentário do Studio).
  route('/boleto/confirmar', async (root) => {
    const b = state.bill;
    if (!b || !b.info) return go('/boleto/codigo');
    const i = b.info;
    const extra = (i.fine || 0) + (i.interest || 0);
    const row = (k, val) => `<div class="receipt__row"><span>${k}</span><span>${val}</span></div>`;
    root.innerHTML = frame(`${header()}
      <div class="scroll"><section class="intro"><h1 class="intro__title">Ok, <strong>ficou tudo certo</strong>?</h1><p class="intro__desc">Saldo disponível <strong id="bal">${b.balance != null ? money(b.balance) : '…'}</strong></p></section>
        <section class="body-sec">
          ${i.overdue ? `<div class="info-box info-box--warn"><span class="info-box-bar"></span><span class="info-box-text"><strong>Boleto vencido em ${brDay(i.dueDate)}.</strong> ${extra ? `Multa e juros de ${money(extra)} já estão no valor.` : 'Confira o valor antes de pagar.'}</span></div>` : ''}
          <div><div class="amount__label">Valor do boleto</div>
            ${!i.allowChangeValue && Math.abs((i.originalValue || b.amount) - b.amount) > 0.001 ? `<div class="row__caption" style="text-decoration:line-through">${money(i.originalValue)}</div>` : ''}
            <div class="amount__row"><span class="amount__value">${money(b.amount)}</span>${i.allowChangeValue ? `<button class="amount__edit" id="edit" aria-label="Editar valor">${I.edit}</button>` : ''}</div>
            ${i.allowChangeValue ? '' : '<p class="row__caption" style="margin-top:4px">Valor atualizado pelo banco emissor</p>'}</div>
          <div class="group"><span class="group__title">Para</span><div class="card"><div class="contact"><span class="avatar">${I.barcode}</span><div class="contact__info"><span class="contact__name">${esc(i.recipient || 'Beneficiário')}</span>
            <div class="contact__desc"><span>${esc(docLabel(i.recipientDoc))}</span>${i.assignor ? `<span>${esc(i.assignor)}</span>` : ''}</div></div></div></div></div>
          <div class="group"><span class="group__title">Boleto</span><div class="card"><div class="receipt">
            ${row('Vencimento', brDay(i.dueDate))}
            ${codeRow(i.digitable || i.barCode)}
            <div id="more" class="receipt hidden">
              ${i.payer ? row('Pagador', esc(i.payer)) : ''}
              ${row('Valor original', money(i.originalValue))}
              ${i.discount ? row('Desconto', '− ' + money(i.discount)) : ''}
              ${i.fine ? row('Multa', '+ ' + money(i.fine)) : ''}
              ${i.interest ? row('Juros', '+ ' + money(i.interest)) : ''}
              ${row('Valor atualizado', money(i.total))}
              ${row('Pagar com', `Saldo da conta de pagamento ${esc(state.me ? state.me.account.account : '')}`)}
              ${row('Data do pagamento', 'Hoje')}
            </div>
            <button class="link-inline" id="see" style="padding:0">Ver mais ${I.chevDown || ''}</button>
          </div></div></div>
        </section></div>
      <footer class="footbar" style="display:flex;flex-direction:column;gap:8px"><button class="btn btn-primary btn--lg" id="go">Pagar boleto</button><button class="btn btn-ghost" id="bk2">Voltar</button></footer>`, { studio: 'deb4ee82 Confirmar Valor' });
    wireBk(root);
    $('#bk2').onclick = back;
    if ($('#edit')) $('#edit').onclick = () => go('/boleto/valor');
    $('#see').onclick = () => { const m = $('#more'); m.classList.toggle('hidden'); $('#see').firstChild.textContent = m.classList.contains('hidden') ? 'Ver mais ' : 'Ver menos '; };
    if (b.balance == null) { try { const r = await api('/balance'); b.balance = r.amount; $('#bal').textContent = money(r.amount); } catch (_) { /* segue: o servidor confere de novo */ } }
    $('#go').onclick = () => {
      if (b.balance != null && b.balance < b.amount) return go('/boleto/saldo-insuficiente');
      const s = sheet(`<h2 class="sheet-title">Senha de transferência</h2><p class="sheet-text">Digite sua senha de 4 números para pagar o boleto de <strong>${money(b.amount)}</strong>.</p>
        <div class="field"><div class="field-box"><input id="tp" type="password" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="••••"/></div><p class="field-error" id="tpe"></p></div>
        <div class="sheet-actions"><button class="btn btn-primary" data-ok disabled>Confirmar</button><button class="btn btn-ghost" data-x>Cancelar</button></div>`);
      const tp = $('#tp', s.el), ok = $('[data-ok]', s.el), tpe = $('#tpe', s.el);
      tp.focus();
      tp.oninput = () => { tp.value = onlyDigits(tp.value).slice(0, 4); ok.disabled = tp.value.length !== 4; };
      $('[data-x]', s.el).onclick = s.close;
      ok.onclick = async () => {
        setLoading(ok, true); tpe.classList.remove('is-visible');
        try {
          const r = await api('/bills/pay', { method: 'POST', body: { lookupId: i.lookupId, amount: b.amount, txPassword: tp.value } });
          state.bill = null; state.billCode = null; state.justPaidBill = r.txId; s.close(); go('/boleto/pagamento/' + r.txId);
        } catch (e) {
          if (e.data && e.data.error === 'INVALID_TX_PASSWORD') { tpe.textContent = e.message; tpe.classList.add('is-visible'); setLoading(ok, false); ok.disabled = false; return; }
          s.close();
          if (e.data && e.data.error === 'INSUFFICIENT_BALANCE') { b.balance = e.data.balance; return go('/boleto/saldo-insuficiente'); }
          if (e.data && e.data.error === 'LOOKUP_EXPIRED') { toast(e.message); return go('/boleto/codigo'); }
          toast(e.message);
        }
      };
    };
  });

  // Saldo insuficiente (modelo comum do Pix)
  route('/boleto/saldo-insuficiente', (root) => {
    const b = state.bill || {};
    root.innerHTML = frame(`<header class="hdr"><button class="hdr__icon" id="bk" aria-label="Voltar">${I.chevLeft}</button></header>
      <div class="scroll"><div class="result"><span class="result__badge result__badge--err" style="width:72px;height:72px">${I.err}</span>
        <h1 class="result__title">Saldo insuficiente</h1><p class="result__desc">Você tem <strong>${money(b.balance)}</strong> disponíveis e o boleto é de <strong>${money(b.amount)}</strong>.</p></div></div>
      <div class="actions"><button class="btn btn-primary" id="home">Voltar ao início</button></div>`, { studio: 'a49d2b21 Saldo insuficiente (modelo comum)' });
    wireBk(root);
    $('#home').onclick = () => go('/home');
  });

  // ============================================================ Pagamento concluído / Falha / em processamento
  // Espera 10 s com o tempo na tela antes de cada consulta. Para depois de 6 consultas e deixa consultar de novo.
  route_prefix('/boleto/pagamento/', async (root, id) => {
    const WAIT = queryWaitSec(), MAX = 6;
    let tries = 0, last = null;
    const paint = (t) => {
      const st = t ? t.status : 'WAITING';
      const who = t ? `${money(t.amount)} para ${esc(t.bill.name || 'o beneficiário')}` : '';
      const view = st === 'CONFIRMED' ? { b: 'ok', i: I.ok, title: 'Pagamento concluído!', desc: who, studio: 'Pagamento concluído' }
        : st === 'ERROR' ? { b: 'err', i: I.err, title: 'Falha no pagamento', desc: esc(t.errorMessage || 'O pagamento não foi concluído.') + '<br>' + moneyNote(t), studio: 'Falha no pagamento' }
          : st === 'UNKNOWN' ? { b: 'wait', i: I.spinner, title: 'Confirmando com a Celcoin', desc: 'A conexão caiu no envio. Não pague de novo: estamos confirmando se o pagamento foi feito.', studio: 'novo:pagamento-em-processamento' }
            : { b: 'wait', i: I.spinner, title: 'Pagamento em processamento', desc: who || 'Aguardando a confirmação da Celcoin.', studio: 'novo:pagamento-em-processamento' };
      const waiting = st === 'WAITING' || st === 'PROCESSING' || st === 'UNKNOWN';
      const stopped = waiting && tries >= MAX;
      root.innerHTML = frame(`<div class="scroll"><div class="result" style="margin-top:96px"><span class="result__badge result__badge--${view.b}" style="width:72px;height:72px">${view.i}</span>
        <h1 class="result__title">${view.title}</h1><p class="result__desc">${view.desc}</p>
        ${waiting && !stopped ? '<p class="result__timer" id="timer" aria-live="polite"></p>' : ''}
        ${stopped ? '<p class="result__desc" style="font-size:13px">A Celcoin ainda não confirmou. Você pode consultar de novo ou ver o comprovante pendente.</p>' : ''}</div></div>
        <div class="actions">${st === 'CONFIRMED' || stopped ? '<button class="btn btn-primary" id="rc">' + (st === 'CONFIRMED' ? 'Ver comprovante' : 'Ver comprovante pendente') + '</button>' : ''}
          ${stopped ? '<button class="btn btn-outline" id="again">Consultar de novo</button>' : ''}
          ${st === 'ERROR' && !t.debitOnError ? '<button class="btn btn-primary" id="retry">Tentar de novo</button>' : ''}${st === 'ERROR' && t.debitOnError ? '<button class="btn btn-primary" id="rc">Ver detalhes</button>' : ''}
          <button class="btn ${st === 'CONFIRMED' || stopped || st === 'ERROR' ? 'btn-ghost' : 'btn-primary'}" id="home">Voltar ao início</button></div>`, { studio: view.studio });
      $('#home').onclick = () => go('/home');
      if ($('#rc')) $('#rc').onclick = () => go('/boleto/comprovante/' + id);
      if ($('#retry')) $('#retry').onclick = () => go('/boleto/codigo');
      if ($('#again')) $('#again').onclick = () => { tries = 0; paint(last); };
      if (waiting && !stopped) countdown('#timer', WAIT, (n) => (n > 0 ? `Consultando a Celcoin em ${n} s` : 'Consultando…'), query);
    };
    const query = async () => {
      tries++;
      try { last = await api('/bills/' + encodeURIComponent(id)); } catch (e) { if (e.status === 401) return; toast(e.message); }
      paint(last);
    };
    if (String(state.justPaidBill) === String(id)) { state.justPaidBill = null; paint(null); } else query();
  });

  // ============================================================ Comprovante (oficial ou pendente)
  // Studio: "Comprovante de pagamento" e "Comprovante | Pagamento pendente". O recibo oficial vem do evento billpayment.
  route_prefix('/boleto/comprovante/', async (root, id) => {
    const t = await api('/bills/' + encodeURIComponent(id));
    const c = t.bill || {}, r = t.receipt;
    const confirmed = t.status === 'CONFIRMED';
    const pending = t.status === 'PROCESSING' || t.status === 'UNKNOWN';
    const row = (k, val) => `<div class="receipt__row"><span>${k}</span><span>${val}</span></div>`;
    root.innerHTML = frame(`${header()}
      <div class="scroll"><section class="intro"><h1 class="intro__title intro__title--sm">${pending ? 'Pagamento pendente' : t.status === 'ERROR' ? 'Pagamento não concluído' : 'Comprovante de pagamento'}</h1><p class="intro__desc">${fmtDateTime(t.createdAt + 'Z')}</p></section>
        <section class="body-sec">
          ${pending ? '<div class="info-box info-box--warn"><span class="info-box-bar"></span><span class="info-box-text">A Celcoin ainda está processando esse pagamento. O comprovante definitivo aparece quando ele for confirmado.</span></div>' : ''}
          ${t.status === 'ERROR' ? `<div class="info-box info-box--warn"><span class="info-box-bar"></span><span class="info-box-text">${esc(t.errorMessage || '')} ${moneyNote(t)}</span></div>` : ''}
          ${confirmed && !r ? '<div class="info-box"><span class="info-box-bar"></span><span class="info-box-text" id="rcw">Pagamento confirmado. O recibo oficial da Celcoin chega em instantes.</span></div>' : ''}
          <div class="card"><div class="receipt">
            ${row('Situação', confirmed ? 'Pago' : t.status === 'ERROR' ? 'Não concluído' : 'Em processamento')}
            ${row(confirmed ? 'Valor pago' : 'Valor', money(t.amount))}
            ${row('Beneficiário', esc(c.name || ''))}
            ${c.document ? row('Documento', esc(docLabel(c.document).replace(/^\w+: /, ''))) : ''}
            ${c.assignor ? row('Banco emissor', esc(c.assignor)) : ''}
            ${row('Vencimento', brDay(c.dueDate))}
            ${c.discount ? row('Desconto', '− ' + money(c.discount)) : ''}
            ${c.fine ? row('Multa', '+ ' + money(c.fine)) : ''}
            ${c.interest ? row('Juros', '+ ' + money(c.interest)) : ''}
            ${codeRow(c.digitable || c.barCode)}
            <span class="divider"></span>
            ${row('Pago por', esc(state.me ? state.me.fullName : ''))}
            ${r && r.protocol ? row('Protocolo', esc(r.protocol)) : ''}
            ${r && r.authenticationCode ? row('Autenticação', esc(r.authenticationCode)) : ''}
            ${r && r.convenant ? row('Convênio', esc(r.convenant)) : ''}
            ${r && r.settleDate ? row('Liquidação', brDay(r.settleDate)) : ''}
            ${row('ID da transação', esc(t.clientCode))}
          </div></div>
          ${r && r.formatted ? `<div class="group"><span class="group__title">Recibo da Celcoin</span><pre class="emv" style="white-space:pre;overflow-x:auto;font-family:ui-monospace,monospace;font-size:10.5px;line-height:15px">${esc(r.formatted.replace(/\r/g, ''))}</pre></div>` : ''}
          ${confirmed && !r ? '<p class="result__timer" id="timer" aria-live="polite" style="text-align:center"></p>' : ''}
        </section></div>
      <footer class="footbar" style="display:flex;flex-direction:column;gap:8px">${confirmed && !r ? '<button class="btn btn-outline btn--lg" id="again" disabled>Buscar recibo</button>' : ''}<button class="btn btn-primary btn--lg" id="share">Copiar comprovante</button><button class="btn btn-ghost" id="home">Voltar ao início</button></footer>`,
    { studio: pending ? 'Comprovante | Pagamento pendente' : t.status === 'ERROR' ? 'Comprovante (falha)' : 'Comprovante de pagamento' });
    wireBk(root);
    $('#home').onclick = () => go('/home');
    $('#share').onclick = () => copy(r && r.formatted ? r.formatted.replace(/\r/g, '')
      : `Pagamento de boleto LoBank\nValor: ${money(t.amount)}\nBeneficiário: ${c.name || ''}\nCódigo: ${fmtLine(c.digitable || c.barCode || '')}\nSituação: ${confirmed ? 'Pago' : t.status}\nID: ${t.clientCode}`);
    if (confirmed && !r) {
      // O evento costuma chegar alguns segundos depois da confirmação: libera a nova busca a cada 10 s.
      countdown('#timer', queryWaitSec(), (n) => (n > 0 ? `Nova busca do recibo em ${n} s` : ''), () => { const a = $('#again'); if (a) a.disabled = false; });
      $('#again').onclick = () => L.render();
    }
  });
})();
