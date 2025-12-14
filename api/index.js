import express from "express";
import cors from "cors";
import mercadopago from "mercadopago";
import { createClient } from "@supabase/supabase-js";

const app = express();

app.use(cors());
app.use(express.json());

// ===== CONFIGURAÇÕES =====
mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ===== HEALTH CHECK =====
app.get("/", (req, res) => {
  res.send("Backend Puxa Combos está ONLINE!");
});

// ===== COMPRA ÚNICA — 5 COMBOS (R$19,90) =====
app.post("/api/payments/single", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email é obrigatório" });
    }

    const preference = {
      items: [
        {
          title: "5 Combos - Puxa Combo",
          quantity: 1,
          currency_id: "BRL",
          unit_price: 19.9
        }
      ],
      payer: { email },
      notification_url: `${process.env.BASE_URL}/api/webhooks/mercadopago`,
      metadata: {
        email,
        combos: 5,
        type: "single_purchase"
      }
    };

    const response = await mercadopago.preferences.create(preference);

    return res.json({
      checkout_url: response.body.init_point
    });

  } catch (error) {
    console.error("Erro ao criar pagamento:", error);
    return res.status(500).json({ error: "Erro ao criar pagamento" });
  }
});

// ===== WEBHOOK MERCADO PAGO =====
app.post("/api/webhooks/mercadopago", async (req, res) => {
  try {
    const { type, data } = req.body;

    if (type !== "payment") {
      return res.sendStatus(200);
    }

    const payment = await mercadopago.payment.findById(data.id);

    if (payment.body.status !== "approved") {
      return res.sendStatus(200);
    }

    const { email, combos } = payment.body.metadata;

    // verifica se usuário existe
    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (user) {
      await supabase
        .from("users")
        .update({
          single_combo_credits: user.single_combo_credits + combos
        })
        .eq("email", email);
    } else {
      await supabase
        .from("users")
        .insert({
          email,
          single_combo_credits: combos
        });
    }

    return res.sendStatus(200);

  } catch (error) {
    console.error("Erro no webhook:", error);
    return res.sendStatus(500);
  }
});

export default app;
