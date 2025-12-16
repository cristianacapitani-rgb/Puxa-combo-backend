import express from "express";
import cors from "cors";
import mercadopago from "mercadopago";

const app = express();
app.use(cors());
app.use(express.json());

mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN,
});

/* ===== STATUS ===== */
app.get("/", (req, res) => {
  res.send("Backend Puxa Combos está ONLINE!");
});

/* ===== CRIAR PAGAMENTO ÚNICO (5 COMBOS) ===== */
app.post("/api/payments/single", async (req, res) => {
  try {
    const { email } = req.body;

    const preference = {
      items: [
        {
          title: "5 Combos - Puxa Combo",
          quantity: 1,
          currency_id: "BRL",
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
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao criar pagamento" });
  }
});

/* ===== RETORNOS DO CHECKOUT ===== */
app.get("/api/payments/success", (req, res) => {
  res.send("Pagamento aprovado");
});

app.get("/api/payments/failure", (req, res) => {
  res.send("Pagamento recusado");
});

app.get("/api/payments/pending", (req, res) => {
  res.send("Pagamento pendente");
});

/* ===== WEBHOOK ===== */
app.post("/api/webhooks/mercadopago", (req, res) => {
  console.log("Webhook recebido:", req.body);
  res.sendStatus(200);
});

/* ===== START ===== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Servidor rodando na porta", PORT);
});
