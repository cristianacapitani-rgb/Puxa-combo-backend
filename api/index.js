const express = require('express');
const cors = require('cors');
const mercadopago = require('mercadopago');
require('dotenv').config();

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

// --- BANCO DE DADOS SIMULADO (Memória) ---
const db = {
  transactions: new Set() 
};

// --- ROTA 1: TESTE (Health Check) ---
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'online',
    message: 'Servidor Puxa Combos a funcionar!',
    time: new Date().toISOString()
  });
});

// --- ROTA 2: WEBHOOK MERCADO PAGO ---
app.post('/api/webhooks/mercadopago', async (req, res) => {
  const { query, body } = req;
  const topic = query.topic || body.type;
  const id = query.id || body.data?.id;

  console.log(`[Webhook] Recebido: ${topic} | ID: ${id}`);

  if (topic !== 'payment') {
    return res.status(200).send('Ignored');
  }

  try {
    if (db.transactions.has(id)) {
      return res.status(200).send('Already processed');
    }

    let paymentStatus = 'approved'; 
    let metadata = body.metadata || {}; 

    if (process.env.MP_ACCESS_TOKEN && id) {
       try {
         const mpResponse = await mercadopago.payment.get(id);
         const payment = mpResponse.body;
         paymentStatus = payment.status;
         
         if (payment.external_reference) {
            try { metadata = JSON.parse(payment.external_reference); } catch(e) {}
         } else if (payment.metadata) {
            metadata = payment.metadata;
         }
       } catch (err) {
         console.error("Erro ao consultar MP:", err.message);
       }
    }

    if (paymentStatus === 'approved') {
        console.log("--> PAGAMENTO APROVADO!");
        db.transactions.add(id);
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Erro no Webhook:', error);
    return res.status(500).send('Server Error');
  }
});

// --- O SEGREDO (A correção) ---
// Esta linha é obrigatória na Vercel
module.exports = app;
