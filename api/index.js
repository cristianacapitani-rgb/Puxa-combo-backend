import express from "express";
import mercadopago from "mercadopago";
import { createClient } from "@supabase/supabase-js";

// ======================
// CONFIG BÁSICA
// ======================
const app = express();
app.use(express.json());

// ======================
// MERCADO PAGO
// ======================
mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN,
});

// ======================
// SUPABASE
// ======================
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ======================
// CRIAR CHECKOUT
// ======================
app.post("/api/payments/create", async (req, res) => {
  try {
    const { email } = req.body;

    const preference = {
      items: [
        {
          title: "Puxa Combo - Plano Avulso",
          quantity: 1,
          unit_price: 19.9,
        },
      ],
      payer: {
        email,
      },
      back_urls: {
        success: "https://puxa-combo-backend.vercel.app/api/payments/success",
        failure: "https://puxa-combo-backend.vercel.app/api/payments/failure",
        pending: "https://puxa-combo-backend.vercel.app/api/payments/pending",
      },
      auto_return: "approved",
      notification_url:
        "https://puxa-combo-backend.vercel.app/api/webhooks/mercadopago",
    };

    const response = await mercadopago.preferences.create(preference);

    res.json({
      checkout_url: response.body.init_point,
      preference_id: response.body.id,
    });
  } catch (err) {
    console.error("Erro ao criar checkout:", err);
    res.status(500).json({ error: "Erro ao criar pagamento" });
  }
});

// ======================
// RETORNOS DO CHECKOUT
// ======================
app.get("/api/payments/success", (req, res) => {
  res.send("Pagamento aprovado");
});

app.get("/api/payments/failure", (req, res) => {
  res.send("Pagamento recusado");
});

app.get("/api/payments/pending", (req, res) => {
  res.send("Pagamento pendente");
});

// ======================
// WEBHOOK MERCADO PAGO
// ======================
app.post("/api/webhooks/mercadopago", async (req, res) => {
  try {
    const paymentId =
      req.body?.data?.id || req.query?.["data.id"];

    if (!paymentId) {
      return res.sendStatus(200);
    }

    const payment = await mercadopago.payment.findById(paymentId);
    const data = payment.body;

    if (data.status !== "approved") {
      return res.sendStatus(200);
    }

    const { error } = await supabase
      .from("payments")
      .insert([
        {
          payment_id: data.id.toString(),
          status: data.status,
          amount: data.transaction_amount,
          method: data.payment_method_id,
          raw: data,
        },
      ]);

    if (error) {
      console.error("Erro ao salvar pagamento:", error);
      return res.sendStatus(500);
    }

    console.log("✅ Pagamento salvo:", data.id);
    res.sendStatus(200);
  } catch (err) {
    console.error("Erro no webhook:", err);
    res.sendStatus(500);
  }
});

// ======================
// EXPORT PARA VERCEL
// ======================
export default app;
