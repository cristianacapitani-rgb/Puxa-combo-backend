const express = require('express');
const cors = require('cors');
const mercadopago = require('mercadopago');
require('dotenv').config();

const app = express();

// --- CONFIGURAÇÃO ---
app.use(cors());
app.use(express.json());

// Configura o Mercado Pago (usa token se houver, ou modo teste)
if (process.env.MP_ACCESS_TOKEN) {
  mercadopago.configure({ access_token: process.env.MP_ACCESS_TOKEN });
}

// --- BANCO DE DADOS SIMULADO (Memória) ---
// Nota: Em "serverless", a memória apaga rápido. 
// Para testes rápidos funciona, mas para produção real precisarias de um banco externo.
const db = {
  transactions: new Set() // Evita duplicidade
};

// --- ROTA 1: TESTE (Para saberes se está vivo) ---
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

  // Se não for pagamento, ignora
  if (topic !== 'payment') {
    return res.status(200).send('Ignored');
  }

  try {
    // 1. Evita duplicidade
    if (db.transactions.has(id)) {
      return res.status(200).send('Already processed');
    }

    // 2. Tenta buscar detalhes no Mercado Pago
    let paymentStatus = 'approved'; // Assume aprovado se não tiver token para validar
    let metadata = body.metadata || {}; // Tenta pegar metadata do corpo

    if (process.env.MP_ACCESS_TOKEN && id) {
       try {
         const mpResponse = await mercadopago.payment.get(id);
         const payment = mpResponse.body;
         paymentStatus = payment.status;
         // Tenta ler metadata (external_reference ou metadata direto)
         if (payment.external_reference) {
            try { metadata = JSON.parse(payment.external_reference); } catch(e) {}
         } else if (payment.metadata) {
            metadata = payment.metadata;
         }
       } catch (err) {
         console.error("Erro ao consultar MP:", err.message);
       }
    }

    // 3. Processa se aprovado
    if (paymentStatus === 'approved') {
        console.log("--> PAGAMENTO APROVADO!");
        console.log("--> Cliente:", metadata.user_id || 'Desconhecido');
        console.log("--> Produto:", metadata.product_type || 'Desconhecido');
        
        // Marca como processado
        db.transactions.add(id);
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Erro no Webhook:', error);
    return res.status(500).send('Server Error');
  }
});

// --- EXPORTAÇÃO CRÍTICA PARA A VERCEL ---
// Sem esta linha, dá o erro "Invalid export"
module.exports = app;
