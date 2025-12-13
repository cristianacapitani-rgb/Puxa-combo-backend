const express = require('express');
const bodyParser = require('body-parser');
const mercadopago = require('mercadopago');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// body parser
app.use(bodyParser.json());

// Mercado Pago
mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN
});

// Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ============================
// FUNÇÃO: +5 COMBOS POR EMAIL
// ============================
async function creditFiveCombosByEmail(email) {
  if (!email) return;

  const { data: user, error } = await supabase
    .from('users')
    .select('id, single_combo_credits')
    .eq('email', email)
    .single();

  if (error || !user) {
    console.log('Usuário não encontrado:', email);
    return;
  }

  const currentCredits = user.single_combo_credits || 0;
  const newCredits = currentCredits + 5;

  const { error: updateError } = await supabase
    .from('users')
    .update({ single_combo_credits: newCredits })
    .eq('id', user.id);

  if (updateError) {
    console.log('Erro ao atualizar créditos:', updateError);
  } else {
    console.log(`+5 combos liberados para ${email}`);
  }
}

// ============================
// WEBHOOK MERCADO PAGO
// ============================
app.post('/api/webhooks/mercadopago', async (req, res) => {
  try {
    const paymentId = req.body?.data?.id;

    if (!paymentId) {
      return res.status(200).send('No payment id');
    }

    const response = await mercadopago.payment.get(paymentId);
    const payment = response.response;

    const status = payment.status;
    const payerEmail = payment.payer?.email;

    console.log('Pagamento recebido:', paymentId, status, payerEmail);

    // 👉 AQUI ESTÁ A REGRA DO PLANO R$19,90
    if (status === 'approved') {
      await creditFiveCombosByEmail(payerEmail);
    }

    res.status(200).send('OK');
  } catch (err) {
    console.error('Erro no webhook:', err);
    res.status(500).send('Erro');
  }
});

// ============================
// HEALTH CHECK
// ============================
app.get('/api', (req, res) => {
  res.send('Backend Puxa Combos está ONLINE!');
});

// start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Servidor rodando');
});

module.exports = app;
