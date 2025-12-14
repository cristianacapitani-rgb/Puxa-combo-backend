const express = require("express");
const cors = require("cors");
const mercadopago = require("mercadopago");
const { createClient } = require("@supabase/supabase-js");

const app = express();

app.use(cors());
app.use(express.json());

// ==========================
// CONFIG MERCADO PAGO
// ==========================
mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN,
});

// ==========================
// CONFIG SUPABASE
// ==========================
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ==========================
// ROTA TESTE (SAÚDE)
// ==========================
app.get("/", (req, res) => {
  res.send("Backend Puxa Combos está ONLINE!");
});

// ==========================
// FUNÇÃO: CREDITAR 5 COMBOS
// ==========================
async function creditFiveCombosByEmail(email) {
  if (!email) return;

  const { data: user, error } = await supabase
    .from("users")
    .select("id, single_combo_credits")
    .eq("email", email)
    .single();

  if (error || !user) {
    console.log("Usuário não encontrado para email:", email);
    return;
  }

  const currentCredits = user.single_combo_credits || 0;
  const newCredits = currentCredits + 5;

  const { error: updateError } = await supabase
    .from("users")
    .update({ single_combo_credits: newCredits })
    .eq("id", user.id);

  if (updateError) {
    console.log("Erro ao atualizar créditos:", updateError);
  } else {
    console.log(`+5 combos liberados para ${email}`);
  }
}

// ==========================
// WEBHOOK MERCADO PAGO
// ==========================
app.post("/api/webhooks/mercadopago", async (req, res) => {
  try {
    const { type, data } = req.body;

    // Ignora qualquer coisa que não seja pagamento
    if (type !== "payment" || !data?.id) {
      return res.status(200).send("Evento ignorado");
    }

    const paymentId = data.id;

    let payment;
    try {
      const response = await mercadopago.payment.get(paymentId);
      payment = response.response || response.body;
    } catch (err) {
      // Isso acontece em SIMULAÇÃO (ID fake)
      console.log("Pagamento não encontrado (simulação). Ignorado.");
      return res.status(200).send("OK");
    }

    // Só processa se aprovado
    if (payment.status !== "approved") {
      return res.status(200).send("Pagamento não aprovado");
    }

    const email = payment.payer?.email;

    if (!email) {
      console.log("Pagamento aprovado sem email");
      return res.status(200).send("Sem email");
    }

    // REGRA DO PRODUTO:
    // R$19,90 → 5 combos (compra única)
    await creditFiveCombosByEmail(email);

    return res.status(200).send("Pagamento processado");
  } catch (err) {
    console.error("Erro no webhook:", err);
    // Sempre responder 200 para o MP não reenviar
    return res.status(200).send("Erro tratado");
  }
});

// ==========================
// START
// ==========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Servidor rodando na porta", PORT);
});

module.exports = app;
