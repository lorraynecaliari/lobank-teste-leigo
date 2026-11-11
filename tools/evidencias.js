#!/usr/bin/env node
// Monta um relatório de evidências (Markdown) a partir de data/evidencias/AAAA-MM-DD.jsonl.
// As chamadas aparecem agrupadas pela ação no app (rota do app) e por pedido, na ordem em que
// aconteceram. Os dados já foram mascarados na gravação.
//
// Uso:
//   node tools/evidencias.js                      # dia de hoje (horário de Brasília)
//   node tools/evidencias.js 2026-11-11           # um dia
//   node tools/evidencias.js 2026-11-11 --rota pix  # só ações do app que contenham "pix"
//   node tools/evidencias.js 2026-11-11 --saida relatorio.md
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const day = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)) || new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const filter = (opt('--rota') || '').toLowerCase();
const dir = process.env.EVIDENCIAS_DIR || path.join(__dirname, '..', 'data', 'evidencias');
const file = path.join(dir, `${day}.jsonl`);
const out = opt('--saida') || path.join(dir, `relatorio-${day}${filter ? '-' + filter.replace(/[^a-z0-9]+/g, '-') : ''}.md`);

if (!fs.existsSync(file)) {
  console.error(`Nenhuma evidência em ${file}. Ligue EVIDENCIAS=1 no .env, reinicie o app e faça os fluxos.`);
  process.exit(1);
}

const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => {
  try { return JSON.parse(l); } catch (_) { return null; }
}).filter(Boolean).filter((l) => !filter || String(l.rotaDoApp).toLowerCase().includes(filter));

const real = lines.filter((l) => l.modo === 'sandbox').length;
const mock = lines.length - real;
const block = (obj) => (obj === undefined ? '_(sem corpo)_' : '```json\n' + JSON.stringify(obj, null, 2) + '\n```');
const hora = (ts) => String(ts).slice(11, 19);

let md = `# Evidências de chamadas do app LoBank à Celcoin (${day})\n\n`;
md += `Gerado em ${new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 19).replace('T', ' ')} (horário de Brasília) a partir de \`data/evidencias/${day}.jsonl\`.\n\n`;
md += `- Chamadas registradas: **${lines.length}** (sandbox real: ${real}; modo simulado: ${mock})\n`;
md += `- Origem: servidor do app (\`src/celcoin.js\`). Dados sensíveis mascarados na gravação; token e credenciais nunca entram.\n`;
if (mock) md += `- **Atenção:** linhas com modo \`mock\` são do modo simulado e **não valem como evidência** de integração.\n`;
md += '\n';

// Agrupa por pedido do app, na ordem do primeiro registro.
const groups = new Map();
for (const l of lines) {
  const key = l.pedidoDoApp || `sem-pedido-${groups.size}`;
  if (!groups.has(key)) groups.set(key, { rota: l.rotaDoApp, inicio: l.registradoEm, itens: [] });
  groups.get(key).itens.push(l);
}

const byRoute = new Map();
for (const [id, g] of groups) {
  if (!byRoute.has(g.rota)) byRoute.set(g.rota, []);
  byRoute.get(g.rota).push({ id, ...g });
}

md += '## Índice\n\n| Ação no app | Pedidos | Chamadas |\n| --- | --- | --- |\n';
for (const [rota, gs] of byRoute) md += `| \`${rota}\` | ${gs.length} | ${gs.reduce((n, g) => n + g.itens.length, 0)} |\n`;
md += '\n';

for (const [rota, gs] of byRoute) {
  md += `## \`${rota}\`\n\n`;
  for (const g of gs) {
    md += `### Pedido ${g.id} (${hora(g.inicio)})\n\n`;
    for (const l of g.itens) {
      const status = l.statusHttp !== undefined ? `HTTP ${l.statusHttp}` : 'sem resposta';
      md += `**${hora(l.registradoEm)} · ${l.celcoin.metodo} \`${l.celcoin.rota}\` · ${status} · ${l.duracaoMs ?? '?'} ms · modo ${l.modo}**\n\n`;
      if (l.erro) md += `Erro: ${l.erro}\n\n`;
      if (l.correlacao && Object.keys(l.correlacao).length) md += `Correlação: ${Object.entries(l.correlacao).map(([k, v]) => `\`${k}\`=\`${v}\``).join(', ')}\n\n`;
      md += `Requisição:\n\n${block(l.requisicao)}\n\nResposta:\n\n${block(l.resposta)}\n\n`;
    }
  }
}

fs.writeFileSync(out, md);
console.log(`Relatório gravado em ${out} (${lines.length} chamadas; sandbox real: ${real}; simulado: ${mock}).`);
