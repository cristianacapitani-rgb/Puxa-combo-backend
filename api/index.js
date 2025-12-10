const express = require('express');
const cors = require('cors');
const mercadopago = require('mercadopago');
require('dotenv').config();

const app = express();

// --- CONFIGURAÇÃO ---
app.use(cors());
app.use(express.json());

// Configura o Mercado Pago (usa token se houver, senão avisa)
if (process.env.MP_ACCESS_TOKEN) {
  mercadopago.configure({ access_token: process.env.MP_ACCESS_TOKEN });
} else {
  console.log("Aviso: MP_ACCESS_TOKEN não configurado. A rodar em modo teste.");
}

// --- BANCO DE DADOS SIMULADO (Memória) ---
// Em "serverless", a memória limpa-se sozinha, mas serve para testar o webhook agora.
const db = {
  transactions: new Set() 
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

  // Se não for pagamento, ignora (mas responde 200 OK para o MP não ficar a tentar de novo)
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
    let metadata = body.metadata || {}; 

    if (process.env.MP_ACCESS_TOKEN && id) {
       try {
         const mpResponse = await mercadopago.payment.get(id);
         const payment = mpResponse.body;
         paymentStatus = payment.status;
         
         // Tenta ler metadata (às vezes vem em external_reference, às vezes em metadata)
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

// --- O SEGREDO DO SUCESSO NA VERCEL ---
// Esta é a linha que estava a faltar ou a dar erro. 
// Ela diz à Vercel: "Este é o servidor que tens de rodar".
module.exports = app;
