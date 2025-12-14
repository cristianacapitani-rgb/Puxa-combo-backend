import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pkg from "mercadopago";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ===== MERCADO PAGO =====
pkg.configure({
  access_token: process.env.MP_ACCESS_TOKEN,
});

// ===== SUPABASE =====
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ===== ROTA TESTE =====
app.get("/", (req, res) => {
  res.send("Backend Puxa Combos está ONLINE!");
});

// ===== WEBHOOK MERCADO PAGO =====
app.post("/api/webhooks/mercadopago", async (req, res) => {
  try {
    const { type, data } = req.body;

    if (type !== "payment") {
      return res.sendStatus(200);
    }

    const paymentId = data.id;

    // 🔍 Busca pagamento no Mercado Pago
    const payment = await pkg.payment.findById(paymentId);
    const paymentData = payment.body;

    if (paymentData.status !== "approved") {
      return res.sendStatus(200);
    }

    const email =
      paymentData.payer?.email ||
      paymentData.additional_info?.payer?.email;

    if (!email) {
      console.error("Pagamento sem email");
      return res.sendStatus(200);
    }

    // 🔁 Evita pagamento duplicado
    const { data: existingPayment } = await supabase
      .from("payments")
      .select("id")
      .eq("payment_id", paymentId)
      .single();

    if (existingPayment) {
      return res.sendStatus(200);
    }

    // 👤 Busca ou cria usuário
    let { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (!user) {
      const { data: newUser } = await supabase
        .from("users")
        .insert({
          email,
          single_combo_credits: 5,
          plan: "single",
        })
        .select()
        .single();

      user = newUser;
    } else {
      await supabase
        .from("users")
        .update({
          single_combo_credits:
            (user.single_combo_credits || 0) + 5,
        })
        .eq("id", user.id);
    }

    // 💾 Registra pagamento
    await supabase.from("payments").insert({
      payment_id: paymentId,
      email,
      status: paymentData.status,
    });

    return res.sendStatus(200);
  } catch (error) {
    console.error("Erro no webhook:", error);
    return res.sendStatus(500);
  }
});

// ===== START =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log("Servidor rodando na porta", PORT)
);
