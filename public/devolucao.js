/* LoBank — Devolução de Pix recebido. Board do Studio "Devolução" (61d9cfb2), 4 telas.
   Entrada: um Pix recebido no extrato (lançamento com "refundable"). A Celcoin responde PROCESSING e o desfecho
   chega no aviso pix-reversal-out; a tela de resultado espera 10 s entre as consultas, como no Pix enviado. */
(function () {
  'use strict';
  const L = window.LoBank;
  const { $, esc, money, onlyDigits, maskDoc, parseMoney, fmtDateTime, api, I, state, route, route_prefix, go, back, frame, toast, sheet, copy, setLoading, loadMe, countdown, queryWaitSec, LOGO } = L;

  // Motivos aceitos pela Celcoin na devolução (POST /baas/v2/pix/reverse).
  const REASONS = [['MD06', 'Devolução solicitada pelo cliente'], ['BE08', 'Erro bancário'], ['FR01', 'Suspeita de fraude']];
  const CLOSE = '<svg width="16.97" height="16.97" viewBox="0 0 16.9707 16.9707" fill="none"><path d="M8.48533 6.6L15.0853 0L16.9707 1.88533L10.3707 8.48533L16.9707 15.0853L15.0853 16.9707L8.48533 10.3707L1.88533 16.9707L0 15.0853L6.6 8.48533L0 1.88533L1.88533 0L8.48533 6.6Z" fill="currentColor"/></svg>';
  const RECEIPT = '<svg width="24" height="27.87" viewBox="0 0 24 27.8654" fill="none"><path d="M14.6732 15.6722H7.33984V18.3388H10.6732V21.0055H13.3399V18.3388H14.6732C16.5141 18.3388 18.0065 16.8464 18.0065 15.0055C18.0065 13.1646 16.5141 11.6722 14.6732 11.6722H9.33987C8.97166 11.6722 8.67318 11.3738 8.67318 11.0055C8.67318 10.6374 8.97166 10.3388 9.33987 10.3388L16.6732 10.3388V7.6722H13.3399V5.00553H10.6732V7.6722L9.33987 7.6722C7.4989 7.6722 6.00651 9.16459 6.00651 11.0055C6.00651 12.8464 7.4989 14.3388 9.33987 14.3388H14.6732C15.0413 14.3388 15.3399 14.6374 15.3399 15.0055C15.3399 15.3738 15.0413 15.6722 14.6732 15.6722Z" fill="currentColor"/><path fill-rule="evenodd" clip-rule="evenodd" d="M22.6667 0C23.403 0 24 0.596954 24 1.33333V27.2526C24 27.5721 23.6439 27.7626 23.3781 27.5854L20.3698 25.5799C20.1459 25.4306 19.8541 25.4306 19.6302 25.5799L16.3698 27.7535C16.1459 27.9028 15.8541 27.9028 15.6302 27.7535L12.3698 25.5799C12.1459 25.4306 11.8541 25.4306 11.6302 25.5799L8.3698 27.7535C8.14587 27.9028 7.85413 27.9028 7.6302 27.7535L4.3698 25.5799C4.14587 25.4306 3.85413 25.4306 3.6302 25.5799L0.62188 27.5854C0.356058 27.7626 0 27.5721 0 27.2526V1.33333C0 0.596954 0.596954 0 1.33333 0H22.6667ZM2.66667 23.0794V2.66667H21.3333V23.0794C20.3062 22.6309 19.1054 22.7248 18.151 23.3611L16 24.7951L13.849 23.3611C12.7293 22.6146 11.2707 22.6146 10.151 23.3611L8 24.7951L5.849 23.3611C4.89457 22.7248 3.6938 22.6309 2.66667 23.0794Z" fill="currentColor"/></svg>';
  const SEND = '<svg width="20.22" height="20.19" viewBox="0 0 20.2176 20.1903" fill="none"><path d="M0.376143 7.10197C-0.133857 6.89697 -0.127857 6.59197 0.410143 6.41297L19.4961 0.0509739C20.0251 -0.125026 20.3281 0.170974 20.1801 0.688974L14.7261 19.775C14.5761 20.304 14.2511 20.328 14.0091 19.845L9.45314 10.732L0.376143 7.10197ZM5.26614 6.90197L10.9021 9.15697L13.9421 15.239L17.4881 2.82897L5.26514 6.90197H5.26614Z" fill="currentColor"/></svg>';
  const header = (icon, id) => `<header class="hdr hdr--wl"><button class="hdr__icon" id="${id || 'bk'}" aria-label="${icon === CLOSE ? 'Fechar' : 'Voltar'}">${icon || I.chevLeft}</button><span class="logo">${LOGO('#7664FA', 104)}</span><span class="hdr__icon"></span></header>`;
  const docLabel = (d) => { const x = onlyDigits(d || ''); return x ? `${x.length === 14 ? 'CNPJ' : 'CPF'}: ${maskDoc(x)}` : ''; };
  const day = (iso) => String(iso || '').slice(0, 10);

  async function needAccount() {
    if (!(await loadMe())) { go('/login'); return false; }
    if (!state.me.account) { go('/validacao'); return false; }
    return true;
  }
  const current = () => state.refund && state.refund.mov;

  // Entrada a partir do extrato: guarda o lançamento e abre o detalhe.
  L.openRefund = (m) => { state.refund = { mov: m }; go('/devolucao'); };

  // Texto do comprovante do Pix recebido (não há comprovante da Celcoin para recebimento).
  const receiptText = (m) => `Pix recebido · LoBank\nValor: ${money(m.amount)}\nDe: ${(m.payer && m.payer.name) || m.counterpart || ''}\nData: ${fmtDateTime(m.date)}\nID da transação: ${m.endToEndId || ''}`;
  function receiptSheet(m) {
    const p = m.payer || {};
    const s = sheet(`<h2 class="sheet-title">Pix recebido</h2><div class="receipt">
      <div class="receipt__row"><span>Valor</span><span>${money(m.amount)}</span></div>
      <div class="receipt__row"><span>De</span><span>${esc(p.name || m.counterpart || '')}</span></div>
      ${p.taxId ? `<div class="receipt__row"><span>Documento</span><span>${esc(docLabel(p.taxId))}</span></div>` : ''}
      <div class="receipt__row"><span>Data</span><span>${fmtDateTime(m.date)}</span></div>
      <div class="receipt__row"><span>Situação</span><span>${esc(m.status || '')}</span></div>
      <div class="receipt__row"><span>ID da transação</span><span>${esc(m.endToEndId || '')}</span></div></div>
      <div class="sheet-actions"><button class="btn btn-primary" data-x>Fechar</button></div>`);
    $('[data-x]', s.el).onclick = s.close;
  }

  // ============================================================ Detalhes da transação (34a402de)
  route('/devolucao', async (root) => {
    if (!(await needAccount())) return;
    const m = current();
    if (!m) return go('/extrato');
    const p = m.payer || {};
    root.innerHTML = frame(`${header(CLOSE)}
      <div class="scroll"><section class="intro"><h1 class="intro__title intro__title--bold">Recebimento Pix</h1><p class="intro__desc">Verifique os dados da transação original</p></section>
        <section class="body-sec">
          <div class="card"><div><div class="dev-amount">${money(m.amount)}</div>
            <div class="dev-to"><span class="dev-to__label">de</span><span class="dev-to__name">${esc(p.name || m.counterpart || '')}</span></div></div>
            <span class="divider"></span><span class="dev-time">Recebido em ${fmtDateTime(m.date)}</span></div>
          <div class="card"><div class="dev-voucher"><span class="dev-voucher__icon">${RECEIPT}</span><span class="dev-voucher__title">Comprovante</span></div>
            <div class="dev-voucher__actions"><button class="btn btn-primary btn--inline" id="open">Abrir</button><button class="btn btn--inline dev-send" id="send">${SEND}Enviar</button></div></div>
          <div class="card"><span class="dev-time">ID da transação - ${esc(m.endToEndId || '')}</span></div>
        </section></div>
      <footer class="footbar footbar--note"><button class="btn btn-primary btn--lg" id="go">Devolver um valor</button>
        <p class="footbar__note">A devolução pode ser feita de forma total ou parcial<br/>em até 90 dias após o recebimento.</p></footer>`,
    { studio: '34a402de Devolução | Detalhes da transação' });
    $('#bk').onclick = () => go('/extrato');
    $('#open').onclick = () => receiptSheet(m);
    $('#send').onclick = () => copy(receiptText(m));
    $('#go').onclick = () => go('/devolucao/valor');
  });

  // ============================================================ Preencher dados (e0bab5c1)
  route('/devolucao/valor', async (root) => {
    if (!(await needAccount())) return;
    const m = current();
    if (!m) return go('/extrato');
    const r = state.refund;
    const p = m.payer || {};
    const opts = REASONS.map(([v, t]) => `<option value="${v}"${r.reason === v ? ' selected' : ''}>${esc(t)}</option>`).join('');
    root.innerHTML = frame(`${header()}
      <div class="scroll"><section class="intro" style="gap:16px"><h1 class="intro__title intro__title--bold">Devolver Pix</h1>
          <div class="dev-subject"><span class="dev-subject__label">para</span><span class="dev-subject__name">${esc(p.name || m.counterpart || '')}</span></div></section>
        <section class="body-sec">
          <div class="field"><label class="field-label" for="amt">Valor</label><div class="field-box"><span>R$</span><input id="amt" inputmode="numeric" autocomplete="off" placeholder="0,00"/></div>
            <p class="field-helper" id="amt-h">O valor deve ser igual ou menor que ${money(m.amount)}</p></div>
          <div class="field"><label class="field-label" for="why">Motivo da devolução</label><div class="field-box dev-select"><select id="why"><option value="">Selecione o motivo</option>${opts}</select><span class="dev-select__chev">${I.chevDown}</span></div></div>
          <div class="field"><label class="field-label" for="desc">Descrição da devolução (opcional)</label><div class="field-box dev-textarea"><textarea id="desc" maxlength="140" placeholder="Descreva brevemente o motivo...">${esc(r.description || '')}</textarea></div></div>
        </section></div>
      <footer class="footbar"><button class="btn btn-primary btn--lg" id="next" disabled>Continuar</button></footer>`,
    { studio: 'e0bab5c1 Devolução | Preencher dados (sem "Informações adicionais")' });
    $('#bk').onclick = () => go('/devolucao');
    const amt = $('#amt'), why = $('#why'), next = $('#next'), help = $('#amt-h');
    const check = () => {
      const n = parseMoney(amt.value) || 0;
      const over = n > m.amount + 0.001;
      help.style.color = over ? 'var(--danger)' : '';
      next.disabled = !(n > 0) || over || !why.value;
    };
    amt.oninput = () => { const n = Number(onlyDigits(amt.value) || 0) / 100; amt.value = n ? n.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''; check(); };
    amt.value = (r.amount || m.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    why.onchange = check;
    check();
    next.onclick = () => {
      Object.assign(state.refund, { amount: parseMoney(amt.value), reason: why.value, description: $('#desc').value.trim() });
      go('/devolucao/resumo');
    };
  });

  // ============================================================ Resumo da operação (860a1cf5)
  route('/devolucao/resumo', async (root) => {
    if (!(await needAccount())) return;
    const m = current(), r = state.refund;
    if (!m || !r.amount || !r.reason) return go('/devolucao');
    const p = m.payer || {};
    const name = p.name || m.counterpart || '';
    root.innerHTML = frame(`${header()}
      <div class="scroll"><section class="intro"><h1 class="intro__title intro__title--bold">Resumo da devolução</h1></section>
        <section class="body-sec">
          <div><div class="amount__label">Você está devolvendo</div><div class="amount__row"><span class="amount__value">${money(r.amount)}</span><button class="amount__edit" id="edit" aria-label="Alterar valor">${I.edit}</button></div></div>
          <div class="field-group" style="gap:8px"><span class="dev-group">Para</span>
            <div class="card"><div class="contact"><span class="avatar">${esc(L.initials(name))}</span><div class="contact__info"><span class="contact__name">${esc(name)}</span>
              <div class="contact__desc">${p.taxId ? `<span>${esc(docLabel(p.taxId))}</span>` : ''}${p.bank ? `<span>Instituição (ISPB) ${esc(p.bank)}</span>` : ''}
                ${p.branch || p.account ? `<span class="dev-pair"><span>Ag: ${esc(p.branch || '—')}</span><span>Conta: ${esc(p.account || '—')}</span></span>` : ''}</div></div></div></div></div>
          <div class="field-group" style="gap:8px"><span class="dev-group">Pagamento</span>
            <div class="card"><div class="row"><span class="row__icon row__icon--soft">${I.pix}</span><div class="row__info"><span class="row__caption">Forma de transferência</span><span class="row__label">Pix (devolução)</span></div></div>
              <span class="divider"></span>
              <div class="row"><span class="row__icon row__icon--soft">${I.coin}</span><div class="row__info"><span class="row__caption">Transferir com</span><span class="row__label">Saldo em conta</span></div></div>
              <span class="divider"></span>
              <div class="row"><span class="row__icon row__icon--soft">${I.chat}</span><div class="row__info"><span class="row__caption">Motivo</span><span class="row__label">${esc((REASONS.find((x) => x[0] === r.reason) || [])[1] || '')}</span></div></div>
              ${r.description ? `<span class="divider"></span><div class="row"><span class="row__icon row__icon--soft">${I.edit}</span><div class="row__info"><span class="row__caption">Descrição</span><span class="row__label row__label--regular">${esc(r.description)}</span></div></div>` : ''}</div></div>
        </section></div>
      <footer class="footbar"><button class="btn btn-primary btn--lg" id="go">Devolver valor</button></footer>`,
    { studio: '860a1cf5 Devolução | Resumo da operação (sem Favoritar, Pagar hoje e Escrever mensagem)' });
    $('#bk').onclick = () => go('/devolucao/valor');
    $('#edit').onclick = () => go('/devolucao/valor');
    $('#go').onclick = () => {
      const s = sheet(`<h2 class="sheet-title">Confirmar devolução</h2><p class="sheet-text">Digite sua senha de transferência para devolver ${money(r.amount)} para ${esc(name)}.</p>
        <div class="field"><div class="field-box"><input id="tp" type="password" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="••••"/></div><p class="field-error" id="tpe"></p></div>
        <div class="sheet-actions"><button class="btn btn-primary" data-ok disabled>Devolver valor</button><button class="btn btn-ghost" data-x>Voltar</button></div>`);
      const tp = $('#tp', s.el), ok = $('[data-ok]', s.el), tpe = $('#tpe', s.el);
      tp.oninput = () => { tp.value = onlyDigits(tp.value).slice(0, 4); ok.disabled = tp.value.length !== 4; };
      $('[data-x]', s.el).onclick = s.close;
      ok.onclick = async () => {
        setLoading(ok, true);
        try {
          const out = await api('/pix/refund', { method: 'POST', body: { endToEndId: m.endToEndId, date: day(m.date), amount: r.amount, reason: r.reason, description: r.description || undefined, txPassword: tp.value } });
          s.close();
          state.refundJustSent = String(out.id);
          go('/devolucao/resultado/' + out.id);
        } catch (e) { setLoading(ok, false); ok.disabled = false; tpe.textContent = e.message; tpe.classList.add('is-visible'); }
      };
    };
  });

  // ============================================================ Devolução concluída (98cdd103), com estado em processamento
  route_prefix('/devolucao/resultado/', async (root, id) => {
    if (!(await needAccount())) return;
    const WAIT = queryWaitSec(), MAX = 6;
    let tries = 0, last = null;
    const paint = (t) => {
      const st = t ? t.status : 'WAITING';
      const waiting = st === 'WAITING' || st === 'PROCESSING' || st === 'UNKNOWN';
      const stopped = waiting && tries >= MAX;
      if (st === 'CONFIRMED') {
        root.innerHTML = frame(`${header(CLOSE)}
          <div class="scroll"><section class="intro"><h1 class="intro__title intro__title--bold">Devolução concluída!</h1><p class="intro__desc">Você pode consultar mais detalhes nos relatórios da sua conta.</p></section>
            <section class="body-sec">
              <div class="card"><div><div class="dev-amount">${money(t.amount)}</div><div class="dev-to"><span class="dev-to__label">para</span><span class="dev-to__name">${esc(t.payer || '')}</span></div></div>
                <span class="divider"></span><span class="dev-time">Pedido em ${fmtDateTime(String(t.createdAt || '').replace(' ', 'T') + 'Z')}</span></div>
              <div class="card"><div class="dev-voucher"><span class="dev-voucher__icon">${RECEIPT}</span><span class="dev-voucher__title">Comprovante</span></div>
                <div class="dev-voucher__actions"><button class="btn btn-primary btn--inline" id="open">Abrir</button><button class="btn btn--inline dev-send" id="send">${SEND}Enviar</button></div></div>
              <div class="card"><span class="dev-time">ID da devolução - ${esc(t.returnId || '')}</span></div>
            </section></div>`, { studio: '98cdd103 Devolução | Devolução concluída' });
        const text = `Devolução de Pix · LoBank\nValor: ${money(t.amount)}\nPara: ${t.payer || ''}\nID da devolução: ${t.returnId || ''}\nPix original: ${t.endToEndId || ''}`;
        $('#bk').onclick = () => go('/home');
        $('#open').onclick = () => {
          const s = sheet(`<h2 class="sheet-title">Comprovante de devolução</h2><div class="receipt">
            <div class="receipt__row"><span>Valor devolvido</span><span>${money(t.amount)}</span></div>
            <div class="receipt__row"><span>Para</span><span>${esc(t.payer || '')}</span></div>
            <div class="receipt__row"><span>Motivo</span><span>${esc((REASONS.find((x) => x[0] === t.reason) || [])[1] || t.reason || '')}</span></div>
            <div class="receipt__row"><span>ID da devolução</span><span>${esc(t.returnId || '')}</span></div>
            <div class="receipt__row"><span>Pix original</span><span>${esc(t.endToEndId || '')}</span></div></div>
            <div class="sheet-actions"><button class="btn btn-primary" data-x>Fechar</button></div>`);
          $('[data-x]', s.el).onclick = s.close;
        };
        $('#send').onclick = () => copy(text);
        return;
      }
      const view = st === 'ERROR' ? { b: 'err', i: I.err, title: 'Devolução não concluída', desc: esc(t.errorMessage || 'A devolução foi recusada.') }
        : { b: 'wait', i: I.spinner, title: 'Devolução em processamento', desc: t ? `${money(t.amount)} para ${esc(t.payer || '')}` : 'Aguardando a confirmação da Celcoin.' };
      root.innerHTML = frame(`<div class="scroll"><div class="result" style="margin-top:96px"><span class="result__badge result__badge--${view.b}" style="width:72px;height:72px">${view.i}</span>
        <h1 class="result__title">${view.title}</h1><p class="result__desc">${view.desc}</p>
        ${waiting && !stopped ? '<p class="result__timer" id="timer" aria-live="polite"></p>' : ''}
        ${stopped ? '<p class="result__desc" style="font-size:13px">A Celcoin ainda não confirmou. Você pode consultar de novo ou sair: o resultado aparece no extrato.</p>' : ''}</div></div>
        <div class="actions">${stopped ? '<button class="btn btn-primary" id="again">Consultar de novo</button>' : ''}
          <button class="btn ${stopped ? 'btn-ghost' : 'btn-primary'}" id="home">Voltar ao início</button></div>`, { studio: 'novo:devolucao-processando (modelo 98cdd103, estados em processamento e erro)' });
      $('#home').onclick = () => go('/home');
      if ($('#again')) $('#again').onclick = () => { tries = 0; paint(last); };
      if (waiting && !stopped) countdown('#timer', WAIT, (n) => (n > 0 ? `Consultando a Celcoin em ${n} s` : 'Consultando…'), query);
    };
    const query = async () => {
      tries++;
      try { last = await api('/pix/reversals/' + encodeURIComponent(id)); }
      catch (e) { if (e.status === 401) return; toast(e.message); }
      paint(last);
    };
    if (state.refundJustSent === String(id)) { state.refundJustSent = null; paint(null); }
    else query();
  });

  // ============================================================ Encerrar conta (Minha conta)
  // Sem tela no Studio: a usuária decidiu que fica em Minha conta (11/11). Saldo precisa estar zerado.
  L.closeAccount = function closeAccount() {
    const s = sheet(`<h2 class="sheet-title">Encerrar minha conta?</h2>
      <p class="sheet-text">A conta é encerrada na Celcoin e não pode ser reaberta. Para encerrar, o saldo precisa estar zerado. Digite o motivo e sua senha de transferência para confirmar.</p>
      <div class="field"><div class="field-box"><input id="why" maxlength="200" placeholder="Motivo do encerramento"/></div></div>
      <div class="field"><div class="field-box"><input id="tp" type="password" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="••••"/></div><p class="field-error" id="tpe"></p></div>
      <div class="sheet-actions"><button class="btn btn-danger" data-ok disabled>Encerrar conta</button><button class="btn btn-ghost" data-x>Voltar</button></div>`);
    const why = $('#why', s.el), tp = $('#tp', s.el), ok = $('[data-ok]', s.el), tpe = $('#tpe', s.el);
    const check = () => { ok.disabled = tp.value.length !== 4 || why.value.trim().length < 3; };
    tp.oninput = () => { tp.value = onlyDigits(tp.value).slice(0, 4); check(); };
    why.oninput = check;
    $('[data-x]', s.el).onclick = s.close;
    ok.onclick = async () => {
      setLoading(ok, true);
      try {
        await api('/account', { method: 'DELETE', body: { reason: why.value.trim(), txPassword: tp.value } });
        s.close();
        await api('/auth/logout', { method: 'POST', allow401: true });
        state.me = null;
        go('/conta-encerrada');
      } catch (e) {
        setLoading(ok, false); check();
        tpe.textContent = e.data && e.data.error === 'BALANCE_NOT_ZERO' ? `Para encerrar, o saldo precisa estar zerado. Saldo atual: ${money(e.data.balance)}.` : e.message;
        tpe.classList.add('is-visible');
      }
    };
  };

  route('/conta-encerrada', (root) => {
    root.innerHTML = frame(`<div class="scroll"><div class="result" style="margin-top:96px"><span class="result__badge result__badge--ok" style="width:72px;height:72px">${I.ok}</span>
      <h1 class="result__title">Conta encerrada</h1><p class="result__desc">Sua conta foi encerrada na Celcoin. Obrigado por usar o LoBank.</p></div></div>
      <div class="actions"><button class="btn btn-primary" id="login">Ir para o login</button></div>`, { studio: 'novo:conta-encerrada (modelo de resultado)' });
    $('#login').onclick = () => go('/login');
  });
}());
