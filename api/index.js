// api/index.js
const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const mercadopago = require('mercadopago');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// Precisamos do raw body para verificação HMAC (se usar assinatura)
app.use(bodyParser.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

// Configurações
mercadopago.configurations.setAccessToken(process.env.MP_ACCESS_TOKEN);

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// mapa de planos -> créditos (exemplo)
const PLAN_CREDITS_MAP = {
  'plan-19.90': 10,   // exemplo: ajuste para os seus planos
};

function verifySignature(req) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return true;

  const header = req.get('x-hub-signature') || req.get('X-Hub-Signature');
  if (!header) return false;

  const computed = crypto.createHmac('sha256', secret)
    .update(req.rawBody)
    .digest('hex');

  return computed === header;
}

app.post('/api/webhooks/mercadopago', async (req, res) => {
  try {
    if (process.env.MP_WEBHOOK_SECRET) {
      const ok = verifySignature(req);
      if (!ok) {
        console.warn('Webhook signature mismatch');
        return res.status(401).send('Invalid signature');
      }
    }

    const paymentId = req.body?.data?.id || req.body?.id || (req.body?.resource && req.body.resource.id);
    if (!paymentId) {
      console.log('Webhook recebido sem payment id', req.body);
      return res.status(400).send('No payment id');
    }

    let mpResp;
    try {
      mpResp = await mercadopago.payment.get(paymentId);
    } catch (err) {
      console.error('Erro ao buscar pagamento no MP:', err);
      return res.status(500).send('Error fetching payment');
    }

    const payment = mpResp.body || mpResp.response || mpResp;
    const status = payment.status || payment.payment_status || '';
    const amount = payment.transaction_amount || payment.total_paid_amount || 0;
    const metadata = payment.metadata || {};

    const paymentRecord = {
      id: paymentId,
      status: status,
      amount: amount,
      metadata: metadata,
      raw: payment
    };

    await supabase.from('payments').insert(paymentRecord);

    if (status.toLowerCase() === 'approved') {
      const planKey = metadata.plan;
      const userId = metadata.user_id;

      if (planKey && userId) {
        const creditsToAdd = PLAN_CREDITS_MAP[planKey] || 0;
        if (creditsToAdd > 0) {
          const { data: user, error: userErr } = await supabase
            .from('users')
            .select('single_combo_credits')
            .eq('id', userId)
            .single();

          if (!userErr && user) {
            const newCredits = (user.single_combo_credits || 0) + creditsToAdd;
            await supabase
              .from('users')
              .update({ single_combo_credits: newCredits })
              .eq('id', userId);
          } else {
            console.warn('Usuário não encontrado para creditar:', userErr);
          }
        }
      }
    }

    return res.status(200).send('OK');
  } catch (err) {
    console.error('Erro no webhook handler:', err);
    return res.status(500).send('Internal error');
  }
});

app.get('/api', (req, res) => res.send('Backend Puxa Combos está ONLINE!'));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Listening on', port));

module.exports = app;
