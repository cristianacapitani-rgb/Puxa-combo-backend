const express = require('express');
const cors = require('cors');
const webhookController = require('./webhook.controller');
require('dotenv').config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// 1. Endpoint de Teste (Health Check)
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'online',
    message: 'Webhook Puxa Combos ativo',
    timestamp: new Date().toISOString()
  });
});

// 2. Endpoint do Webhook
app.post('/api/webhooks/mercadopago', webhookController.handleWebhook);

// Inicialização (Local vs Serverless)
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Servidor rodando na porta ${PORT}`);
    });
}

// Export para Vercel
module.exports = app;
