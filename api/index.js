// api/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mercadopago = require('mercadopago');

const app = express();
// Para validação de assinatura do webhook, às vezes precisamos do raw body.
// Para agora mantemos JSON normal; se for necessário validar assinatura,
// acrescentamos middleware de raw-body.
app.use(cors());
app.use(express.json());

// --- CONFIGURAÇÃO MP ---
if (process.env.MP_ACCESS_TOKEN) {
  mercadopago.configure({ access_token: process.env.MP_ACCESS_TOKEN });
  console.log('MercadoPago configurado ✔');
} else {
  console.warn("Aviso: MP_ACCESS_TOKEN não configurado.");
}

// HEALTH CHECK (rota pública)
app.get('/', (req, res) => {
  res.status(200).send('✅ Backend Puxa Combos está ONLINE!');
});

// WEBHOOK ROUTE (Mercado Pago)
app.post('/api/webhooks/mercadopago', async (req, res) => {
  try {
    const topic = req.query.topic || req.body.type;
    const id = req.query.id || req.body.data?.id || req.body.id;

    console.log(`[Webhook] Topic: ${topic} | ID: ${id} | body keys: ${Object.keys(req.body).join(',')}`);

    if (topic === 'payment' && id) {
      // Exemplo simples: buscar dados do pagamento via SDK (opcional)
      try {
        const payment = await mercadopago.payment.findById(Number(id));
        console.log('--> payment status:', payment.body.status);
        // Aqui: salvar/atualizar no banco de dados real (INSERT/UPDATE)
        // Ex: await savePaymentToDB(payment.body);
      } catch (err) {
        console.warn('Não foi possível buscar pagamento via SDK:', err.message || err);
      }
    }

    // Sempre responder 200 rápido para evitar reenvio por parte do MP
    return res.status(200).send('OK');
  } catch (err) {
    console.error('Erro no webhook:', err);
    // Responder 500 se der pau — o MP tentará reenviar mais tarde
    return res.status(500).send('ERROR');
  }
});

// --- Export para serverless (Vercel) ou para uso tradicional ---
// Se estiver rodando como módulo (serverless), exporta o app
module.exports = app;

// Se executado diretamente (node api/index.js) então liga o servidor (modo dev)
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Servidor Puxa Combos (dev) a rodar na porta ${PORT}`);
  });
}
