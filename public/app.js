/* LoBank — Fase 1 (PF). Telas montadas a partir dos conceitos do Studio.
   Cada tela indica em data-studio o conceito de origem (ou "novo" quando não veio do Studio). */
(function () {
  'use strict';

  // ------------------------------------------------------------ utilidades
  const $ = (sel, el) => (el || document).querySelector(sel);
  const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const onlyDigits = (v) => String(v || '').replace(/\D/g, '');
  const fmtCpf = (d) => { d = onlyDigits(d).slice(0, 11); return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2'); };
  const fmtCnpj = (d) => { d = onlyDigits(d).slice(0, 14); return d.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2'); };
  const fmtDoc = (d) => (onlyDigits(d).length > 11 ? fmtCnpj(d) : fmtCpf(d));
  const fmtPhone = (d) => { d = onlyDigits(d).slice(0, 11); return d.length > 10 ? d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3') : d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, ''); };
  const fmtCep = (d) => onlyDigits(d).slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');
  const maskDoc = (d) => { const s = onlyDigits(d); if (s.includes('*') || !s) return esc(d); return s.length === 11 ? `•••.${s.slice(3, 6)}.${s.slice(6, 9)}-••` : `••.${s.slice(2, 5)}.${s.slice(5, 8)}/${s.slice(8, 12)}-••`; };
  const initials = (n) => String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
  const parseMoney = (s) => { const n = Number(String(s).replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
  const fmtDateTime = (iso) => { const d = new Date(String(iso).replace(' ', 'T')); return isNaN(d) ? esc(iso) : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };

  function isValidCpf(d) {
    d = onlyDigits(d);
    if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
    const c = (len) => { let s = 0; for (let i = 0; i < len; i++) s += Number(d[i]) * (len + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
    return c(9) === Number(d[9]) && c(10) === Number(d[10]);
  }

  async function api(path, opts) {
    opts = opts || {};
    const res = await fetch('/api' + path, {
      method: opts.method || 'GET', credentials: 'same-origin',
      headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    let data = {};
    try { data = await res.json(); } catch (_) { /* vazio */ }
    if (res.status === 401 && !opts.allow401) { state.me = null; go('/login'); throw Object.assign(new Error(data.message || 'Sessão expirada'), { status: 401, data }); }
    if (!res.ok) throw Object.assign(new Error(data.message || 'Erro'), { status: res.status, data });
    return data;
  }

  // ------------------------------------------------------------ ícones (copiados dos SVGs do Studio)
  const I = {
    back: '<svg viewBox="0 0 22 22" fill="none" width="22" height="22"><path d="M7.17567 10.0827L18.3333 10.0827V11.9161L7.17567 11.9161L12.0927 16.8331L10.7965 18.1292L3.66667 10.9994L10.7965 3.86957L12.0927 5.16573L7.17567 10.0827Z" fill="currentColor"/></svg>',
    chevLeft: '<svg width="10.37" height="16.97" viewBox="0 0 10.3707 16.9707" fill="none"><path d="M3.77067 8.48533L10.3707 15.0853L8.48533 16.9707L0 8.48533L8.48533 0L10.3707 1.88533L3.77067 8.48533Z" fill="currentColor"/></svg>',
    chevRight: '<svg width="7.78" height="12.73" viewBox="0 0 7.778 12.728" fill="none"><path d="M4.95 6.364L0 1.414L1.414 0L7.778 6.364L1.414 12.728L0 11.314L4.95 6.364Z" fill="currentColor"/></svg>',
    chevDown: '<svg viewBox="0 0 24 24" fill="none"><path d="M12.0007 13.1707L16.9507 8.2207L18.3647 9.6347L12.0007 15.9987L5.63672 9.6347L7.05072 8.2207L12.0007 13.1707Z" fill="#808080"/></svg>',
    person: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 22C4 19.8783 4.84285 17.8434 6.34315 16.3431C7.84344 14.8429 9.87827 14 12 14C14.1217 14 16.1566 14.8429 17.6569 16.3431C19.1571 17.8434 20 19.8783 20 22H18C18 20.4087 17.3679 18.8826 16.2426 17.7574C15.1174 16.6321 13.5913 16 12 16C10.4087 16 8.88258 16.6321 7.75736 17.7574C6.63214 18.8826 6 20.4087 6 22H4ZM12 13C8.685 13 6 10.315 6 7C6 3.685 8.685 1 12 1C15.315 1 18 3.685 18 7C18 10.315 15.315 13 12 13ZM12 11C14.21 11 16 9.21 16 7C16 4.79 14.21 3 12 3C9.79 3 8 4.79 8 7C8 9.21 9.79 11 12 11Z"/></svg>',
    briefcase: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 10V12H8V10H16Z"/><path fill-rule="evenodd" clip-rule="evenodd" d="M17 2C17 1.448 16.552 1 16 1H8C7.448 1 7 1.448 7 2V5H3C2.448 5 2 5.448 2 6V20C2 20.552 2.448 21 3 21H21C21.552 21 22 20.552 22 20V6C22 5.448 21.552 5 21 5H17V2ZM4 7H20V19H4V7ZM9 3H15V5H9V3Z"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>',
    ok: '<svg viewBox="0 0 28 28" fill="none"><circle cx="14" cy="14" r="14" fill="#00CC7E"/><path fill-rule="evenodd" clip-rule="evenodd" d="M18.1673 9.62248C18.3527 9.43464 18.6011 9.3307 18.8589 9.33305C19.1167 9.3354 19.3634 9.44385 19.5457 9.63504C19.728 9.82624 19.8314 10.0849 19.8336 10.3553C19.8359 10.6256 19.7368 10.8861 19.5576 11.0806L12.6136 18.3632C12.5224 18.4591 12.4137 18.5355 12.2943 18.5875C12.1749 18.6395 12.0468 18.6663 11.9174 18.6663C11.6572 18.6663 11.4074 18.558 11.2231 18.3652L8.44298 15.4496C8.26387 15.2551 8.16479 14.9946 8.16703 14.7242C8.16927 14.4538 8.27268 14.1952 8.45499 14.004C8.6373 13.8128 8.88392 13.7043 9.14173 13.702C9.39955 13.6996 9.64793 13.8036 9.83338 13.9914L11.9174 16.1769L18.1673 9.62248Z" fill="#FDFDFD"/></svg>',
    err: '<svg viewBox="0 0 28 28" fill="none"><circle cx="14" cy="14" r="14" fill="#E63D3D"/><rect x="12.7" y="7.5" width="2.6" height="9" rx="1.3" fill="#FDFDFD"/><circle cx="14" cy="19.5" r="1.5" fill="#FDFDFD"/></svg>',
    spinner: '<svg viewBox="0 0 24 24" fill="none" role="status" aria-label="Carregando"><path opacity="0.15" d="M24 12C24 18.6274 18.6274 24 12 24C5.37258 24 0 18.6274 0 12C0 5.37258 5.37258 0 12 0C18.6274 0 24 5.37258 24 12ZM3.0206 12C3.0206 16.9592 7.04081 20.9794 12 20.9794C16.9592 20.9794 20.9794 16.9592 20.9794 12C20.9794 7.04081 16.9592 3.0206 12 3.0206C7.04081 3.0206 3.0206 7.04081 3.0206 12Z" fill="var(--studio-primary-color)"/><g class="spinner-arc"><path d="M6.33056 22.5763C3.91544 21.2816 2.01615 19.1994 0.948426 16.6758C-0.119297 14.1521 -0.291135 11.339 0.461478 8.70417L3.35915 9.53185C2.79554 11.505 2.92422 13.6116 3.72381 15.5015C4.52339 17.3914 5.94571 18.9507 7.75432 19.9202L6.33056 22.5763Z" fill="var(--studio-primary-color)"/></g></svg>',
    eye: '<svg width="22" height="22" viewBox="0 0 19.8348 16.5" fill="none"><path d="M9.91742 0C14.8601 0 18.9723 3.55667 19.8348 8.25C18.9732 12.9433 14.8601 16.5 9.91742 16.5C4.97475 16.5 0.862583 12.9433 0 8.25C0.861667 3.55667 4.97475 0 9.91742 0ZM9.91742 14.6667C11.7869 14.6663 13.6009 14.0313 15.0625 12.8656C16.5241 11.6999 17.5467 10.0726 17.963 8.25C17.5452 6.42886 16.5219 4.80334 15.0605 3.63919C13.599 2.47504 11.7859 1.84115 9.91742 1.84115C8.04897 1.84115 6.2358 2.47504 4.77435 3.63919C3.31289 4.80334 2.28962 6.42886 1.87183 8.25C2.28809 10.0726 3.3107 11.6999 4.7723 12.8656C6.2339 14.0313 8.0479 14.6663 9.91742 14.6667ZM9.91742 12.375C8.8234 12.375 7.77419 11.9404 7.0006 11.1668C6.22701 10.3932 5.79242 9.34402 5.79242 8.25C5.79242 7.15598 6.22701 6.10677 7.0006 5.33318C7.77419 4.5596 8.8234 4.125 9.91742 4.125C11.0114 4.125 12.0606 4.5596 12.8342 5.33318C13.6078 6.10677 14.0424 7.15598 14.0424 8.25C14.0424 9.34402 13.6078 10.3932 12.8342 11.1668C12.0606 11.9404 11.0114 12.375 9.91742 12.375Z" fill="#fff"/></svg>',
    help: '<svg width="22" height="22" viewBox="0 0 21.5 21.5" fill="none"><circle cx="10.75" cy="10.75" r="10" stroke="#fff" stroke-width="1.5"/><path d="M8.75 7.75C8.75 6.64543 9.64543 5.75 10.75 5.75C11.8546 5.75 12.75 6.64543 12.75 7.75C12.75 8.14815 12.6337 8.51913 12.4331 8.83079C11.8354 9.75967 10.75 10.6454 10.75 11.75V12.25" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/><path d="M10.742 15.75H10.751" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>',
    caret: '<svg width="16" height="16" viewBox="0 0 8.48533 5.18533" fill="none"><path d="M4.24267 3.3L7.54267 0L8.48533 0.942666L4.24267 5.18533L0 0.942666L0.942667 0L4.24267 3.3Z" fill="#fff"/></svg>',
    trash: '<svg width="18" height="20" viewBox="0 0 18 20" fill="none"><path d="M5 1h8M1 4h16M3 4l1 14a1.5 1.5 0 0 0 1.5 1.4h7A1.5 1.5 0 0 0 14 18l1-14M7 8v8M11 8v8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    copy: '<svg width="18.75" height="20.83" viewBox="0 0 18.75 20.8334" fill="none"><path d="M4.16667 4.16667V1.04167C4.16667 0.466 4.633 0 5.20833 0H17.7083C18.2837 0 18.75 0.466 18.75 1.04167V15.625C18.75 16.2003 18.2837 16.6667 17.7083 16.6667H14.5833V19.7917C14.5833 20.3667 14.1146 20.8333 13.5344 20.8333H1.04896C0.469 20.8333 0 20.367 0 19.7917L0.003125 5.20833C0.003125 4.63333 0.471875 4.16667 1.05208 4.16667H4.16667ZM2.08646 6.25L2.08333 18.75H12.5V6.25H2.08646ZM6.25 4.16667H14.5833V14.5833H16.6667V2.08333H6.25V4.16667Z" fill="currentColor"/></svg>',
    key: '<svg width="18.09" height="17.01" viewBox="0 0 18.0881 17.0147" fill="none"><path d="M7.76512 7.849L15.6141 0L17.0281 1.414L15.6141 2.829L18.0881 5.303L16.6741 6.718L14.1991 4.243L12.7851 5.657L14.9061 7.778L13.4921 9.193L11.3711 7.071L9.17912 9.263C9.85957 10.297 10.1325 11.5466 9.94503 12.7701C9.7576 13.9937 9.12316 15.1042 8.16439 15.8871C7.20561 16.67 5.9906 17.0696 4.75429 17.0086C3.51799 16.9477 2.3482 16.4304 1.47112 15.557C0.592147 14.6813 0.0701463 13.5101 0.00657268 12.271C-0.057001 11.0319 0.342393 9.81345 1.12713 8.85242C1.91187 7.89138 3.02589 7.25644 4.25268 7.071C5.47947 6.88555 6.73139 7.16285 7.76512 7.849ZM7.12812 14.142C7.41943 13.8665 7.65255 13.5353 7.8137 13.1681C7.97484 12.8009 8.06074 12.4052 8.06632 12.0042C8.07189 11.6033 7.99703 11.2053 7.84616 10.8338C7.69529 10.4622 7.47147 10.1247 7.18793 9.84119C6.90439 9.55765 6.56688 9.33383 6.19536 9.18296C5.82384 9.03209 5.42584 8.95723 5.02489 8.9628C4.62394 8.96838 4.22818 9.05428 3.861 9.21542C3.49382 9.37656 3.16267 9.60968 2.88712 9.901C2.34064 10.4668 2.03826 11.2246 2.0451 12.0112C2.05193 12.7978 2.36744 13.5502 2.92366 14.1065C3.47989 14.6627 4.23232 14.9782 5.01891 14.985C5.80551 14.9919 6.56331 14.6895 7.12912 14.143L7.12812 14.142Z" fill="currentColor"/></svg>',
    pix: '<svg width="24" height="24" viewBox="0 0 19.9986 20.4969" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M19.1112 7.85616C20.0298 8.77476 20.2355 10.1368 19.7271 11.2539H17.311L17.7667 10.7982C18.2091 10.3567 18.2091 9.64103 17.7677 9.19966L16.0532 7.48521H15.5851C15.5647 7.48521 15.5431 7.48959 15.5248 7.49719C15.5098 7.50337 15.5029 7.50939 15.5029 7.50939L15.4796 7.53306L13.0115 10.0002L14.2652 11.2539H11.5782L11.1394 10.8151C11.0226 10.6981 10.8868 10.6063 10.7402 10.5397C10.5479 10.4523 10.337 10.4082 10.1259 10.4074C9.91049 10.4065 9.69488 10.4506 9.49862 10.5397C9.35468 10.605 9.22113 10.6946 9.10571 10.8083L9.09889 10.8151L6.09184 13.8222C5.9541 13.9648 5.79493 14.0844 5.6216 14.1785C5.42014 14.2879 5.19956 14.3629 4.97131 14.3998C4.86724 14.4167 4.76157 14.4256 4.65539 14.4262L4.64314 14.4262H3.35105C3.29064 14.4262 3.24253 14.4374 3.19443 14.462L0.887683 12.1553C-0.295894 10.9717 -0.295894 9.03974 0.887683 7.85616L3.20673 5.53711C3.25484 5.5606 3.30294 5.57291 3.36335 5.57291H4.65544C4.75092 5.57291 4.8464 5.57995 4.94104 5.59374C5.17193 5.6274 5.39781 5.70124 5.60641 5.81103C5.78581 5.90545 5.95244 6.02646 6.09849 6.17136L6.10415 6.177L9.1112 9.18405C9.22997 9.30282 9.36433 9.3974 9.50855 9.46673C9.70123 9.55935 9.91153 9.60692 10.1259 9.60692C10.3353 9.60692 10.5488 9.55837 10.7453 9.46388C10.8882 9.39511 11.0222 9.30202 11.139 9.18558L14.1364 6.18931L14.1407 6.18484L14.142 6.18355C14.2435 6.07923 14.3566 5.98739 14.4783 5.90896C14.6365 5.80698 14.8093 5.72767 14.9903 5.67307C15.1819 5.61531 15.3826 5.58521 15.5851 5.58521H16.6355C16.6959 5.58521 16.7563 5.57403 16.8045 5.54942L19.1112 7.85616ZM3.95794 7.47291H4.65544C4.66259 7.47291 4.68118 7.47478 4.70568 7.48495C4.72988 7.495 4.74868 7.50854 4.76065 7.52051L7.23357 9.99342L4.74834 12.4787L4.72534 12.5021C4.72534 12.5021 4.71865 12.508 4.70344 12.5143C4.68512 12.5219 4.66356 12.5262 4.64314 12.5262H3.94564L2.23119 10.8118C1.7896 10.3702 1.7896 9.64124 2.23119 9.19966L3.95794 7.47291Z" fill="currentColor"/><path d="M10.5252 11.4425L11 11.9173V14.6043L10.1325 13.7368L8.0763 15.793C7.93474 15.9346 7.78587 16.0662 7.63059 16.1875L9.21178 17.7687C9.65336 18.2103 10.3823 18.2103 10.8239 17.7687L11 17.5926V19.8384C9.93744 20.1985 8.71248 19.9564 7.86827 19.1122L4.0636 15.3076H4.65539C5.23874 15.3076 5.79494 15.1409 6.27033 14.8273C6.4323 14.7204 6.5849 14.5965 6.72599 14.4563L6.7328 14.4495L9.73985 11.4425C9.84119 11.3411 9.98321 11.2897 10.1259 11.2881C10.2695 11.2866 10.4145 11.3363 10.5185 11.436L10.5252 11.4425Z" fill="currentColor"/><path fill-rule="evenodd" clip-rule="evenodd" d="M4.03906 4.69124H4.64316L4.65544 4.69127C5.23141 4.69358 5.78051 4.85844 6.25098 5.16684C6.41822 5.27647 6.57552 5.40423 6.72057 5.54928L9.72762 8.55633L9.73331 8.56194C9.84261 8.66821 9.98439 8.72059 10.1259 8.71906C10.2658 8.71756 10.4053 8.66334 10.5129 8.55641L13.52 5.56158C13.6233 5.4583 13.7328 5.36378 13.8476 5.27834C14.3479 4.90621 14.9502 4.70613 15.5851 4.70357L15.5974 4.70355H15.9599L12.144 0.887683C10.9604 -0.295894 9.02843 -0.295894 7.84486 0.887683L4.03906 4.69124ZM7.61219 3.80643L9.18796 2.23158C9.62955 1.79 10.3589 1.7896 10.8005 2.23119L12.4954 3.92611C12.386 4.01772 12.28 4.11462 12.1779 4.21671L12.1765 4.21808L10.1222 6.26393L8.06407 4.20578C7.92063 4.06233 7.76969 3.92911 7.61219 3.80643Z" fill="currentColor"/><path d="M15.5858 15.2543L13.7574 13.4259L15.1716 12.0117L19.4142 16.2543L15.1716 20.4969L13.7574 19.0827L15.5858 17.2543H12V15.2543H15.5858Z" fill="currentColor"/></svg>',
    receive: '<svg width="19" height="21" viewBox="0 0 19 21" fill="none"><path d="M10 13.252V15.3414C9.3744 15.1203 8.7013 15 8 15C4.68629 15 2 17.6863 2 21H0C0 16.5817 3.58172 13 8 13C8.6906 13 9.3608 13.0875 10 13.252ZM8 12C4.685 12 2 9.315 2 6C2 2.685 4.685 0 8 0C11.315 0 14 2.685 14 6C14 9.315 11.315 12 8 12ZM8 10C10.21 10 12 8.21 12 6C12 3.79 10.21 2 8 2C5.79 2 4 3.79 4 6C4 8.21 5.79 10 8 10Z" fill="currentColor"/><path d="M17.0556 18H12.7778V19.5H14.7222V21H16.2778V19.5H17.0556C18.1294 19.5 19 18.6605 19 17.625C19 16.5895 18.1294 15.75 17.0556 15.75H13.9445C13.7297 15.75 13.5556 15.5821 13.5556 15.375C13.5556 15.1679 13.7297 15 13.9445 15H18.2222V13.5H16.2778V12H14.7222V13.5H13.9445C12.8706 13.5 12 14.3395 12 15.375C12 16.4105 12.8706 17.25 13.9445 17.25H17.0556C17.2703 17.25 17.4444 17.4179 17.4444 17.625C17.4444 17.8321 17.2703 18 17.0556 18Z" fill="currentColor"/></svg>',
    list: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 5h16v2H4V5Zm0 6h16v2H4v-2Zm0 6h10v2H4v-2Z" fill="currentColor"/></svg>',
    calendar: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M7 0V2H13V0H15V2H19C19.5523 2 20 2.44772 20 3V19C20 19.5523 19.5523 20 19 20H1C0.44772 20 0 19.5523 0 19V3C0 2.44772 0.44772 2 1 2H5V0H7ZM18 10H2V18H18V10ZM9 12V16H4V12H9ZM5 4H2V8H18V4H15V6H13V4H7V6H5V4Z" fill="currentColor"/></svg>',
    chat: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5.29101 18.824L0 20L1.17601 14.709C0.401543 13.2604 -0.00246185 11.6426 0 10C0 4.477 4.47701 0 10 0C15.523 0 20 4.477 20 10C20 15.523 15.523 20 10 20C8.35737 20.0025 6.73963 19.5985 5.29101 18.824ZM5.58101 16.711L6.23401 17.061C7.39256 17.6801 8.6864 18.0027 10 18C14.418 18 18 14.418 18 10C18 5.582 14.418 2 10 2C5.582 2 2 5.582 2 10C2 11.334 2.32501 12.618 2.94001 13.766L3.28901 14.419L2.63401 17.366L5.58101 16.711Z" fill="currentColor"/></svg>',
    coin: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 20C4.477 20 0 15.523 0 10C0 4.477 4.477 0 10 0C15.523 0 20 4.477 20 10C20 15.523 15.523 20 10 20ZM10 18C14.418 18 18 14.418 18 10C18 5.582 14.418 2 10 2C5.582 2 2 5.582 2 10C2 14.418 5.582 18 10 18ZM6.5 12H12C12.2761 12 12.5 11.7761 12.5 11.5C12.5 11.2239 12.2761 11 12 11H8C6.61929 11 5.5 9.88071 5.5 8.5C5.5 7.11929 6.61929 6 8 6H9V4H11V6H13.5V8H8C7.72386 8 7.5 8.22386 7.5 8.5C7.5 8.77614 7.72386 9 8 9H12C13.3807 9 14.5 10.1193 14.5 11.5C14.5 12.8807 13.3807 14 12 14H11V16H9V14H6.5V12Z" fill="currentColor"/></svg>',
    edit: '<svg width="24" height="24" viewBox="0 0 23.9611 23.9611" fill="none"><path d="M16.9707 8.87572L15.0853 6.99038L2.66667 19.4091V21.2944H4.552L16.9707 8.87572ZM18.856 6.99038L20.7413 5.10505L18.856 3.21972L16.9707 5.10505L18.856 6.99038ZM5.656 23.9611H0V18.3037L17.9133 0.390382C18.4339 -0.130127 19.2781 -0.130127 19.7987 0.390382L23.5707 4.16238C24.0912 4.68289 24.0912 5.52721 23.5707 6.04772L5.65733 23.9611H5.656Z" fill="currentColor"/></svg>',
    qr: '<svg width="20" height="20" viewBox="0 0 18 18" fill="none"><path d="M13 14V13H10V10H13V12H15V14H14V16H12V18H10V15H12V14H13ZM18 18H14V16H16V14H18V18ZM0 0H8V8H0V0ZM2 2V6H6V2H2ZM10 0H18V8H10V0ZM12 2V6H16V2H12ZM0 10H8V18H0V10ZM2 12V16H6V12H2ZM15 10H18V12H15V10ZM3 3H5V5H3V3ZM3 13H5V15H3V13ZM13 3H15V5H13V3Z" fill="currentColor"/></svg>',
  };

  // ------------------------------------------------------------ estado
  const state = { me: null, mode: 'sandbox', hideBalance: false, onboarding: null, pix: null, receive: null };
  const timers = new Set();
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
  const clearTimers = () => { timers.forEach(clearTimeout); timers.clear(); };

  // ------------------------------------------------------------ roteador
  const routes = {};
  const prefixRoutes = [];
  const route = (path, fn) => { routes[path] = fn; };
  const route_prefix = (prefix, fn) => { prefixRoutes.push({ prefix, fn }); };
  function go(path) { if (location.hash !== '#' + path) location.hash = path; else render(); }
  function back() { history.length > 1 ? history.back() : go('/home'); }

  async function render() {
    clearTimers();
    const path = location.hash.replace(/^#/, '') || '/';
    const root = $('#root');
    let fn = routes[path];
    if (!fn) {
      const pr = prefixRoutes.find((r) => path.startsWith(r.prefix) && path.length > r.prefix.length);
      fn = pr ? (el) => pr.fn(el, decodeURIComponent(path.slice(pr.prefix.length))) : routes['/'];
    }
    try { await fn(root); } catch (e) { if (e.status !== 401) showFatal(root, e); }
  }

  function frame(inner, opts) {
    opts = opts || {};
    return `<main class="app${state.mode === 'mock' ? ' is-mock' : ''}" data-studio="${esc(opts.studio || 'novo')}">${state.mode === 'mock' ? '<div class="mock-banner">MODO SIMULADO — nada aqui fala com a Celcoin</div>' : ''}${inner}</main>`;
  }

  function showFatal(root, e) {
    root.innerHTML = frame(`<div class="result" style="margin-top:120px"><span class="result__badge result__badge--err">${I.err}</span>
      <h1 class="result__title">Não foi possível carregar</h1><p class="result__desc">${esc(e.message)}</p></div>
      <div class="actions"><button class="btn btn-primary" id="retry">Tentar de novo</button><button class="btn btn-ghost" id="home">Ir para o início</button></div>`);
    $('#retry').onclick = render;
    $('#home').onclick = () => go(state.me ? '/home' : '/login');
  }

  function toast(msg) {
    const app = $('.app');
    if (!app) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    app.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  // Folha inferior: retorna { close, el }
  function sheet(html) {
    const app = $('.app');
    const wrap = document.createElement('div');
    wrap.innerHTML = `<div class="backdrop-dim"></div><section class="sheet" role="dialog" aria-modal="true"><div class="dragger-wrap"><div class="dragger"></div></div>${html}</section>`;
    app.appendChild(wrap);
    const close = () => wrap.remove();
    $('.backdrop-dim', wrap).onclick = close;
    return { close, el: wrap };
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast('Copiado!'); }
    catch (_) { toast('Não foi possível copiar automaticamente.'); }
  }

  async function loadMe() {
    try { state.me = await api('/me', { allow401: true }); } catch (_) { state.me = null; }
    return state.me;
  }

  function setLoading(btn, on) { if (btn) { btn.classList.toggle('is-loading', on); btn.disabled = on; } }

  // ============================================================ LOGIN (novo: não há tela de login no Studio)
  route('/login', (root) => {
    root.innerHTML = frame(`
      <div class="lockup">${LOGO('#7664FA', 104)}</div>
      <div class="content">
        <h1 class="headline">Acesse sua <strong>conta</strong></h1>
        <div class="field-group">
          <div class="field"><span class="field-label">CPF ou CNPJ</span>
            <div class="field-box"><input id="doc" inputmode="numeric" autocomplete="username" placeholder="000.000.000-00" maxlength="18" /></div></div>
          <div class="field"><span class="field-label">Senha</span>
            <div class="field-box"><input id="pwd" type="password" autocomplete="current-password" placeholder="Sua senha" /></div>
            <p class="field-error" id="err"></p></div>
        </div>
      </div>
      <div class="actions">
        <button class="btn btn-primary" id="enter" disabled>Entrar</button>
        <button class="btn btn-ghost" id="create">Criar conta</button>
      </div>
      <p class="studio-note">Tela criada para o app: não existe no Studio.</p>`, { studio: 'novo:login' });
    const doc = $('#doc'), pwd = $('#pwd'), enter = $('#enter'), err = $('#err');
    const check = () => { const d = onlyDigits(doc.value); enter.disabled = !((d.length === 11 || d.length === 14) && pwd.value); };
    doc.oninput = () => { doc.value = fmtDoc(doc.value); check(); };
    pwd.oninput = check;
    pwd.onkeydown = (e) => { if (e.key === 'Enter' && !enter.disabled) enter.click(); };
    enter.onclick = async () => {
      err.classList.remove('is-visible');
      setLoading(enter, true);
      try {
        await api('/auth/login', { method: 'POST', body: { document: doc.value, password: pwd.value }, allow401: true });
        await loadMe();
        go(state.me && state.me.account ? '/home' : '/validacao');
      } catch (e) { err.textContent = e.message; err.classList.add('is-visible'); }
      finally { setLoading(enter, false); check(); }
    };
    $('#create').onclick = () => go('/cadastro');
  });

  // ============================================================ CADASTRO PF
  // Studio: board "Onboarding - PF". Telas retiradas por decisão: Splash, Onboarding v.1-4, Telefone|Autenticação (SMS).
  const TOTAL = 10;
  function wizardFrame(step, inner, actions, studio) {
    return frame(`
      <header class="topbar">
        <button type="button" class="back-btn" aria-label="Voltar" data-back>${I.back}</button>
        <div class="crumb"><div class="crumb-row"><span class="crumb-title">Cadastro de Conta Pessoal</span><span class="crumb-step">${step}/${TOTAL}</span></div>
          <div class="progress-track"><div class="progress-fill" style="width:${step * 10}%"></div></div></div>
      </header>
      <div class="content">${inner}</div>
      <div class="actions">${actions || '<button type="button" class="btn btn-primary" data-next disabled>Avançar</button><button type="button" class="btn btn-ghost" data-back>Voltar</button>'}</div>`, { studio });
  }
  function wire(root, onNext) {
    $$('[data-back]', root).forEach((b) => { b.onclick = back; });
    const next = $('[data-next]', root);
    if (next && onNext) next.onclick = onNext;
    return next;
  }
  const ob = () => (state.onboarding = state.onboarding || { address: {} });

  // Studio: "Mobile | Criação de Contas | PF | Cadastro | Tipo de conta"
  route('/cadastro', (root) => {
    root.innerHTML = frame(`
      <div class="lockup">${LOGO('#7664FA', 104)}</div>
      <div class="content">
        <h1 class="headline headline--600">Escolha qual tipo de conta você deseja criar</h1>
        <p class="subtext">Escolha o tipo de conta para começar a ter acesso todas vantagens, leva só uns minutinhos.</p>
        <div class="options">
          <button type="button" class="option is-selected" data-v="PF"><span class="option-avatar">${I.person}</span><span class="option-label">Conta pessoal</span><span class="option-radio"></span></button>
          <button type="button" class="option" data-v="PJ"><span class="option-avatar">${I.briefcase}</span><span class="option-label">Conta empresarial<span class="option-sub">Disponível na próxima fase</span></span><span class="option-radio"></span></button>
        </div>
      </div>
      <div class="actions"><button type="button" class="btn btn-primary" id="go">Criar conta</button><button type="button" class="btn btn-ghost" id="bk">Voltar</button></div>`, { studio: 'b5afc529 Tipo de conta' });
    let sel = 'PF';
    $$('.option').forEach((o) => { o.onclick = () => { $$('.option').forEach((x) => x.classList.remove('is-selected')); o.classList.add('is-selected'); sel = o.dataset.v; }; });
    $('#go').onclick = () => {
      if (sel === 'PJ') return toast('A conta empresarial entra na Fase 2 do app.');
      state.onboarding = { address: {} };
      go('/cadastro/termos');
    };
    $('#bk').onclick = () => go('/login');
  });

  // Studio: "Mobile | Criação de Contas | PF | Cadastro | Termos de uso" (opcional). Conteúdo: texto do app, não um contrato real.
  route('/cadastro/termos', (root) => {
    root.innerHTML = frame(`
      <header class="topbar"><button class="back-btn" data-back aria-label="Voltar">${I.back}</button><div class="crumb"><div class="crumb-row"><span class="crumb-title">Cadastro de Conta Pessoal</span></div></div></header>
      <div class="content">
        <h1 class="headline">Antes de começar, <strong>leia os termos</strong></h1>
        <div class="note-box"><ul>
          <li>Esta é uma conta de <strong>teste</strong> no ambiente sandbox da Celcoin. Nenhum dinheiro real é movimentado.</li>
          <li>Seus dados serão enviados à Celcoin para abertura da conta e validação de identidade (documento e selfie).</li>
          <li>Os termos jurídicos definitivos do LoBank ainda não foram redigidos.</li>
        </ul></div>
        <button type="button" class="option" id="acc"><span class="option-label">Li e aceito os termos de uso e a política de privacidade</span><span class="option-radio"></span></button>
      </div>
      <div class="actions"><button class="btn btn-primary" data-next disabled>Aceitar e continuar</button></div>`, { studio: '29b9c98a Termos de uso (conteúdo do app)' });
    const next = wire(root, () => { ob().termsAccepted = true; go('/cadastro/cpf'); });
    $('#acc').onclick = (e) => { e.currentTarget.classList.toggle('is-selected'); next.disabled = !e.currentTarget.classList.contains('is-selected'); };
  });

  // Studio: "PF | Cadastro | CPF | Empty" (estados vazio, verificando, sucesso e erro no mesmo campo)
  route('/cadastro/cpf', (root) => {
    if (!ob().termsAccepted) return go('/cadastro');
    root.innerHTML = wizardFrame(1, `
      <h1 class="headline"><strong>Digite seu CPF</strong> para começar</h1>
      <div class="field-group"><div class="field">
        <div class="field-box"><input id="cpf" inputmode="numeric" autocomplete="off" placeholder="000.000.000-00" maxlength="14" value="${esc(fmtCpf(ob().cpf || ''))}"/><span class="icon-r" id="ic"></span></div>
        <p class="field-error" id="er">CPF inválido. Confira os números.</p></div>
        <button type="button" class="link-inline" id="why">${I.shield} Porque informar o CPF?</button></div>`, null, '8c68c085 CPF');
    const input = $('#cpf'), ic = $('#ic'), er = $('#er');
    const next = wire(root, () => { ob().cpf = onlyDigits(input.value); go('/cadastro/nome'); });
    const evaluate = () => {
      const d = onlyDigits(input.value);
      er.classList.remove('is-visible'); ic.classList.remove('is-visible'); next.disabled = true;
      if (d.length !== 11) return;
      ic.classList.add('is-visible');
      if (isValidCpf(d)) { ic.innerHTML = I.ok; next.disabled = false; } else { ic.innerHTML = I.err; er.classList.add('is-visible'); }
    };
    input.oninput = () => { input.value = fmtCpf(input.value); evaluate(); };
    evaluate();
    $('#why').onclick = () => {
      const s = sheet(`<h2 class="sheet-title">Porque o CPF?</h2>
        <p class="sheet-text">O CPF é necessário para validar o seu perfil, evitar cadastros duplicados e preservar sua privacidade.</p>
        <p class="sheet-text">Dessa forma garantimos a qualidade de todo o serviço oferecido pelo nosso aplicativo e site.</p>
        <div class="info-box" style="margin-top:16px"><span class="info-box-bar"></span><span class="info-box-text">Seus dados pessoais estão seguros na Celcoin e nunca serão compartilhados.</span></div>
        <div class="sheet-actions"><button class="btn btn-primary" data-x>Entendido</button></div>`);
      $('[data-x]', s.el).onclick = s.close;
    };
  });

  // Telas de um campo de texto: Nome Completo, Nome Social, Nome da mãe, Profissão, E-mail, Telefone
  function textStep(o) {
    route(o.path, (root) => {
      if (!ob().cpf) return go('/cadastro');
      root.innerHTML = wizardFrame(o.step, `<h1 class="headline">${o.title}</h1>
        <div class="field-group"><div class="field">${o.label ? `<span class="field-label">${o.label}</span>` : ''}
          <div class="field-box"><input id="f" ${o.attrs || ''} placeholder="${esc(o.placeholder)}" value="${esc(o.format ? o.format(ob()[o.key] || '') : ob()[o.key] || '')}"/></div>
          ${o.helper ? `<p class="field-helper">${o.helper}</p>` : ''}<p class="field-error" id="er"></p></div>${o.extra || ''}</div>`, null, o.studio);
      const f = $('#f'), er = $('#er');
      const next = wire(root, () => { ob()[o.key] = o.store ? o.store(f.value) : f.value.trim(); go(o.next(ob())); });
      const check = () => { const msg = o.validate(f.value); next.disabled = !!msg; er.textContent = msg && f.value ? msg : ''; er.classList.toggle('is-visible', !!(msg && f.value && o.showError !== false)); };
      f.oninput = () => { if (o.format) f.value = o.format(f.value); check(); };
      check();
      if (o.after) o.after(root);
    });
  }

  textStep({ path: '/cadastro/nome', step: 2, key: 'fullName', title: 'Qual o seu <strong>nome completo</strong>?', placeholder: 'Nome e sobrenome', attrs: 'autocomplete="name" maxlength="120"',
    studio: '4ce68921 Nome Completo (modelo comum)', validate: (v) => (v.trim().split(/\s+/).length >= 2 ? '' : 'Informe nome e sobrenome.'), showError: false,
    extra: '<button type="button" class="link-inline" id="social">Quero usar meu nome social</button>',
    after: () => { $('#social').onclick = () => { ob().fullName = $('#f').value.trim(); go('/cadastro/nome-social'); }; },
    next: () => '/cadastro/nascimento' });
  textStep({ path: '/cadastro/nome-social', step: 2, key: 'socialName', title: 'Como você <strong>prefere ser chamado</strong>?', label: 'Nome social', placeholder: 'Seu nome social', attrs: 'maxlength="60"',
    studio: '9ce47319 Nome Social (modelo comum)', validate: (v) => (v.trim().length >= 2 ? '' : 'Informe o nome social.'), showError: false, next: () => '/cadastro/nascimento' });

  // Studio: "PF | Cadastro | Data de Nascimento". A API pede DD-MM-YYYY; o app envia ISO ao servidor, que converte.
  route('/cadastro/nascimento', (root) => {
    if (!ob().cpf) return go('/cadastro');
    root.innerHTML = wizardFrame(3, `<h1 class="headline">Qual a sua <strong>data de nascimento</strong>?</h1>
      <div class="field-group"><div class="field"><div class="field-box"><input id="f" inputmode="numeric" placeholder="DD/MM/AAAA" maxlength="10" value="${esc(ob().birthBr || '')}"/></div>
      <p class="field-error" id="er"></p></div></div>`, null, 'e4896803 Data de Nascimento (modelo comum)');
    const f = $('#f'), er = $('#er');
    const parse = (v) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v); if (!m) return null; const d = new Date(`${m[3]}-${m[2]}-${m[1]}T12:00:00`); return d.getDate() === Number(m[1]) && d.getMonth() + 1 === Number(m[2]) ? `${m[3]}-${m[2]}-${m[1]}` : null; };
    const next = wire(root, () => { ob().birthBr = f.value; ob().birthDate = parse(f.value); go('/cadastro/mae'); });
    const check = () => {
      const iso = parse(f.value); let msg = '';
      if (f.value.length === 10) {
        if (!iso) msg = 'Data inválida.';
        else { const age = (Date.now() - new Date(iso)) / (365.25 * 864e5); if (age < 18) msg = 'É preciso ter 18 anos ou mais.'; else if (age > 120) msg = 'Data inválida.'; }
      }
      er.textContent = msg; er.classList.toggle('is-visible', !!msg); next.disabled = !iso || !!msg;
    };
    f.oninput = () => { let d = onlyDigits(f.value).slice(0, 8); f.value = d.replace(/(\d{2})(\d)/, '$1/$2').replace(/(\d{2})\/(\d{2})(\d)/, '$1/$2/$3'); check(); };
    check();
  });

  textStep({ path: '/cadastro/mae', step: 4, key: 'motherName', title: 'Qual o <strong>nome da sua mãe</strong>?', placeholder: 'Nome completo da mãe', attrs: 'maxlength="120"',
    studio: '32f1dda4 Nome da mãe (modelo comum)', validate: (v) => (v.trim().length >= 3 ? '' : 'Informe o nome.'), showError: false, next: () => '/cadastro/financeiro' });

  // Studio: "PF | Cadastro | Informações Financeiras" (lido por completo). Guardado só no app: a proposta PF da Celcoin não tem esses campos.
  route('/cadastro/financeiro', (root) => {
    if (!ob().cpf) return go('/cadastro');
    const sel = (id, label, helper) => `<div class="field"><span class="field-label">${label}</span>
      <button type="button" class="select-box ${ob()[id] ? 'has-value' : ''}" id="${id}"><span class="select-value">${esc(ob()[id] || 'Selecione')}</span>${I.chevDown}</button>
      <p class="field-helper">${helper}</p></div>`;
    root.innerHTML = wizardFrame(5, `<h1 class="headline">Informações <strong>financeiras</strong></h1>
      <div class="field-group" style="gap:24px">${sel('income', 'Renda mensal', 'Considere salário, benefícios e outras fontes de renda')}${sel('assets', 'Patrimônio', 'Some seus bens, imóveis e investimentos')}</div>`, null, '6c59f729 Informações Financeiras');
    const next = wire(root, () => go('/cadastro/profissao'));
    const opts = {
      income: ['Até R$ 5.000', 'R$ 5.001 – R$ 10.000', 'R$ 10.001 – R$ 30.000', 'R$ 30.001 – R$ 100.000', 'Acima de R$ 100.000'],
      assets: ['Até R$ 50.000', 'R$ 50.001 – R$ 200.000', 'R$ 200.001 – R$ 1.000.000', 'R$ 1.000.001 – R$ 5.000.000', 'Acima de R$ 5.000.000'],
    };
    const check = () => { next.disabled = !(ob().income && ob().assets); };
    ['income', 'assets'].forEach((id) => {
      $('#' + id).onclick = () => {
        let picked = ob()[id];
        const s = sheet(`<h2 class="sheet-title">${id === 'income' ? 'Renda mensal' : 'Patrimônio'}</h2><div class="option-list">${opts[id].map((o) => `<button type="button" class="option-row ${o === picked ? 'is-selected' : ''}" data-o="${esc(o)}"><span class="option-row-label">${esc(o)}</span><span class="option-row-radio"></span></button>`).join('')}</div>
          <div class="sheet-actions"><button class="btn btn-primary" data-ok>Selecionar</button><button class="btn btn-ghost" data-x>Voltar</button></div>`);
        $$('.option-row', s.el).forEach((r) => { r.onclick = () => { $$('.option-row', s.el).forEach((x) => x.classList.remove('is-selected')); r.classList.add('is-selected'); picked = r.dataset.o; }; });
        $('[data-x]', s.el).onclick = s.close;
        $('[data-ok]', s.el).onclick = () => { if (picked) { ob()[id] = picked; const b = $('#' + id); b.classList.add('has-value'); $('.select-value', b).textContent = picked; } s.close(); check(); };
      };
    });
    check();
  });

  textStep({ path: '/cadastro/profissao', step: 6, key: 'profession', title: 'Qual a sua <strong>profissão</strong>?', placeholder: 'Ex.: Analista financeira', attrs: 'maxlength="80"',
    studio: 'e6d262a4 Profissão (modelo comum)', validate: (v) => (v.trim().length >= 2 ? '' : 'Informe sua profissão.'), showError: false, next: () => '/cadastro/ppe' });

  // Studio: "PF | Cadastro | PPE" (montada com o componente de opções da tela Tipo de conta)
  route('/cadastro/ppe', (root) => {
    if (!ob().cpf) return go('/cadastro');
    root.innerHTML = wizardFrame(7, `<h1 class="headline">Você é uma <strong>pessoa politicamente exposta</strong>?</h1>
      <p class="subtext">PPE é quem exerce ou exerceu, nos últimos 5 anos, cargo público relevante, ou é familiar ou colaborador próximo dessas pessoas.</p>
      <div class="options">
        <button type="button" class="option ${ob().isPep === false ? 'is-selected' : ''}" data-v="no"><span class="option-label">Não sou PPE</span><span class="option-radio"></span></button>
        <button type="button" class="option ${ob().isPep === true ? 'is-selected' : ''}" data-v="yes"><span class="option-label">Sou PPE</span><span class="option-radio"></span></button>
      </div>`, null, 'd2d983a6 PPE (modelo comum)');
    const next = wire(root, () => go('/cadastro/email'));
    next.disabled = typeof ob().isPep !== 'boolean';
    $$('.option').forEach((o) => { o.onclick = () => { $$('.option').forEach((x) => x.classList.remove('is-selected')); o.classList.add('is-selected'); ob().isPep = o.dataset.v === 'yes'; next.disabled = false; }; });
  });

  textStep({ path: '/cadastro/email', step: 8, key: 'email', title: 'Qual o seu <strong>e-mail</strong>?', placeholder: 'voce@email.com', attrs: 'type="email" autocomplete="email" maxlength="100"',
    studio: '14f9c591 E-mail (modelo comum)', validate: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'E-mail inválido.'), next: () => '/cadastro/telefone' });

  // Studio: "PF | Cadastro | Telefone". A tela seguinte (código por SMS) foi retirada: a Celcoin não envia SMS.
  textStep({ path: '/cadastro/telefone', step: 8, key: 'phone', title: 'Qual o seu <strong>celular</strong>?', placeholder: '(00) 00000-0000', attrs: 'inputmode="tel" autocomplete="tel" maxlength="15"',
    studio: '88f00de4 Telefone (modelo comum)', format: fmtPhone, store: onlyDigits, validate: (v) => (onlyDigits(v).length === 11 ? '' : 'Informe DDD + 9 dígitos.'),
    helper: state.mode === 'mock' ? 'Modo simulado: final 2 reprova a conta.' : 'No sandbox da Celcoin, o final do número controla o teste: final 2 reprova a conta.',
    next: () => '/cadastro/endereco' });

  // Studio: "PF | Cadastro | Endereço | Seleção" (lido). "Permitir localização" foi trocado por busca por CEP:
  // o app não tem serviço de endereço por coordenadas.
  route('/cadastro/endereco', (root) => {
    if (!ob().cpf) return go('/cadastro');
    root.innerHTML = wizardFrame(9, `<h1 class="headline">Agora só falta <strong>informar seu endereço</strong> e criar sua senha</h1>
      <div class="note-box"><ul><li>Informe o CEP para preencher o endereço automaticamente</li><li>Se não souber o CEP, preencha o endereço manualmente</li></ul></div>`,
      '<button type="button" class="btn btn-primary" id="cep">Buscar pelo CEP</button><button type="button" class="btn btn-outline" id="man">Digitar manualmente</button>', '8ad720e3 Endereço Seleção (adaptada)');
    wire(root);
    $('#cep').onclick = () => go('/cadastro/endereco/cep');
    $('#man').onclick = () => go('/cadastro/endereco/manual');
  });

  // Studio: "Endereço | Encontre seu CEP" + "Confirmação" (modelo comum). Busca no ViaCEP (a Celcoin não oferece CEP).
  route('/cadastro/endereco/cep', (root) => {
    if (!ob().cpf) return go('/cadastro');
    root.innerHTML = wizardFrame(9, `<h1 class="headline">Qual o seu <strong>CEP</strong>?</h1>
      <div class="field-group"><div class="field"><div class="field-box"><input id="f" inputmode="numeric" placeholder="00000-000" maxlength="9" value="${esc(fmtCep(ob().address.postalCode || ''))}"/><span class="icon-r" id="ic"></span></div>
      <p class="field-error" id="er"></p></div><div id="found"></div></div>`, null, '8258942a/19 Encontre seu CEP + Confirmação (modelo comum)');
    const f = $('#f'), er = $('#er'), ic = $('#ic'), found = $('#found');
    const next = wire(root, () => go('/cadastro/endereco/complemento'));
    next.disabled = true;
    let seq = 0;
    f.oninput = async () => {
      f.value = fmtCep(f.value); next.disabled = true; er.classList.remove('is-visible'); found.innerHTML = ''; ic.classList.remove('is-visible');
      const cep = onlyDigits(f.value);
      if (cep.length !== 8) return;
      const my = ++seq; ic.innerHTML = I.spinner; ic.classList.add('is-visible');
      try {
        const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const d = await r.json();
        if (my !== seq) return;
        if (d.erro) throw new Error('CEP não encontrado.');
        Object.assign(ob().address, { postalCode: cep, street: d.logradouro, neighborhood: d.bairro, city: d.localidade, state: d.uf });
        ic.innerHTML = I.ok;
        found.innerHTML = `<div class="card"><div class="row"><div class="row__info"><span class="row__caption">Endereço encontrado</span><span class="row__label" style="white-space:normal">${esc(d.logradouro || '(sem rua)')}</span><span class="row__caption">${esc(d.bairro)} — ${esc(d.localidade)}/${esc(d.uf)}</span></div></div></div>`;
        next.disabled = false;
      } catch (e) {
        if (my !== seq) return;
        ic.innerHTML = I.err; er.textContent = e.message === 'CEP não encontrado.' ? e.message : 'Não foi possível buscar o CEP. Preencha manualmente.'; er.classList.add('is-visible');
      }
    };
    if (onlyDigits(f.value).length === 8) f.oninput();
  });

  // Studio: "Endereço | Complete o endereço" (modelo comum)
  route('/cadastro/endereco/complemento', (root) => {
    const a = ob().address;
    if (!a.postalCode) return go('/cadastro/endereco');
    root.innerHTML = wizardFrame(9, `<h1 class="headline"><strong>Complete</strong> o endereço</h1>
      <div class="field-group">
        ${a.street ? '' : '<div class="field"><span class="field-label">Rua</span><div class="field-box"><input id="street" maxlength="200" placeholder="Nome da rua"/></div></div>'}
        <div class="row2"><div class="field"><span class="field-label">Número</span><div class="field-box"><input id="num" maxlength="10" placeholder="Nº" value="${esc(a.number || '')}"/></div></div>
        <div class="field"><span class="field-label">Complemento</span><div class="field-box"><input id="comp" maxlength="60" placeholder="Opcional" value="${esc(a.complement || '')}"/></div></div></div>
        <p class="field-helper">${esc(a.street || '')}${a.street ? ', ' : ''}${esc(a.neighborhood || '')} — ${esc(a.city || '')}/${esc(a.state || '')} · CEP ${esc(fmtCep(a.postalCode))}</p>
      </div>`, null, '21fce59c Complete o endereço (modelo comum)');
    const next = wire(root, () => { if ($('#street')) a.street = $('#street').value.trim(); a.number = $('#num').value.trim(); a.complement = $('#comp').value.trim(); go('/cadastro/senha'); });
    const check = () => { next.disabled = !($('#num').value.trim() && (!$('#street') || $('#street').value.trim())); };
    $$('input', root).forEach((i) => { i.oninput = check; });
    check();
  });

  // Studio: "Endereço | Preencher endereço manualmente" (modelo comum)
  route('/cadastro/endereco/manual', (root) => {
    if (!ob().cpf) return go('/cadastro');
    const a = ob().address;
    const fld = (id, label, ph, val, attrs) => `<div class="field"><span class="field-label">${label}</span><div class="field-box"><input id="${id}" placeholder="${ph}" value="${esc(val || '')}" ${attrs || ''}/></div></div>`;
    root.innerHTML = wizardFrame(9, `<h1 class="headline">Preencha seu <strong>endereço</strong></h1><div class="field-group">
      ${fld('cep', 'CEP', '00000-000', fmtCep(a.postalCode || ''), 'inputmode="numeric" maxlength="9"')}${fld('street', 'Rua', 'Nome da rua', a.street, 'maxlength="200"')}
      <div class="row2">${fld('num', 'Número', 'Nº', a.number, 'maxlength="10"')}${fld('comp', 'Complemento', 'Opcional', a.complement, 'maxlength="60"')}</div>
      ${fld('nb', 'Bairro', 'Bairro', a.neighborhood, 'maxlength="200"')}<div class="row2 row2--wide-first">${fld('city', 'Cidade', 'Cidade', a.city, 'maxlength="100"')}${fld('uf', 'UF', 'SP', a.state, 'maxlength="2" style="text-transform:uppercase"')}</div>
      </div>`, null, 'aa4e8aab Endereço manual (modelo comum)');
    const next = wire(root, () => {
      Object.assign(a, { postalCode: onlyDigits($('#cep').value), street: $('#street').value.trim(), number: $('#num').value.trim(), complement: $('#comp').value.trim(), neighborhood: $('#nb').value.trim(), city: $('#city').value.trim(), state: $('#uf').value.trim().toUpperCase() });
      go('/cadastro/senha');
    });
    const check = () => { next.disabled = !(onlyDigits($('#cep').value).length === 8 && $('#street').value.trim() && $('#num').value.trim() && $('#nb').value.trim() && $('#city').value.trim() && /^[A-Za-z]{2}$/.test($('#uf').value.trim())); };
    $$('input', root).forEach((i) => { i.oninput = () => { if (i.id === 'cep') i.value = fmtCep(i.value); check(); }; });
    check();
  });

  // Studio: "Criar senha" / "Confirmar senha" / "Criar senha transferência" (modelo comum)
  route('/cadastro/senha', (root) => {
    if (!ob().address.number) return go('/cadastro/endereco');
    root.innerHTML = wizardFrame(10, `<h1 class="headline">Crie sua <strong>senha de acesso</strong></h1>
      <div class="field-group"><div class="field"><div class="field-box"><input id="f" type="password" autocomplete="new-password" placeholder="Sua senha"/></div>
      <p class="field-helper" id="rules">Use 8 caracteres ou mais, com letras e números.</p></div></div>`, null, '152226d7 Criar senha (modelo comum)');
    const f = $('#f');
    const next = wire(root, () => { state.pwd = f.value; go('/cadastro/senha/confirmar'); });
    f.oninput = () => { next.disabled = !(f.value.length >= 8 && /[A-Za-z]/.test(f.value) && /\d/.test(f.value)); };
  });

  route('/cadastro/senha/confirmar', (root) => {
    if (!state.pwd) return go('/cadastro/senha');
    root.innerHTML = wizardFrame(10, `<h1 class="headline"><strong>Confirme</strong> sua senha</h1>
      <div class="field-group"><div class="field"><div class="field-box"><input id="f" type="password" autocomplete="new-password" placeholder="Repita a senha"/></div>
      <p class="field-error" id="er">As senhas não conferem.</p></div></div>`, null, 'abe9e59d Confirmar senha (modelo comum)');
    const f = $('#f'), er = $('#er');
    const next = wire(root, () => go('/cadastro/senha-transferencia'));
    f.oninput = () => { const ok = f.value === state.pwd; next.disabled = !ok; er.classList.toggle('is-visible', !ok && f.value.length >= state.pwd.length); };
  });

  route('/cadastro/senha-transferencia', (root) => {
    if (!state.pwd) return go('/cadastro/senha');
    root.innerHTML = wizardFrame(10, `<h1 class="headline">Crie sua <strong>senha de transferência</strong></h1>
      <p class="subtext">Ela será pedida sempre que você fizer um Pix. Use 4 números.</p>
      <div class="field-group"><div class="field"><div class="field-box"><input id="f" type="password" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="••••"/></div>
      <p class="field-error" id="er"></p></div></div>`,
      '<button type="button" class="btn btn-primary" data-next disabled>Criar conta</button><button type="button" class="btn btn-ghost" data-back>Voltar</button>', 'c0c0f928 Criar senha transferência (modelo comum)');
    const f = $('#f'), er = $('#er');
    const next = wire(root, async () => {
      setLoading(next, true); er.classList.remove('is-visible');
      const o = ob();
      try {
        await api('/onboarding/pf', { method: 'POST', allow401: true, body: {
          cpf: o.cpf, fullName: o.fullName, socialName: o.socialName, birthDate: o.birthDate, motherName: o.motherName, income: o.income, assets: o.assets,
          profession: o.profession, isPep: o.isPep, email: o.email, phone: o.phone, address: o.address, password: state.pwd, txPassword: f.value } });
        state.pwd = null; state.onboarding = null;
        await loadMe();
        go('/cadastro/sucesso');
      } catch (e) { er.textContent = e.message; er.classList.add('is-visible'); setLoading(next, false); next.disabled = false; }
    });
    f.oninput = () => { f.value = onlyDigits(f.value).slice(0, 4); next.disabled = f.value.length !== 4; };
  });

  // Studio: "PF | Cadastro | Sucesso" (opcional; montada com o componente de resultado)
  route('/cadastro/sucesso', (root) => {
    root.innerHTML = frame(`<div class="scroll"><div class="result" style="margin-top:96px"><span class="result__badge result__badge--ok" style="width:72px;height:72px">${I.ok}</span>
      <h1 class="result__title">Cadastro enviado!</h1><p class="result__desc">Agora falta só <strong>validar sua identidade</strong> com uma foto do documento e uma selfie. A conta só é aberta depois dessa etapa.</p></div></div>
      <div class="actions"><button class="btn btn-primary" id="go">Validar identidade</button></div>`, { studio: '6095742f Sucesso (modelo de resultado)' });
    $('#go').onclick = () => go('/validacao');
  });

  // ============================================================ VALIDAÇÃO DE IDENTIDADE (novo)
  // Redireciona para a URL de documentoscopia que a Celcoin devolve e acompanha a proposta por consulta direta.
  route('/validacao', async (root) => {
    if (!(await loadMe())) return go('/login');
    if (state.me.account) return go('/home');
    let delay = 4000;
    const paint = (s) => {
      const map = {
        LOADING: { badge: 'wait', icon: I.spinner, title: 'Consultando sua proposta…', desc: '' },
        PENDING: { badge: 'wait', icon: I.spinner, title: 'Analisando seus dados', desc: 'Isso costuma levar poucos segundos.' },
        PENDING_DOCUMENTSCOPY: { badge: 'wait', icon: I.shield, title: 'Valide sua identidade', desc: 'Toque no botão abaixo para enviar a foto do documento e uma selfie no ambiente seguro da Celcoin. Depois, volte para esta tela.' },
        APPROVED: { badge: 'wait', icon: I.spinner, title: 'Identidade aprovada', desc: 'Estamos abrindo a sua conta. Pode levar alguns minutos; não feche esta tela.' },
        RESOURCE_CREATED: { badge: 'wait', icon: I.spinner, title: 'Conta criada', desc: 'Buscando os dados da sua conta…' },
        REPROVED: { badge: 'err', icon: I.err, title: 'Não foi possível abrir sua conta', desc: 'A análise cadastral não aprovou a abertura. Entre em contato com o suporte do LoBank.' },
        RESOURCE_ERROR: { badge: 'err', icon: I.err, title: 'Erro ao abrir a conta', desc: 'A Celcoin informou um erro na criação da conta. Entre em contato com o suporte do LoBank.' },
        ERROR: { badge: 'err', icon: I.err, title: 'Não conseguimos consultar agora', desc: 'Vamos tentar de novo em instantes.' },
      };
      const m = map[s.status] || map.PENDING;
      root.innerHTML = frame(`<header class="hdr"><button class="hdr__icon" id="out" aria-label="Sair">${I.chevLeft}</button></header>
        <div class="scroll"><div class="result"><span class="result__badge result__badge--${m.badge}" style="width:72px;height:72px">${m.icon}</span>
        <h1 class="result__title">${m.title}</h1><p class="result__desc">${m.desc}</p>
        ${s.status === 'APPROVED' || s.status === 'PENDING_DOCUMENTSCOPY' ? '<p class="result__desc" style="font-size:12px">Status Celcoin: ' + esc(s.status) + '</p>' : ''}</div></div>
        <div class="actions">${s.documentscopyUrl ? `<a class="btn btn-primary" id="doc" href="${esc(s.documentscopyUrl)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none">Enviar documento e selfie</a>` : ''}
        ${state.mode === 'mock' && s.status === 'PENDING_DOCUMENTSCOPY' ? '<button class="btn btn-outline" id="mockok">Simular documentoscopia aprovada</button>' : ''}
        <button class="btn btn-ghost" id="refresh">Atualizar</button></div>
        <p class="studio-note">Tela criada para o app: não existe no Studio.</p>`, { studio: 'novo:validacao' });
      $('#out').onclick = async () => { await api('/auth/logout', { method: 'POST', allow401: true }); go('/login'); };
      $('#refresh').onclick = () => tick(true);
      if ($('#mockok')) $('#mockok').onclick = async () => { await api('/dev/approve-documentscopy', { method: 'POST' }); tick(true); };
    };
    const tick = async (manual) => {
      let s;
      try { s = await api('/onboarding/status'); } catch (e) { if (e.status === 401) return; s = { status: 'ERROR' }; }
      if (s.account) { await loadMe(); toast('Conta aberta!'); return go('/home'); }
      paint(s);
      if (['REPROVED', 'RESOURCE_ERROR'].includes(s.status)) return;
      if (!manual) delay = Math.min(delay * 1.5, 30000); // recuo progressivo; para por condição real
      later(() => tick(false), delay);
    };
    paint({ status: 'LOADING' });
    tick(true);
  });

  // ============================================================ HOME (Wallet | Home)
  // Retirados por comentário: banner de crédito e cartão de crédito. Atalhos: só os que funcionam.
  route('/home', async (root) => {
    if (!(await loadMe())) return go('/login');
    if (!state.me.account) return go('/validacao');
    root.innerHTML = frame(`<div class="scroll">
      <div class="home-header"><div class="status-bar"></div>
        <div class="menu-top"><span>${LOGO('#FFFFFF', 108)}</span>
          <div class="menu-right"><button type="button" class="icon-btn" aria-label="Ajuda" id="help">${I.help}</button>
            <button type="button" class="user-pill" id="menu" aria-label="Menu da conta"><span class="user-pill-text"><strong>Olá, ${esc(state.me.name)}</strong><span>Conta PF</span></span>${I.caret}</button></div></div>
        <div class="account-card"><div class="account-card-row"><div><p class="account-card-label">Saldo em conta</p><p class="account-card-value" id="bal">${state.hideBalance ? 'R$ ••••' : '…'}</p>
          <p class="account-card-meta">Ag ${esc(state.me.account.branch)} · Conta ${esc(state.me.account.account)}</p></div>
          <button type="button" class="icon-btn" aria-label="Mostrar ou esconder saldo" id="eye">${I.eye}</button></div></div>
      </div>
      <div class="home-body">
        <div class="section"><h2 class="section-title">Ações rápidas</h2>
          <div class="shortcuts">
            <button class="shortcut" data-go="/pix/transferir"><span class="shortcut-icon">${I.pix}</span><p class="shortcut-label">Fazer<br>Pix</p></button>
            <button class="shortcut" data-go="/receber"><span class="shortcut-icon">${I.receive}</span><p class="shortcut-label">Cobrar<br>com Pix</p></button>
            <button class="shortcut" data-go="/pix/chaves"><span class="shortcut-icon">${I.key}</span><p class="shortcut-label">Minhas<br>chaves</p></button>
            <button class="shortcut" data-go="/extrato"><span class="shortcut-icon">${I.list}</span><p class="shortcut-label">Extrato</p></button>
          </div></div>
        <button type="button" class="btn-neutral" data-go="/pix">Área Pix ${I.chevRight}</button>
      </div></div>`, { studio: '82e58028 Home' });
    $$('[data-go]').forEach((b) => { b.onclick = () => go(b.dataset.go); });
    const loadBal = async () => {
      if (state.hideBalance) return;
      try { const b = await api('/balance'); $('#bal').textContent = money(b.amount); } catch (e) { $('#bal').textContent = 'Indisponível'; }
    };
    $('#eye').onclick = () => { state.hideBalance = !state.hideBalance; $('#bal').textContent = 'R$ ••••'; loadBal(); };
    $('#help').onclick = () => { const s = sheet('<h2 class="sheet-title">Ajuda</h2><p class="sheet-text">Este é um app de testes no sandbox da Celcoin. Nenhum dinheiro real é movimentado.</p><div class="sheet-actions"><button class="btn btn-primary" data-x>Entendi</button></div>'); $('[data-x]', s.el).onclick = s.close; };
    $('#menu').onclick = () => {
      const s = sheet(`<h2 class="sheet-title">${esc(state.me.fullName)}</h2><p class="sheet-text">Agência ${esc(state.me.account.branch)} · Conta ${esc(state.me.account.account)}</p>
        ${state.mode === 'mock' ? '<div class="sheet-actions"><button class="btn btn-outline" data-credit>Simular crédito de R$ 1.000</button></div>' : ''}
        <div class="sheet-actions"><button class="btn btn-primary" data-out>Sair</button><button class="btn btn-ghost" data-x>Voltar</button></div>`);
      $('[data-x]', s.el).onclick = s.close;
      $('[data-out]', s.el).onclick = async () => { await api('/auth/logout', { method: 'POST', allow401: true }); state.me = null; go('/login'); };
      const cr = $('[data-credit]', s.el); if (cr) cr.onclick = async () => { await api('/dev/credit', { method: 'POST', body: { amount: 1000 } }); s.close(); loadBal(); };
    };
    loadBal();
  });

  // ============================================================ ÁREA PIX (Área Pix | Home)
  // Retirados: Pix Automático e Minha agenda Pix (comentário), Agendar (decisão), e opções sem fluxo nesta fase.
  route('/pix', async (root) => {
    if (!(await loadMe())) return go('/login');
    if (!state.me.account) return go('/validacao');
    root.innerHTML = frame(`<header class="hdr"><button class="hdr__icon" id="bk" aria-label="Voltar">${I.chevLeft}</button></header>
      <div class="scroll"><section class="intro" style="gap:16px;padding-bottom:16px"><h1 class="intro__title">Área Pix</h1><div id="kc" class="keycard"><span class="keycard__count">Carregando chaves…</span></div></section>
        <section class="pix-section"><h2 class="pix-section__title">Enviar</h2><div class="pix-options"><button class="pix-option" data-go="/pix/transferir"><span class="pix-option__chip">${I.pix}</span><span class="pix-option__label">Transferir</span></button></div></section>
        <section class="pix-section"><h2 class="pix-section__title">Receber</h2><div class="pix-options"><button class="pix-option" data-go="/receber"><span class="pix-option__chip">${I.receive}</span><span class="pix-option__label">Cobrar<br>com Pix</span></button></div></section>
        <section class="pix-section"><h2 class="pix-section__title">Configurações Pix</h2><div class="pix-options"><button class="pix-option" data-go="/pix/chaves"><span class="pix-option__chip">${I.key}</span><span class="pix-option__label">Minhas<br>chaves</span></button></div></section>
        <div style="height:64px"></div></div>`, { studio: '08689cca Área Pix | Home (itens retirados)' });
    $('#bk').onclick = () => go('/home');
    $$('[data-go]').forEach((b) => { b.onclick = () => go(b.dataset.go); });
    try {
      const { keys } = await api('/pix/keys');
      const k = keys.find((x) => x.type === 'EVP');
      $('#kc').innerHTML = k
        ? `<div class="keycard__top"><span class="keycard__icon">${I.key}</span><div class="keycard__info"><span class="keycard__label">Chave aleatória</span><span class="keycard__value">${esc(k.key)}</span></div>
            <div class="keycard__actions"><button class="keycard__action" id="cp" aria-label="Copiar chave">${I.copy}</button></div></div>
            <p class="keycard__count">Você tem ${keys.length} chave${keys.length > 1 ? 's' : ''} cadastrada${keys.length > 1 ? 's' : ''}</p>
            <button class="collapse" data-go2="/pix/chaves"><span class="collapse__text">Gerenciar chaves</span><span class="collapse__chevron">${I.chevRight}</span></button>`
        : `<p class="keycard__count">Você ainda não tem chave Pix. Cadastre uma chave aleatória para receber.</p>
            <button class="collapse" data-go2="/pix/chaves"><span class="collapse__text">Cadastrar chave aleatória</span><span class="collapse__chevron">${I.chevRight}</span></button>`;
      if ($('#cp')) $('#cp').onclick = () => copy(k.key);
      $$('[data-go2]').forEach((b) => { b.onclick = () => go(b.dataset.go2); });
    } catch (e) { $('#kc').innerHTML = `<p class="keycard__count">${esc(e.message)}</p>`; }
  });

  // ============================================================ MINHAS CHAVES (Configurações | Minhas chaves Pix)
  // Só chave aleatória, por comentário. "Chave não cadastrada" e "Confirmação de criação (v.2)" viram estados desta tela.
  route('/pix/chaves', async (root) => {
    if (!(await loadMe())) return go('/login');
    if (!state.me.account) return go('/validacao');
    root.innerHTML = frame(`<header class="hdr"><button class="hdr__icon" id="bk" aria-label="Voltar">${I.chevLeft}</button></header>
      <div class="scroll"><section class="cfg-body"><div><h1 class="cfg-title__main">Minhas chaves</h1><p class="cfg-title__sub">Compartilhe sua chave para receber</p></div><div id="list">${I.spinner}</div></section></div>`,
      { studio: '7be5f818 Minhas chaves Pix (só EVP)' });
    $('#bk').onclick = back;
    const { keys } = await api('/pix/keys');
    const evp = keys.find((k) => k.type === 'EVP');
    $('#list').innerHTML = evp
      ? `<div class="key-card"><span class="key-card__icon">${I.key}</span><div class="key-card__info"><span class="key-card__label">Chave aleatória</span><span class="key-card__value">${esc(evp.key)}</span></div><button class="key-card__btn" id="cp" aria-label="Copiar">${I.copy}</button><button class="key-card__btn key-card__btn--danger" id="del" aria-label="Excluir chave">${I.trash}</button></div>
         <div class="info-box"><span class="info-box-bar"></span><span class="info-box-text">O LoBank oferece só chave aleatória. Ela não expõe seus dados pessoais.</span></div>`
      : `<div class="info-box info-box--warn"><span class="info-box-bar"></span><span class="info-box-text">Você ainda não tem chave Pix cadastrada.</span></div>
         <p class="cfg-section">Cadastrar chave Pix</p><p class="cfg-title__sub">O LoBank oferece só chave aleatória.</p>
         <div class="card"><button class="row" id="new"><span class="row__icon">${I.key}</span><div class="row__info"><span class="row__label">Chave aleatória</span><span class="row__caption">Gerada automaticamente</span></div><span class="row__chevron">${I.chevRight}</span></button></div>`;
    if (evp) {
      $('#cp').onclick = () => copy(evp.key);
      $('#del').onclick = () => {
        const s = sheet(`<h2 class="sheet-title">Excluir chave aleatória?</h2><p class="sheet-text">A chave <strong>${esc(evp.key)}</strong> deixa de funcionar. Quem tentar te enviar Pix por ela não vai conseguir, e QR Codes gerados com ela param de valer. Não dá para recuperar essa mesma chave depois.</p>
          <div class="sheet-actions"><button class="btn btn-danger" data-ok>Excluir chave</button><button class="btn btn-ghost" data-x>Cancelar</button></div>`);
        $('[data-x]', s.el).onclick = s.close;
        const ok = $('[data-ok]', s.el);
        ok.onclick = async () => {
          setLoading(ok, true);
          try { const r = await api('/pix/keys/' + encodeURIComponent(evp.key), { method: 'DELETE' }); s.close(); toast(r.error ? r.message : 'Chave excluída.'); render(); }
          catch (e) { s.close(); toast(e.message); }
        };
      };
    }
    if (!evp) $('#new').onclick = () => {
      const s = sheet(`<h2 class="sheet-title">Cadastrar chave aleatória?</h2><p class="sheet-text">Vamos gerar um código aleatório e vinculá-lo à sua conta. Quem tiver esse código poderá te enviar Pix, sem ver seus dados pessoais.</p>
        <div class="sheet-actions"><button class="btn btn-primary" data-ok>Cadastrar chave</button><button class="btn btn-ghost" data-x>Cancelar</button></div>`);
      $('[data-x]', s.el).onclick = s.close;
      const ok = $('[data-ok]', s.el);
      ok.onclick = async () => {
        setLoading(ok, true);
        try { await api('/pix/keys/evp', { method: 'POST' }); s.close(); toast('Chave aleatória cadastrada!'); render(); }
        catch (e) { s.close(); toast(e.message); }
      };
    };
  });

  // ============================================================ TRANSFERIR POR CHAVE (board Transferir)
  // Retirados: contatos frequentes, favoritos e agenda (sem dados reais nesta fase), agendamento (decisão).
  route('/pix/transferir', async (root) => {
    if (!(await loadMe())) return go('/login');
    if (!state.me.account) return go('/validacao');
    state.pix = { key: (state.pix && state.pix.key) || '' };
    root.innerHTML = frame(`<header class="hdr hdr--wl"><button class="hdr__icon" id="bk" aria-label="Voltar">${I.chevLeft}</button><span class="logo">${LOGO('#7664FA', 104)}</span><span class="hdr__icon"></span></header>
      <div class="scroll"><section class="intro"><h1 class="intro__title intro__title--sm">Transferir por chave Pix</h1><p class="intro__desc">CPF/CNPJ, Celular, E-mail ou Aleatória.</p></section>
        <section class="keyfield"><span class="keyfield__label">CPF, CNPJ, Celular, e-mail ou aleatória</span>
          <div class="keyfield__input" id="box"><input id="key" autocomplete="off" placeholder="Chave Pix" value="${esc(state.pix.key)}"/><span id="ic"></span></div>
          <p class="keyfield__err hidden" id="er"></p>
          ${state.mode === 'mock' ? '<p class="keyfield__alt">Modo simulado: qualquer chave existe, exceto naoexiste@example.com.</p>' : '<p class="keyfield__alt">No sandbox, use <strong>testepix@celcoin.com.br</strong> para um Pix que liquida.</p>'}
        </section></div>
      <footer class="footbar"><button class="btn btn-primary btn--lg" id="next" disabled>Continuar</button></footer>`, { studio: '5196768b Informar chave (+ b14ad19f Erro, 2b4b209e Preenchido)' });
    $('#bk').onclick = () => go('/home');
    const key = $('#key'), next = $('#next'), er = $('#er'), box = $('#box');
    key.oninput = () => { next.disabled = key.value.trim().length < 3; er.classList.add('hidden'); box.classList.remove('is-error'); };
    key.oninput();
    key.onkeydown = (e) => { if (e.key === 'Enter' && !next.disabled) next.click(); };
    next.onclick = async () => {
      setLoading(next, true); $('#ic').innerHTML = `<span style="display:block;width:22px;height:22px">${I.spinner}</span>`;
      try {
        const r = await api('/pix/lookup', { method: 'POST', body: { key: key.value } });
        state.pix = { key: key.value, lookup: r };
        go('/pix/transferir/valor');
      } catch (e) {
        $('#ic').innerHTML = ''; box.classList.add('is-error'); er.textContent = e.message; er.classList.remove('hidden');
        setLoading(next, false);
      }
    };
  });

  function recipientCard(l) {
    return `<div class="contact"><span class="avatar">${esc(initials(l.name))}</span><div class="contact__info"><span class="contact__name">${esc(l.name || 'Destinatário')}</span>
      <div class="contact__desc"><span>${l.document ? (l.personType === 'LEGAL_PERSON' ? 'CNPJ: ' : 'CPF: ') + maskDoc(l.document) : ''}</span><span>Chave: ${esc(l.key)}</span>${l.participant ? `<span>Instituição (ISPB): ${esc(l.participant)}</span>` : ''}</div></div></div>`;
  }

  // Studio: "Transferir | Chave Pix | Valor da transferência" (modelo comum)
  route('/pix/transferir/valor', async (root) => {
    if (!state.pix || !state.pix.lookup) return go('/pix/transferir');
    root.innerHTML = frame(`<header class="hdr hdr--wl"><button class="hdr__icon" id="bk" aria-label="Voltar">${I.chevLeft}</button><span class="logo">${LOGO('#7664FA', 104)}</span><span class="hdr__icon"></span></header>
      <div class="scroll"><section class="intro"><h1 class="intro__title">Qual o <strong>valor</strong> da transferência?</h1><p class="intro__desc">Saldo disponível <strong id="bal">…</strong></p></section>
        <section class="body-sec"><div class="amount-input"><span>R$</span><input id="amt" inputmode="numeric" placeholder="0,00" value="${state.pix.amount ? esc(state.pix.amount.toFixed(2).replace('.', ',')) : ''}"/></div>
        <div class="group"><span class="group__title">Para</span><div class="card">${recipientCard(state.pix.lookup)}</div></div></section></div>
      <footer class="footbar"><button class="btn btn-primary btn--lg" id="next" disabled>Continuar</button></footer>`, { studio: '02f83ffc Valor da transferência (modelo comum)' });
    $('#bk').onclick = back;
    const amt = $('#amt'), next = $('#next');
    amt.oninput = () => { const c = onlyDigits(amt.value).replace(/^0+/, '') || '0'; const n = Number(c) / 100; amt.value = n ? n.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''; next.disabled = !(n > 0); };
    amt.oninput();
    next.onclick = () => { state.pix.amount = parseMoney(amt.value); go('/pix/transferir/revisao'); };
    try { const b = await api('/balance'); state.pix.balance = b.amount; $('#bal').textContent = money(b.amount); } catch (_) { $('#bal').textContent = 'indisponível'; }
  });

  // Studio: "Transferir | Chave Pix | Revisão e saldo" (lido). Retirados: "Favoritar contato" (sem favoritos nesta fase) e "Pagar hoje" como opção (sem agendamento).
  route('/pix/transferir/revisao', async (root) => {
    const p = state.pix;
    if (!p || !p.lookup || !p.amount) return go('/pix/transferir');
    root.innerHTML = frame(`<header class="hdr hdr--wl"><button class="hdr__icon" id="bk" aria-label="Voltar">${I.chevLeft}</button><span class="logo">${LOGO('#7664FA', 104)}</span><span class="hdr__icon"></span></header>
      <div class="scroll"><section class="intro"><h1 class="intro__title">Ok, <strong>ficou tudo certo</strong>?</h1><p class="intro__desc">Saldo disponível <strong id="bal">${p.balance != null ? money(p.balance) : '…'}</strong></p></section>
        <section class="body-sec">
          <div><div class="amount__label">Você está transferindo</div><div class="amount__row"><span class="amount__value">${money(p.amount)}</span><button class="amount__edit" id="edit" aria-label="Editar valor">${I.edit}</button></div></div>
          <div class="group"><span class="group__title">Para</span><div class="card">${recipientCard(p.lookup)}</div></div>
          <div class="group"><span class="group__title">Pagamento</span><div class="card">
            <div class="row"><span class="row__icon row__icon--soft">${I.calendar}</span><div class="row__info"><span class="row__label">Pagar hoje</span></div></div><span class="divider"></span>
            <button class="row" id="msg"><span class="row__icon row__icon--soft">${I.chat}</span><div class="row__info"><span class="row__label" id="msgl">${p.message ? esc(p.message) : 'Escrever mensagem'}</span></div><span class="row__chevron">${I.chevRight}</span></button><span class="divider"></span>
            <div class="row"><span class="row__icon row__icon--soft">${I.pix}</span><div class="row__info"><span class="row__caption">Forma de transferência</span><span class="row__label">Pix</span></div></div><span class="divider"></span>
            <div class="row"><span class="row__icon row__icon--soft">${I.coin}</span><div class="row__info"><span class="row__caption">Transferir com</span><span class="row__label">Saldo em conta</span></div></div>
          </div></div></section></div>
      <footer class="footbar"><button class="btn btn-primary btn--lg" id="go">Transferir</button></footer>`, { studio: '733b240c Revisão e saldo (adaptada)' });
    $('#bk').onclick = back;
    $('#edit').onclick = () => go('/pix/transferir/valor');
    $('#msg').onclick = () => {
      const s = sheet(`<h2 class="sheet-title">Mensagem</h2><div class="field"><div class="field-box"><input id="m" maxlength="140" placeholder="Opcional" value="${esc(p.message || '')}"/></div></div>
        <div class="sheet-actions"><button class="btn btn-primary" data-ok>Salvar</button><button class="btn btn-ghost" data-x>Cancelar</button></div>`);
      $('[data-x]', s.el).onclick = s.close;
      $('[data-ok]', s.el).onclick = () => { p.message = $('#m', s.el).value.trim(); $('#msgl').textContent = p.message || 'Escrever mensagem'; s.close(); };
    };
    if (p.balance == null) { try { const b = await api('/balance'); p.balance = b.amount; $('#bal').textContent = money(b.amount); } catch (_) { /* segue */ } }
    $('#go').onclick = () => {
      if (p.balance != null && p.balance < p.amount) return go('/pix/transferir/saldo-insuficiente');
      const s = sheet(`<h2 class="sheet-title">Senha de transferência</h2><p class="sheet-text">Digite sua senha de 4 números para confirmar o Pix de <strong>${money(p.amount)}</strong>.</p>
        <div class="field"><div class="field-box"><input id="tp" type="password" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="••••"/></div><p class="field-error" id="tpe"></p></div>
        <div class="sheet-actions"><button class="btn btn-primary" data-ok disabled>Confirmar</button><button class="btn btn-ghost" data-x>Cancelar</button></div>`);
      const tp = $('#tp', s.el), ok = $('[data-ok]', s.el), tpe = $('#tpe', s.el);
      tp.focus();
      tp.oninput = () => { tp.value = onlyDigits(tp.value).slice(0, 4); ok.disabled = tp.value.length !== 4; };
      $('[data-x]', s.el).onclick = s.close;
      ok.onclick = async () => {
        setLoading(ok, true); tpe.classList.remove('is-visible');
        try {
          const r = await api('/pix/transfer', { method: 'POST', body: { lookupId: p.lookup.lookupId, amount: p.amount, message: p.message, txPassword: tp.value } });
          state.pix = null; s.close(); go('/pix/transferencia/' + r.txId);
        } catch (e) {
          if (e.data && e.data.error === 'INSUFFICIENT_BALANCE') { s.close(); p.balance = e.data.balance; return go('/pix/transferir/saldo-insuficiente'); }
          if (e.data && e.data.error === 'INVALID_TX_PASSWORD') { tpe.textContent = e.message; tpe.classList.add('is-visible'); setLoading(ok, false); ok.disabled = false; return; }
          s.close();
          if (e.data && e.data.error === 'LOOKUP_EXPIRED') { toast(e.message); return go('/pix/transferir'); }
          errorModal(e.message);
        }
      };
    };
  });

  // Studio: "Transferir | Chave Pix | Modal | Erro na transação" (modelo comum)
  function errorModal(msg) {
    const s = sheet(`<div style="display:flex;flex-direction:column;align-items:center;gap:16px;text-align:center"><span class="result__badge result__badge--err" style="width:56px;height:56px">${I.err}</span>
      <h2 class="sheet-title" style="margin:0">Erro na transação</h2><p class="sheet-text">${esc(msg)}</p></div>
      <div class="sheet-actions"><button class="btn btn-primary" data-x>Entendi</button></div>`);
    $('[data-x]', s.el).onclick = s.close;
  }

  // Studio: "Transferir | Chave Pix | Saldo insuficiente" (modelo comum)
  route('/pix/transferir/saldo-insuficiente', (root) => {
    const p = state.pix || {};
    root.innerHTML = frame(`<header class="hdr"><button class="hdr__icon" id="bk" aria-label="Voltar">${I.chevLeft}</button></header>
      <div class="scroll"><div class="result"><span class="result__badge result__badge--err" style="width:72px;height:72px">${I.err}</span>
        <h1 class="result__title">Saldo insuficiente</h1><p class="result__desc">Você tem <strong>${money(p.balance)}</strong> disponíveis e tentou transferir <strong>${money(p.amount)}</strong>.</p></div></div>
      <div class="actions"><button class="btn btn-primary" id="edit">Alterar valor</button><button class="btn btn-ghost" id="home">Voltar ao início</button></div>`, { studio: 'a49d2b21 Saldo insuficiente (modelo comum)' });
    $('#bk').onclick = back;
    $('#edit').onclick = () => go(state.pix && state.pix.lookup ? '/pix/transferir/valor' : '/pix/transferir');
    $('#home').onclick = () => go('/home');
  });

  // Studio: "Transferir | Chave Pix | Sucesso" (modelo de resultado). 200 PROCESSING não é sucesso: a tela
  // mostra "em processamento" e consulta o desfecho com recuo progressivo, trocando o estado quando ele chega.
  route_prefix('/pix/transferencia/', async (root, id) => {
    let delay = 1500, tries = 0;
    const paint = (t) => {
      const st = t.status;
      const view = st === 'CONFIRMED'
        ? { b: 'ok', i: I.ok, title: 'Pix enviado!', desc: `${money(t.amount)} para ${esc(t.counterpart.name || '')}` }
        : st === 'ERROR' ? { b: 'err', i: I.err, title: 'Pix não concluído', desc: esc(t.errorMessage || 'A transferência foi recusada.') }
          : st === 'UNKNOWN' ? { b: 'wait', i: I.spinner, title: 'Confirmando com a Celcoin', desc: 'A conexão caiu no envio. Não tente de novo: estamos confirmando se o Pix foi feito.' }
            : { b: 'wait', i: I.spinner, title: 'Pix em processamento', desc: `${money(t.amount)} para ${esc(t.counterpart.name || '')}. Isso costuma levar poucos segundos.` };
      root.innerHTML = frame(`<div class="scroll"><div class="result" style="margin-top:96px"><span class="result__badge result__badge--${view.b}" style="width:72px;height:72px">${view.i}</span>
        <h1 class="result__title">${view.title}</h1><p class="result__desc">${view.desc}</p>${st === 'PROCESSING' && tries > 12 ? '<p class="result__desc" style="font-size:13px">Está demorando mais que o normal. Você pode sair: o status aparece no extrato.</p>' : ''}</div></div>
        <div class="actions">${st === 'CONFIRMED' ? '<button class="btn btn-primary" id="rc">Visualizar comprovante</button>' : ''}<button class="btn ${st === 'CONFIRMED' ? 'btn-ghost' : 'btn-primary'}" id="home">Voltar ao início</button></div>`, { studio: 'caca6a53 Sucesso (modelo de resultado, com estado em processamento)' });
      $('#home').onclick = () => go('/home');
      if ($('#rc')) $('#rc').onclick = () => go('/comprovante/' + id);
    };
    const tick = async () => {
      const t = await api('/pix/transfer/' + encodeURIComponent(id));
      tries++;
      paint(t);
      if (t.status === 'PROCESSING' || t.status === 'UNKNOWN') { later(tick, delay); delay = Math.min(delay * 1.6, 20000); }
    };
    await tick();
  });

  // Studio: "Transferir | Chave Pix | Sucesso | Visualizar comprovante" e "Extrato | Comprovante de pagamento" (modelo comum)
  route_prefix('/comprovante/', async (root, id) => {
    const t = await api('/pix/transfer/' + encodeURIComponent(id));
    const c = t.counterpart || {};
    root.innerHTML = frame(`<header class="hdr hdr--wl"><button class="hdr__icon" id="bk" aria-label="Voltar">${I.chevLeft}</button><span class="logo">${LOGO('#7664FA', 104)}</span><span class="hdr__icon"></span></header>
      <div class="scroll"><section class="intro"><h1 class="intro__title intro__title--sm">Comprovante de Pix</h1><p class="intro__desc">${fmtDateTime(t.createdAt + 'Z')}</p></section>
        <section class="body-sec"><div class="card"><div class="receipt">
          <div class="receipt__row"><span>Situação</span><span>${t.status === 'CONFIRMED' ? 'Concluído' : t.status === 'ERROR' ? 'Não concluído' : 'Em processamento'}</span></div>
          <div class="receipt__row"><span>Valor</span><span>${money(t.amount)}</span></div>
          <div class="receipt__row"><span>Para</span><span>${esc(c.name || '')}</span></div>
          ${c.document ? `<div class="receipt__row"><span>Documento</span><span>${maskDoc(c.document)}</span></div>` : ''}
          <div class="receipt__row"><span>Chave</span><span>${esc(c.key || '')}</span></div>
          ${c.participant ? `<div class="receipt__row"><span>Instituição (ISPB)</span><span>${esc(c.participant)}</span></div>` : ''}
          <span class="divider"></span>
          <div class="receipt__row"><span>De</span><span>${esc(state.me ? state.me.fullName : '')}</span></div>
          ${t.message ? `<div class="receipt__row"><span>Mensagem</span><span>${esc(t.message)}</span></div>` : ''}
          <div class="receipt__row"><span>ID da transação</span><span>${esc(t.endToEndId || '')}</span></div>
        </div></div></section></div>
      <footer class="footbar"><button class="btn btn-primary btn--lg" id="share">Copiar comprovante</button></footer>`, { studio: '2ea377b0 Visualizar comprovante (modelo comum)' });
    $('#bk').onclick = back;
    $('#share').onclick = () => copy(`Comprovante Pix LoBank\nValor: ${money(t.amount)}\nPara: ${c.name || ''}\nChave: ${c.key || ''}\nID: ${t.endToEndId || ''}\nSituação: ${t.status}`);
  });

  // ============================================================ RECEBER (board Receber, fluxo "Único")
  // Studio: "Receber | Home | Único" + "Único | Inserir valor" (modelo comum)
  route('/receber', async (root) => {
    if (!(await loadMe())) return go('/login');
    if (!state.me.account) return go('/validacao');
    state.receive = state.receive || {};
    root.innerHTML = frame(`<header class="hdr hdr--wl"><button class="hdr__icon" id="bk" aria-label="Voltar">${I.chevLeft}</button><span class="logo">${LOGO('#7664FA', 104)}</span><span class="hdr__icon"></span></header>
      <div class="scroll"><section class="intro"><h1 class="intro__title">Quanto você quer <strong>cobrar</strong>?</h1><p class="intro__desc">Gere um QR Code Pix para receber na sua chave aleatória.</p></section>
        <section class="body-sec"><div class="amount-input"><span>R$</span><input id="amt" inputmode="numeric" placeholder="0,00" value="${state.receive.amount ? esc(state.receive.amount.toFixed(2).replace('.', ',')) : ''}"/></div>
        <button class="link-inline" id="free">Não definir valor (quem paga escolhe)</button></section></div>
      <footer class="footbar"><button class="btn btn-primary btn--lg" id="next" disabled>Continuar</button></footer>`, { studio: 'c3a90386 Home Único + 29121fb6 Inserir valor (modelo comum)' });
    $('#bk').onclick = () => go('/home');
    const amt = $('#amt'), next = $('#next');
    amt.oninput = () => { const n = Number(onlyDigits(amt.value) || 0) / 100; amt.value = n ? n.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''; next.disabled = !(n > 0); };
    amt.oninput();
    next.onclick = () => { state.receive.amount = parseMoney(amt.value); go('/receber/revisar'); };
    $('#free').onclick = () => { state.receive.amount = null; go('/receber/revisar'); };
  });

  // Studio: "Receber | Único | Revisar cobrança" (+ "Editar | Descrição"). Edição de CPF/CNPJ e nome do pagador ficam para a Fase 2.
  route('/receber/revisar', (root) => {
    const r = state.receive;
    if (!r) return go('/receber');
    root.innerHTML = frame(`<header class="hdr hdr--wl"><button class="hdr__icon" id="bk" aria-label="Voltar">${I.chevLeft}</button><span class="logo">${LOGO('#7664FA', 104)}</span><span class="hdr__icon"></span></header>
      <div class="scroll"><section class="intro"><h1 class="intro__title">Revise a <strong>cobrança</strong></h1></section>
        <section class="body-sec"><div><div class="amount__label">Você vai cobrar</div><div class="amount__row"><span class="amount__value">${r.amount ? money(r.amount) : 'Valor livre'}</span><button class="amount__edit" id="edit" aria-label="Editar valor">${I.edit}</button></div></div>
          <div class="card"><button class="row" id="desc"><span class="row__icon row__icon--soft">${I.chat}</span><div class="row__info"><span class="row__caption">Descrição</span><span class="row__label" id="dl">${r.description ? esc(r.description) : 'Adicionar descrição'}</span></div><span class="row__chevron">${I.chevRight}</span></button></div>
          <div class="info-box"><span class="info-box-bar"></span><span class="info-box-text">O QR Code usa a sua chave aleatória. Quem pagar verá seu nome.</span></div></section></div>
      <footer class="footbar"><button class="btn btn-primary btn--lg" id="gen">Gerar QR Code</button></footer>`, { studio: 'a982a6e1 Revisar cobrança + 58fb0fdd Editar Descrição (modelo comum)' });
    $('#bk').onclick = back;
    $('#edit').onclick = () => go('/receber');
    $('#desc').onclick = () => {
      const s = sheet(`<h2 class="sheet-title">Descrição</h2><div class="field"><div class="field-box"><input id="d" maxlength="72" placeholder="Ex.: Pedido 123" value="${esc(r.description || '')}"/></div></div>
        <div class="sheet-actions"><button class="btn btn-primary" data-ok>Salvar</button><button class="btn btn-ghost" data-x>Cancelar</button></div>`);
      $('[data-x]', s.el).onclick = s.close;
      $('[data-ok]', s.el).onclick = () => { r.description = $('#d', s.el).value.trim(); $('#dl').textContent = r.description || 'Adicionar descrição'; s.close(); };
    };
    $('#gen').onclick = async (e) => {
      const btn = e.currentTarget; setLoading(btn, true);
      try { r.qr = await api('/pix/qrcode', { method: 'POST', body: { amount: r.amount, description: r.description } }); go('/receber/qrcode'); }
      catch (err) {
        setLoading(btn, false);
        if (err.data && err.data.error === 'NO_KEY') { toast(err.message); return go('/pix/chaves'); }
        errorModal(err.message);
      }
    };
  });

  // Studio: "Receber | Único | QR Code estático" (modelo comum)
  route('/receber/qrcode', (root) => {
    const r = state.receive;
    if (!r || !r.qr) return go('/receber');
    root.innerHTML = frame(`<header class="hdr hdr--wl"><button class="hdr__icon" id="bk" aria-label="Voltar">${I.chevLeft}</button><span class="logo">${LOGO('#7664FA', 104)}</span><span class="hdr__icon"></span></header>
      <div class="scroll"><section class="intro"><h1 class="intro__title intro__title--sm">QR Code gerado</h1><p class="intro__desc">${r.amount ? 'Valor: <strong>' + money(r.amount) + '</strong>' : 'Valor livre'}${r.description ? ' · ' + esc(r.description) : ''}</p></section>
        <section class="body-sec"><div class="qr-box">${r.qr.svg}</div><div class="group"><span class="group__title">Pix Copia e Cola</span><div class="emv">${esc(r.qr.emv)}</div></div>
        <div class="info-box"><span class="info-box-bar"></span><span class="info-box-text">Quando o pagamento chegar, ele aparece no seu extrato.</span></div></section></div>
      <footer class="footbar"><button class="btn btn-primary btn--lg" id="cp">Copiar código</button></footer>`, { studio: '0a001283 QR Code estático (modelo comum)' });
    $('#bk').onclick = () => go('/home');
    $('#cp').onclick = () => copy(r.qr.emv);
  });

  // ============================================================ EXTRATO (Wallet | Extrato + Detalhes)
  const MOV = { PIXPAYMENTOUT: 'Pix enviado', PIXPAYMENTIN: 'Pix recebido', ENTRYCREDIT: 'Crédito em conta', ENTRYDEBIT: 'Débito em conta' };
  route('/extrato', async (root) => {
    if (!(await loadMe())) return go('/login');
    if (!state.me.account) return go('/validacao');
    root.innerHTML = frame(`<header class="hdr hdr--wl"><button class="hdr__icon" id="bk" aria-label="Voltar">${I.chevLeft}</button><span class="logo">${LOGO('#7664FA', 104)}</span><span class="hdr__icon"></span></header>
      <div class="scroll"><section class="intro"><h1 class="intro__title intro__title--sm">Extrato</h1><p class="intro__desc">Últimos 7 dias · Saldo <strong id="bal">…</strong></p></section>
        <section class="body-sec" id="list"><div class="empty">${I.spinner}</div></section></div>`, { studio: '7c2160b2 Extrato (modelo comum; filtros na Fase 2)' });
    $('#bk').onclick = () => go('/home');
    api('/balance').then((b) => { $('#bal').textContent = money(b.amount); }).catch(() => { $('#bal').textContent = 'indisponível'; });
    const { movements } = await api('/statement');
    state.movements = movements;
    if (!movements.length) { $('#list').innerHTML = '<div class="empty">Nenhuma movimentação no período.</div>'; return; }
    let html = '', lastDay = '';
    movements.forEach((m, i) => {
      const d = new Date(String(m.date).replace(' ', 'T'));
      const day = isNaN(d) ? '' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
      if (day !== lastDay) { html += `<div class="day">${esc(day)}</div>`; lastDay = day; }
      html += `<button class="mov" data-i="${i}"><span class="row__icon row__icon--soft">${m.type && m.type.startsWith('PIX') ? I.pix : I.coin}</span>
        <span class="mov__info"><span class="mov__title">${esc(MOV[m.type] || m.description || m.type)}${m.counterpart ? ' · ' + esc(m.counterpart) : ''}</span><span class="mov__sub">${m.pending ? '<span class="tag">Em processamento</span>' : esc(m.status || '')}</span></span>
        <span class="mov__amount mov__amount--${m.direction}">${m.direction === 'in' ? '+ ' : '− '}${money(m.amount)}</span></button>`;
    });
    $('#list').innerHTML = html;
    $$('.mov').forEach((b) => { b.onclick = () => { const m = movements[Number(b.dataset.i)]; if (m.txId) go('/comprovante/' + m.txId); else detail(m); }; });
  });

  // Studio: "Extrato | Detalhes da transação" (modelo comum), para lançamentos sem comprovante de Pix do app
  function detail(m) {
    const s = sheet(`<h2 class="sheet-title">${esc(MOV[m.type] || m.description || 'Lançamento')}</h2><div class="receipt">
      <div class="receipt__row"><span>Valor</span><span>${m.direction === 'in' ? '+ ' : '− '}${money(m.amount)}</span></div>
      <div class="receipt__row"><span>Data</span><span>${fmtDateTime(m.date)}</span></div>
      <div class="receipt__row"><span>Descrição</span><span>${esc(m.description || '')}</span></div>
      <div class="receipt__row"><span>Situação</span><span>${esc(m.status || '')}</span></div>
      <div class="receipt__row"><span>Identificador</span><span>${esc(m.id || '')}</span></div></div>
      <div class="sheet-actions"><button class="btn btn-primary" data-x>Fechar</button></div>`);
    $('[data-x]', s.el).onclick = s.close;
  }

  // ------------------------------------------------------------ início
  route('/', async () => {
    await loadMe();
    go(state.me ? (state.me.account ? '/home' : '/validacao') : '/login');
  });

  window.addEventListener('hashchange', render);
  fetch('/api/config').then((r) => r.json()).then((c) => { state.mode = c.mode; }).catch(() => {}).finally(render);
})();
