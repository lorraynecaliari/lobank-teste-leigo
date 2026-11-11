require('dotenv').config();
const path = require('path');
const express = require('express');

const celcoin = require('./src/celcoin');
const api = require('./src/api');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '50kb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' https://viacep.com.br; frame-ancestors 'none'");
  next();
});
app.use('/api', require('./src/evidence').middleware, api);
app.use('/fonts', express.static(path.join(__dirname, 'node_modules', '@fontsource', 'inter', 'files'), { maxAge: '7d' }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const port = Number(process.env.PORT) || 3000;
if (require.main === module) {
  app.listen(port, () => {
    console.log(`LoBank rodando em http://localhost:${port}`);
    console.log(celcoin.MODE === 'mock'
      ? 'ATENÇÃO: MODO SIMULADO (CELCOIN_MODE=mock). Nada aqui fala com a Celcoin.'
      : `Integração: Celcoin sandbox (${celcoin.BASE_URL})`);
    const ev = require('./src/evidence');
    if (ev.ENABLED) console.log(`Evidências ligadas: cada chamada à Celcoin é gravada, mascarada, em ${ev.DIR}`);
  });
}

module.exports = app;
