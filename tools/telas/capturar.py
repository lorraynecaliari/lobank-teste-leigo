"""Captura todas as telas do LoBank no modo simulado e gera o catálogo docs/telas.md.

Uso (na raiz do app):
    python3 tools/telas/capturar.py <pasta-docs-do-repo-main>
    ex.: python3 tools/telas/capturar.py ../lobank-teste-leigo/docs

Precisa de: Node 22.13+, Python 3 com playwright e um Chrome (CHROME=/caminho, padrão /usr/bin/google-chrome).
O servidor sobe sozinho em modo simulado, com banco em memória: nada fala com a Celcoin.

Regra do projeto: toda tela nova entra aqui (um shot(...) no fluxo certo) e o catálogo é gerado de novo
no mesmo commit da tela. A lista de rotas que o catálogo ainda não mostra sai no fim do .md.
"""
import os, re, unicodedata, subprocess, sys, time, socket, shutil, glob
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
DOCS = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'docs'))
IMG = os.path.join(DOCS, 'telas')
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')

MODULES = [
    ('acesso', 'Acesso e cadastro PF'),
    ('pj', 'Cadastro PJ (MEI e LTDA)'),
    ('home', 'Home e Minha conta'),
    ('pix', 'Pix: chaves e envio por chave'),
    ('copia', 'Pix Copia e Cola e transferência por agência e conta'),
    ('receber', 'Receber (QR Code)'),
    ('extrato', 'Extrato'),
    ('boleto', 'Pagamento de contas (boleto)'),
]
shots = []   # (modulo, arquivo, titulo, rota)
errors = []

PF = {"cpf": "908.301.661-73", "fullName": "Ana Catálogo Teste", "birthDate": "1990-05-15", "motherName": "Maria Teste",
      "email": "ana@example.com", "phone": "11987650051", "isPep": False, "income": "Até R$ 5.000", "assets": "Até R$ 50.000",
      "profession": "Analista", "password": "senhaForte1", "txPassword": "1234",
      "address": {"postalCode": "01001000", "street": "Praça da Sé", "number": "1", "neighborhood": "Sé", "city": "São Paulo", "state": "SP"}}
EMV_OK = ("00020126580014br.gov.bcb.pix0136af83d12a-d4ca-4cdf-974b-37d25ad2477f520400005303986540510.005802BR"
          "5916Lorrayne Caliari6007Barueri61080645503062070503***630486EE")


def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]; s.close(); return port


def nxt(p, sel='[data-next]'):
    p.click(sel); time.sleep(0.35)  # espera a próxima etapa desenhar antes de digitar


def typ(p, sel, v):
    p.fill(sel, v); p.dispatch_event(sel, 'input'); p.dispatch_event(sel, 'blur')


def make_shot(p, mod):
    count = {}
    def shot(title, wait=0.6):
        time.sleep(wait)
        n = count.setdefault(mod, 0) + 1; count[mod] = n
        plain = unicodedata.normalize('NFKD', title.lower()).encode('ascii', 'ignore').decode()
        slug = re.sub(r'[^a-z0-9]+', '-', plain).strip('-')[:40]
        name = f'{n:02d}-{slug}.png'
        os.makedirs(os.path.join(IMG, mod), exist_ok=True)
        p.screenshot(path=os.path.join(IMG, mod, name))
        route = '#' + p.url.split('#', 1)[1] if '#' in p.url else '/'
        studio = p.evaluate("() => { const m = document.querySelector('main.app'); return m ? m.dataset.studio : '' }") or ''
        shots.append((mod, name, title, re.sub(r'/\d+$', '/:id', route), studio))
    return shot


def section(name, fn, base, browser):
    ctx = browser.new_context(viewport={'width': 360, 'height': 800}, accept_downloads=True)
    p = ctx.new_page()
    p.on('pageerror', lambda e: errors.append(f'{name}: erro de JavaScript: {e}'))
    p.route('https://viacep.com.br/**', lambda r: r.fulfill(status=200, content_type='application/json',
            body='{"logradouro":"Alameda Xingu","bairro":"Alphaville Industrial","localidade":"Barueri","uf":"SP"}'))
    try:
        fn(p, ctx, base, make_shot(p, name))
    except Exception as e:  # segue para o próximo módulo e registra no catálogo
        last = next((s[2] for s in reversed(shots) if s[0] == name), 'antes da primeira tela')
        errors.append(f'{name}, depois de "{last}": {type(e).__name__}: {str(e).splitlines()[0][:160]}')
    ctx.close()


_seq = [100000000]
def new_cpf():
    _seq[0] += 7919
    d = [int(c) for c in str(_seq[0])[-9:]]
    for n in (10, 11):
        v = sum(x * w for x, w in zip(d, range(n, 1, -1))) * 10 % 11
        d.append(0 if v == 10 else v)
    return ''.join(map(str, d))


def with_account(ctx, base, credit=1000, person=None):
    person = dict(person or PF, cpf=new_cpf())  # um CPF por módulo: cada um tem sua conta
    r = ctx.request.post(base + '/api/onboarding/pf', data=person); assert r.ok, r.text()
    ctx.request.post(base + '/api/dev/approve-documentscopy'); ctx.request.get(base + '/api/onboarding/status')
    if credit: ctx.request.post(base + '/api/dev/credit', data={'amount': credit})


# ------------------------------------------------------------------ fluxos
def acesso(p, ctx, base, shot):
    p.goto(base + '/#/login'); shot('Login', 1)
    p.click('#create'); shot('Tipo de conta')
    p.click('#go'); shot('Termos')
    p.click('#acc'); nxt(p); typ(p, '#cpf', '44334191258'); shot('CPF')
    nxt(p); typ(p, '#f', 'Teste Catálogo Completo'); shot('Nome completo')
    nxt(p); typ(p, '#f', '15051990'); shot('Data de nascimento')
    nxt(p); typ(p, '#f', 'Maria Teste'); shot('Nome da mãe')
    nxt(p); shot('Dados financeiros')
    p.click('#income'); p.click('.option-row >> nth=0'); shot('Dados financeiros: escolher renda'); p.click('[data-ok]')
    p.click('#assets'); p.click('.option-row >> nth=1'); p.click('[data-ok]')
    nxt(p); typ(p, '#f', 'Analista'); shot('Profissão')
    nxt(p); p.click('.option >> nth=0'); shot('Pessoa politicamente exposta')
    nxt(p); typ(p, '#f', 'catalogo@example.com'); shot('E-mail')
    nxt(p); typ(p, '#f', '11987650001'); shot('Celular')
    nxt(p); shot('Endereço: buscar ou digitar')
    p.click('#cep'); typ(p, '#f', '06455030'); shot('Endereço: CEP encontrado', 1)
    nxt(p); typ(p, '#num', '350'); typ(p, '#comp', 'Sala 2'); shot('Endereço: número e complemento')
    p.go_back(); time.sleep(0.4); p.go_back(); time.sleep(0.5)
    p.click('#man')
    for k, v in {'#cep': '01001000', '#street': 'Praça da Sé', '#num': '1', '#nb': 'Sé', '#city': 'São Paulo', '#uf': 'SP'}.items():
        typ(p, k, v)
    shot('Endereço manual')
    nxt(p); shot('Senha de acesso')
    typ(p, '#f', 'senhaForte1'); nxt(p); typ(p, '#f', 'senhaForte1'); shot('Confirmar senha')
    nxt(p); typ(p, '#f', '1234'); shot('Senha de transferência')
    nxt(p); shot('Cadastro enviado (espera de 10 s)', 1.5)
    time.sleep(10); p.click('#go'); shot('Validação de identidade', 1.5)


def pj(p, ctx, base, shot):
    p.goto(base + '/#/login'); time.sleep(0.8)
    p.click('#create'); p.click('[data-v=PJ]'); shot('Tipo de conta PJ'); p.click('#go')
    shot('Termos PJ'); p.click('#acc'); nxt(p)
    p.click('[data-v=LTDA]'); shot('Tipo de empresa'); nxt(p)
    typ(p, '#f', '52601815000120'); shot('CNPJ'); p.click('#why'); shot('Por que pedimos o CNPJ'); p.click('[data-x]'); nxt(p)
    typ(p, '#f', 'Padaria Teste LTDA'); shot('Razão social'); nxt(p)
    typ(p, '#f', 'Padaria Teste'); shot('Nome fantasia'); nxt(p)
    p.click('.option-row >> nth=1'); shot('Faturamento'); nxt(p)
    typ(p, '#em', 'contato@padaria.example.com'); typ(p, '#ph', '11987650031'); shot('Contato da empresa'); nxt(p)
    typ(p, '#a-cep', '06455030'); time.sleep(0.6); typ(p, '#a-num', '350'); shot('Endereço da empresa'); nxt(p)
    p.click('[data-v=socio]'); shot('Quem está abrindo a conta'); nxt(p)
    for k, v in [('name', 'Ana Responsável Teste'), ('cpf', '90830166173'), ('birth', '10031985'), ('mother', 'Maria Teste'), ('phone', '11987650011'), ('email', 'ana@example.com')]:
        typ(p, f'#p-{k}', v)
    shot('Seus dados (responsável)'); nxt(p)
    typ(p, '#a-cep', '06455030'); time.sleep(0.6); typ(p, '#a-num', '10'); shot('Seu endereço'); nxt(p)
    shot('Sócios (vazio)'); p.click('#add'); shot('Adicionar sócio PF')
    p.click('#s-pj'); shot('Adicionar sócio PJ'); p.click('#s-pf')
    for k, v in [('name', 'Bruno Sócio Teste'), ('cpf', '31860913903'), ('birth', '01071980'), ('mother', 'Joana Teste'), ('phone', '11987650021'), ('email', 'bruno@example.com'), ('share', '40')]:
        typ(p, f'#s-{k}', v)
    typ(p, '#s-cep', '06455030'); time.sleep(0.6); typ(p, '#s-num', '20')
    p.click('[data-ok]'); shot('Sócios (lista)'); nxt(p)
    typ(p, '#f', 'senhaForte1'); nxt(p); typ(p, '#f', 'senhaForte1'); nxt(p)
    typ(p, '#f', '1234'); nxt(p); shot('Cadastro PJ enviado', 1.5)
    time.sleep(10); p.click('#go'); shot('Validação: link do responsável', 1.5)
    # MEI: só o titular, sem sócios
    p.goto(base + '/#/login'); time.sleep(0.6)
    ctx.clear_cookies(); p.goto(base + '/#/login'); time.sleep(0.6)
    p.click('#create'); p.click('[data-v=PJ]'); p.click('#go'); p.click('#acc'); nxt(p)
    p.click('[data-v=MEI]'); shot('Tipo de empresa: MEI')


def home(p, ctx, base, shot):
    with_account(ctx, base, credit=0)
    p.goto(base + '/#/home'); shot('Home sem saldo', 1.5)
    ctx.request.post(base + '/api/dev/credit', data={'amount': 1000})
    p.reload(); shot('Home', 1.5)
    p.click('#dopix'); shot('Fazer Pix: escolher forma')
    p.reload(); time.sleep(1.5)
    p.click('#menu'); shot('Menu')
    p.goto(base + '/#/minha-conta'); shot('Minha conta', 1.2)
    p.goto(base + '/#/minha-conta/dados'); shot('Meus dados', 1.2)
    p.goto(base + '/#/minha-conta/senhas'); shot('Minhas senhas', 1)


def pix(p, ctx, base, shot):
    with_account(ctx, base)
    p.goto(base + '/#/pix'); shot('Área Pix', 1.2)
    p.goto(base + '/#/pix/chaves'); shot('Minhas chaves (vazio)', 1.2)
    p.click('#new'); shot('Criar chave aleatória'); p.click('[data-ok]'); shot('Minhas chaves', 1.5)
    p.goto(base + '/#/pix/transferir'); time.sleep(1)
    typ(p, '#key', 'naoexiste@example.com'); p.click('#next'); shot('Chave não encontrada', 1)
    typ(p, '#key', 'testepix@celcoin.com.br'); shot('Chave do destinatário'); p.click('#next'); time.sleep(1.2)
    typ(p, '#amt', '2500'); shot('Valor do Pix'); p.click('#next'); shot('Revisão do Pix', 1)
    p.click('#go'); typ(p, '#tp', '1234'); shot('Senha de transferência'); p.click('[data-ok]')
    shot('Pix: consultando em 10 s', 2); time.sleep(11); shot('Pix enviado')
    p.click('#rc'); shot('Comprovante Pix', 1)
    p.goto(base + '/#/pix/transferir'); time.sleep(1)
    typ(p, '#key', 'testepix@celcoin.com.br'); p.click('#next'); time.sleep(1.2)
    typ(p, '#amt', '999999'); p.click('#next'); time.sleep(1); p.click('#go'); shot('Pix: saldo insuficiente', 0.8)


def copia(p, ctx, base, shot):
    with_account(ctx, base)
    p.goto(base + '/#/pix/copia-e-cola'); shot('Copia e Cola', 0.8)
    typ(p, '#emv', '000201xyz' * 7); p.click('#next'); shot('Copia e Cola: código inválido', 0.8)
    typ(p, '#emv', EMV_OK); p.click('#next'); shot('Revisão com valor do QR Code', 1.2)
    p.goto(base + '/#/transferir/conta'); shot('Agência e conta: banco', 1.2)
    typ(p, '#q', 'itau'); shot('Agência e conta: buscar banco', 0.4); p.click("[data-i='60701190']")
    shot('Agência e conta: dados (vazio)', 0.8)
    typ(p, '#nm', 'Bruno Destino'); typ(p, '#doc', '31860913903'); typ(p, '#ag', '1234'); typ(p, '#ac', '1234567'); typ(p, '#ds', 'Aluguel')
    shot('Agência e conta: dados'); p.click('[data-t=mine]'); shot('Agência e conta: minha conta', 0.5); p.click('[data-t=other]'); time.sleep(0.4)
    typ(p, '#nm', 'Bruno Destino'); typ(p, '#doc', '31860913903'); typ(p, '#ag', '1234'); typ(p, '#ac', '1234567'); p.click('#next')
    time.sleep(0.6); p.click('[data-v=CACC]'); shot('Agência e conta: tipo de conta'); p.click('#next'); time.sleep(1)
    typ(p, '#amt', '2000'); p.click('#next'); shot('Agência e conta: revisão', 1)
    p.click('#go'); typ(p, '#tp', '1234'); p.click('[data-ok]'); time.sleep(13); p.click('#rc'); shot('Comprovante por agência e conta', 1)


def receber(p, ctx, base, shot):
    with_account(ctx, base, credit=0)
    ctx.request.post(base + '/api/pix/keys/evp')
    p.goto(base + '/#/receber'); shot('Receber: único ou múltiplos', 1.2)
    p.click('#next'); time.sleep(0.6); typ(p, '#amt', '3990'); shot('Receber: valor')
    p.click('#next'); shot('Receber: revisar cobrança', 0.6); p.click('#gen'); shot('Receber: QR Code', 1.5)
    p.goto(base + '/#/receber'); time.sleep(1); p.click('[data-v=multi]'); p.click('#next'); shot('Receber múltiplos: valor', 0.6)
    p.click('#free'); shot('Receber múltiplos: sem valor fixo', 0.6)


def extrato(p, ctx, base, shot):
    with_account(ctx, base)
    p.goto(base + '/#/extrato'); shot('Extrato vazio', 1.5)
    r = ctx.request.post(base + '/api/pix/lookup', data={'key': 'testepix@celcoin.com.br'}).json()
    t = ctx.request.post(base + '/api/pix/transfer', data={'lookupId': r['lookupId'], 'amount': 30, 'txPassword': '1234'}).json()
    time.sleep(2.5); ctx.request.get(base + f"/api/pix/transfer/{t['txId']}"); p.reload(); shot('Extrato', 1.5)
    p.click('#flt'); time.sleep(0.5); shot('Filtros'); p.click('[data-p=custom]'); shot('Filtros: período personalizado', 0.3)
    p.click('[data-t=out]'); p.click('[data-cat=pix]'); p.click("[data-p='7d']"); p.click('#apply'); shot('Extrato filtrado', 1.2)
    p.click('#dl'); shot('Baixar extrato', 0.4)
    # boleto recusado com débito (como no sandbox em 10/11) e um crédito depois: aparece "Diferença de saldo"
    r = ctx.request.post(base + '/api/bills/authorize', data={'code': '2' * 47}).json()
    t = ctx.request.post(base + '/api/bills/pay', data={'lookupId': r['lookupId'], 'amount': 50, 'txPassword': '1234'}).json()
    time.sleep(1.8); ctx.request.get(base + f"/api/bills/{t['txId']}")
    ctx.request.post(base + '/api/dev/credit', data={'amount': 5})
    p.goto(base + '/#/extrato'); p.reload(); time.sleep(1)
    if p.is_visible('text=Limpar'): p.click('text=Limpar')
    shot('Extrato com diferença de saldo', 1.5)
    p.click('text=Diferença de saldo'); shot('Detalhe da diferença de saldo', 0.6)


def boleto(p, ctx, base, shot):
    with_account(ctx, base)
    p.goto(base + '/#/boleto'); shot('Formas de pagamento', 1)
    p.click('#type'); time.sleep(0.6)
    typ(p, '#code', '2379338128600830135285600006330778984000015000'); shot('Digitar código (incompleto)')
    typ(p, '#code', '23793381286008301352856000063307789840000150001'); p.click('#next'); shot('Código inválido', 1)
    typ(p, '#code', '1' * 47); p.click('#next'); shot('Dados incompletos do banco emissor', 1)
    typ(p, '#code', '00190000090100159000700117369173390420000098888'); p.click('#next'); shot('Confirmar valor: boleto vencido', 1.4)
    p.click('#see'); shot('Confirmar valor: ver mais', 0.4)
    p.goto(base + '/#/boleto/codigo'); time.sleep(0.8)
    typ(p, '#code', '34191570070404695481642042200008290440000032202'); p.click('#next'); time.sleep(1.4)
    typ(p, '#amt', '40000'); shot('Informar valor: fora do intervalo')
    typ(p, '#amt', '31000'); p.click('#next'); shot('Confirmar valor', 1.2)
    p.click('#go'); typ(p, '#tp', '1234'); shot('Senha de transferência'); p.click('[data-ok]')
    shot('Pagamento em processamento', 2); time.sleep(10); shot('Pagamento concluído')
    p.click('#rc'); shot('Comprovante do boleto', 1.5)
    p.goto(base + '/#/boleto/codigo'); time.sleep(0.8)
    typ(p, '#code', '2' * 47); p.click('#next'); time.sleep(1.2)
    p.click('#go'); typ(p, '#tp', '1234'); p.click('[data-ok]'); time.sleep(12.5); shot('Falha no pagamento com valor debitado')
    p.click('#rc'); shot('Comprovante: pagamento não concluído', 1.5)
    p.goto(base + '/#/boleto/codigo'); time.sleep(0.8)
    typ(p, '#code', '23790124009217400000702005449802190400000191577'); p.click('#next'); time.sleep(1.4)
    p.click('#go'); shot('Saldo insuficiente', 0.8)


FLOWS = {'acesso': acesso, 'pj': pj, 'home': home, 'pix': pix, 'copia': copia, 'receber': receber, 'extrato': extrato, 'boleto': boleto}


def all_routes():
    found = set()
    for f in glob.glob(os.path.join(ROOT, 'public', '*.js')):
        for kind, r in re.findall(r"route(_prefix)?\('([^']*)'", open(f, encoding='utf-8').read()):
            found.add(r + (':id' if kind else ''))
    # telas de texto do cadastro PJ são geradas num laço
    return found


def write_md(git_rev):
    shown = {s[3].lstrip('#').split('?')[0] for s in shots}
    missing = sorted(r for r in all_routes() if r not in shown and r not in ('/', '/cadastro'))
    out = ['# Telas do LoBank', '',
           f'Gerado por `tools/telas/capturar.py` (branch `app-rodada-0`, commit `{git_rev}`), no **modo simulado**, em 360 × 800.',
           'Os dados nas telas são fictícios. Para atualizar: `python3 tools/telas/capturar.py ../lobank-teste-leigo/docs`.', '',
           '**Regra:** toda tela nova ou alterada entra no script e este arquivo é gerado de novo no mesmo trabalho.', '']
    out += ['## Módulos', ''] + [f'- [{t}](#{re.sub(r"[^a-z0-9à-ú -]", "", t.lower()).replace(" ", "-")}) ({sum(1 for s in shots if s[0] == m)} telas)' for m, t in MODULES] + ['']
    for mod, title in MODULES:
        items = [s for s in shots if s[0] == mod]
        out += [f'## {title}', '']
        if not items:
            out += ['_Nenhuma tela capturada neste módulo (ver erros no fim)._', '']; continue
        out += ['<table>']
        for k in range(0, len(items), 3):
            row = items[k:k + 3]
            out += ['<tr>' + ''.join(f'<td align="center" valign="top" width="33%"><img src="telas/{m}/{f}" width="240" alt="{t}"><br><b>{t}</b><br><code>{r}</code></td>' for m, f, t, r, _ in row) + '</tr>']
        out += ['</table>', '']
    out += ['## Rotas sem print', '']
    out += ([f'- `{r}`' for r in missing] or ['Todas as rotas do app aparecem no catálogo.']) + ['']
    if errors:
        out += ['## Erros na captura', ''] + [f'- {e}' for e in errors] + ['']
    open(os.path.join(DOCS, 'telas.md'), 'w', encoding='utf-8').write('\n'.join(out))
    return missing


def origem(label):
    """Tela(s) do Studio citadas no data-studio da tela (ids de 8 caracteres)."""
    from evidencias import STUDIO
    ids = [i for i in re.findall(r'\b([0-9a-f]{8})\b', label) if i in STUDIO]
    links = [f'{STUDIO[i][0]} › {STUDIO[i][1]} (`{i}`)' for i in ids]
    if label.startswith('novo') or not ids:
        return 'Tela nova, não existe no Studio' + (f' (no modelo de {", ".join(links)})' if links else '')
    return '; '.join(links)


def write_evidencias(git_rev):
    sys.path.insert(0, os.path.dirname(__file__))
    from evidencias import ALTERACOES, FORA_DO_APP, STUDIO
    pend = []
    out = ['# Evidências de telas', '',
           f'Print de cada tela do LoBank, separado pelas pastas desta pasta `telas/`. Gerado por `tools/telas/capturar.py` '
           f'(branch `app-rodada-0`, commit `{git_rev}`), no **modo simulado** e com dados fictícios.', '',
           'Para cada tela: de qual tela do Studio ela veio (board › tela e o id), **o que foi alterado** em relação ao que '
           'o Studio criou e **o motivo**. No fim de cada tópico ficam as telas do Studio que não entraram no app.', '',
           'Fontes dos motivos: comentários da usuária no Studio, decisões e testes registrados em `docs/friction-log.md`, '
           'e regras da API da Celcoin.', '', '## Tópicos', '']
    out += [f'- [{t}](#{re.sub(r"[^a-z0-9à-ú -]", "", t.lower()).replace(" ", "-")}): pasta `{m}/`' for m, t in MODULES] + ['']
    for mod, title in MODULES:
        out += [f'## {title}', '', f'Pasta: `{mod}/`', '']
        for k, (m, f, t, r, label) in enumerate([s for s in shots if s[0] == mod], 1):
            alt, mot = ALTERACOES.get((m, t), (None, None))
            if alt is None:
                pend.append(f'{m}/{t}'); alt, mot = ('_Sem registro: incluir em tools/telas/evidencias.py._', '—')
            out += [f'### {k}. {t}', '', f'<img src="{m}/{f}" width="260" alt="{t}">', '',
                    f'- **Rota:** `{r}`', f'- **Origem no Studio:** {origem(label)}',
                    f'- **Alterado em relação ao Studio:** {alt}', f'- **Motivo:** {mot}', '']
        fora = FORA_DO_APP.get(mod, [])
        if fora:
            out += ['### Telas do Studio que não entraram no app', '', '| Tela do Studio | Motivo |', '|---|---|']
            out += [f'| {STUDIO[i][0]} › {STUDIO[i][1]} (`{i}`) | {motivo} |' for i, motivo in fora] + ['']
    open(os.path.join(IMG, 'Evidencias de telas.md'), 'w', encoding='utf-8').write('\n'.join(out))
    return pend


def main():
    port = free_port()
    env = dict(os.environ, CELCOIN_MODE='mock', DATABASE_FILE=':memory:', PORT=str(port))
    srv = subprocess.Popen(['node', 'server.js'], cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
    base = f'http://127.0.0.1:{port}'
    try:
        for _ in range(50):
            try: socket.create_connection(('127.0.0.1', port), 0.2).close(); break
            except OSError: time.sleep(0.1)
        only = os.environ.get('SO_MODULO')  # para depurar um módulo; não regrava o catálogo
        target = os.path.join(IMG, only) if only else IMG
        if os.path.isdir(target): shutil.rmtree(target)
        with sync_playwright() as pw:
            b = pw.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
            for mod, _ in MODULES:
                if only and mod != only: continue
                print('capturando', mod, flush=True)
                section(mod, FLOWS[mod], base, b)
            b.close()
    finally:
        srv.terminate()
    if os.environ.get('SO_MODULO'):
        print(f'{len(shots)} telas em {os.environ["SO_MODULO"]}; erros: {errors}'); return
    rev = subprocess.run(['git', 'rev-parse', '--short', 'HEAD'], cwd=ROOT, capture_output=True, text=True).stdout.strip() or '?'
    missing = write_md(rev)
    pend = write_evidencias(rev)
    print(f'{len(shots)} telas; rotas sem print: {missing}; erros: {errors}; sem texto de evidência: {pend}')


if __name__ == '__main__':
    main()
