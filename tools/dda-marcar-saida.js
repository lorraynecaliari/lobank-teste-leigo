// Marca no banco do app que um documento saiu do DDA, quando o aviso "Inactive" da Celcoin se perdeu
// e a saída já foi confirmada por fora (ex.: 11/11, LTDA 46013634000180: invoice/register respondeu
// "Nenhuma subscrição ativa encontrada"). Não chama a Celcoin: só grava um aviso do próprio app.
//
// Uso (na raiz do app):  node tools/dda-marcar-saida.js 46013634000180
require('fs').existsSync('.env') && require('fs').readFileSync('.env', 'utf8').split(/\r?\n/).forEach((l) => {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
});
const db = require('../src/db');

const doc = String(process.argv[2] || '').replace(/\D/g, '');
if (doc.length !== 11 && doc.length !== 14) { console.error('Informe o CPF ou CNPJ, só números. Ex.: node tools/dda-marcar-saida.js 46013634000180'); process.exit(1); }
const req = db.prepare('SELECT * FROM dda_requests WHERE document = ? ORDER BY id DESC LIMIT 1').get(doc);
const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
const body = { document: doc, clientRequestId: req ? req.client_request_id : 'manual', subscriptionId: 'manual', status: 'Inactive', error: null,
  source: 'manual: saída confirmada por fora; o aviso da Celcoin não chegou' };
db.prepare('INSERT OR REPLACE INTO dda_events (id, document, type, received_at, data_json) VALUES (?, ?, ?, ?, ?)')
  .run(`manual-${doc}-${Date.now()}`, doc, 'DELETION', now, JSON.stringify(body));
console.log(`Pronto: ${doc} marcado como fora do DDA (${req ? `pedido ${req.client_request_id}` : 'sem pedido no app'}). Abra o DDA no app de novo.`);
