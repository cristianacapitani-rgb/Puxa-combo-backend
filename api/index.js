const express = require('express');
const cors = require('cors');
const mercadopago = require('mercadopago');

const app = express();

// --- CONFIGURAÇÃO ---
app.use(cors());
app.use(express.json());

// Configura o Mercado Pago
if (process.env.MP_ACCESS_TOKEN) {
  mercadopago.configure({ access_token: process.env.MP_ACCESS_TOKEN });
} else {
  console.log("Aviso: MP_ACCESS_TOKEN não configurado.");
}

// --- ROTA DE TESTE ---
app.get('/', (req, res) => {
  res.status(200).send('✅ Backend Puxa Combos está ONLINE no Render!');
});

// --- ROTA DO WEBHOOK ---
app.post('/api/webhooks/mercadopago', async (req, res) => {
  const { query, body } = req;
  const topic = query.topic || body.type;
  const id = query.id || body.data?.id;

  console.log(`[Webhook] Topic: ${topic} | ID: ${id}`);

  if (topic === 'payment' && id) {
     console.log("--> Pagamento recebido! ID:", id);
  }

  res.status(200).send('OK');
});

// --- O SEGREDO PARA O RENDER ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor a rodar na porta ${PORT}`);
});
