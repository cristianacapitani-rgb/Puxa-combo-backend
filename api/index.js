const express = require('express');
const cors = require('cors');
const mercadopago = require('mercadopago');
require('dotenv').config();

const app = express();

// --- CONFIGURAÇÃO ---
app.use(cors());
app.use(express.json());

// Configura o Mercado Pago (se houver token)
if (process.env.MP_ACCESS_TOKEN) {
  mercadopago.configure({ access_token: process.env.MP_ACCESS_TOKEN });
}

// --- BANCO DE DADOS SIMULADO (Memória) ---
const db = { transactions: new Set() };

// --- ROTA DE TESTE (Para veres no navegador) ---
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'online',
    message: 'Servidor Puxa Combos a funcionar corretamente!',
    time: new Date().toISOString()
  });
});

// --- ROTA DO WEBHOOK (Para o Mercado Pago) ---
app.post('/api/webhooks/mercadopago', async (req, res) => {
  const { query, body } = req;
  const topic = query.topic || body.type;
  const id = query.id || body.data?.id;

  console.log(`[Webhook] Recebido: ${topic} | ID: ${id}`);

  if (topic === 'payment' && id) {
     console.log("--> Pagamento detetado! A processar...");
     // Aqui processarias a lógica real
     // Como é Serverless, respondemos rápido para o MP não ficar a tentar de novo
  }

  return res.status(200).json({ success: true });
});

// --- OBRIGATÓRIO PARA VERCEL ---
// Substitui a última linha por isto:
module.exports = (req, res) => {
  return app(req, res);
};
