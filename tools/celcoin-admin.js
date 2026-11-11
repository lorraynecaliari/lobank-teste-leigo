#!/usr/bin/env node
// Operações administrativas do LoBank na Celcoin (sandbox), feitas pelo próprio cliente do app
// (src/celcoin.js), com o mesmo registro de evidências (EVIDENCIAS=1 no .env).
//
//   node tools/celcoin-admin.js contas [AAAA-MM-DD] [AAAA-MM-DD]        lista contas PF (fetch-all)
//   node tools/celcoin-admin.js webhooks-baas listar                    inscrições do BaaS
//   node tools/celcoin-admin.js webhooks-baas cadastrar <url> [entidades]  cadastra (escrita no sandbox)
//   node tools/celcoin-admin.js webhooks-dda listar                     URLs do DDA (webhook/routes)
//   node tools/celcoin-admin.js webhooks-dda cadastrar <url>            Subscription, Deletion e Invoice (escrita)
//
// As escritas só rodam com --sim (confirmação explícita). Nada de segredo é impresso.
require('dotenv').config();
const celcoin = require('../src/celcoin');
const evidence = require('../src/evidence');

const BAAS_ENTITIES = ['onboarding-create', 'pix-payment-out', 'pix-payment-in', 'pix-reversal-out', 'pix-reversal-in'];
const ymdBr = (ms) => new Date(ms - 3 * 3600e3).toISOString().slice(0, 10);
const show = (label, data) => console.log(`${label}\n${JSON.stringify(evidence.mask(data), null, 2)}`);

async function main(argv) {
  const [cmd, sub, ...rest] = argv;
  const yes = rest.includes('--sim') || argv.includes('--sim');
  const args = rest.filter((a) => a !== '--sim');
  if (cmd === 'contas') {
    const dateFrom = sub || ymdBr(Date.now() - 6 * 864e5), dateTo = args[0] || ymdBr(Date.now());
    const data = await evidence.run('CLI contas (fetch-all)', () => celcoin.listAccounts({ dateFrom, dateTo }));
    return show(`Contas PF abertas de ${dateFrom} a ${dateTo}:`, data);
  }
  if (cmd === 'webhooks-baas' && sub === 'listar') {
    return show('Inscrições de webhook do BaaS:', await evidence.run('CLI webhooks-baas listar', () => celcoin.listWebhookSubscriptions()));
  }
  if (cmd === 'webhooks-baas' && sub === 'cadastrar') {
    const [url, ...ents] = args;
    if (!url) throw new Error('Informe a URL que vai receber os avisos.');
    if (!yes) return console.log(`Escrita no sandbox: cadastraria ${(ents.length ? ents : BAAS_ENTITIES).join(', ')} para ${url}. Repita com --sim para confirmar.`);
    for (const entity of ents.length ? ents : BAAS_ENTITIES) {
      show(`${entity}:`, await evidence.run('CLI webhooks-baas cadastrar', () => celcoin.subscribeWebhook(entity, url)));
    }
    return;
  }
  if (cmd === 'webhooks-dda' && sub === 'listar') {
    return show('URLs cadastradas no DDA:', await evidence.run('CLI webhooks-dda listar', () => celcoin.ddaWebhookRoutes()));
  }
  if (cmd === 'webhooks-dda' && sub === 'cadastrar') {
    const [url] = args;
    if (!url) throw new Error('Informe a URL que vai receber os avisos do DDA.');
    if (!yes) return console.log(`Escrita no sandbox: cadastraria ${celcoin.DDA_WEBHOOK_TYPES.join(', ')} para ${url}. Repita com --sim para confirmar.`);
    for (const t of celcoin.DDA_WEBHOOK_TYPES) show(`${t}:`, await evidence.run('CLI webhooks-dda cadastrar', () => celcoin.ddaWebhookRegister(t, url)));
    return;
  }
  console.log('Uso: contas | webhooks-baas listar|cadastrar <url> [--sim] | webhooks-dda listar|cadastrar <url> [--sim]');
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(`Erro: ${e.code || ''} ${e.message}`);
    process.exitCode = 1;
  });
}
module.exports = { main, BAAS_ENTITIES };
