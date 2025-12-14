import express from "express";
import cors from "cors";
import mercadopago from "mercadopago";
import { createClient } from "@supabase/supabase-js";

const app = express();

// ===== CONFIGURAÇÕES =====
app.use(cors());
app.use(express.json());

// Mercado Pago
mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN,
});

// Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ===== ROTA RAIZ (evita Cannot GET /) =====
app.get("/", (req, res) => {
  res.send("Backend Puxa Combos está ONLINE!");
});

// ===== WEBHOOK MERCADO PAGO =====
app.post("/api/webhooks/mercadopago", async (req, res) => {
  try {
    const { type, data } = req.body;

    // Só processa eventos de pagamento
    if (type !== "payment") {
      return res.status(200).send("Evento ignorado");
    }

    const paymentId = data?.id;

    if (!paymentId) {
      return res.status(200).send("Sem payment ID");
    }

    let payment;

    // 🔥 AQUI ESTÁ O AJUSTE IMPORTANTE
    try {
      const response = await mercadopago.payment.get(paymentId);
      payment = response.body;
    } catch (err) {
      console.log("Pagamento não encontrado (simulação do Mercado Pago). Ignorando.");
      return res.status(200).send("OK");
    }

    // Só continua se pagamento aprovado
    if (payment.status !== "approved") {
      return res.status(200).send("Pagamento não aprovado");
    }

    const email = payment.payer?.email;

    if (!email) {
      return res.status(200).send("Pagamento sem email");
    }

    // ===== REGRAS DO PRODUTO =====
    // Compra única: R$19,90 → 5 combos
    const combosComprados = 5;

    // ===== SALVAR / ATUALIZAR NO BANCO =====
    const { data: usuario, error } = await supabase
      .from("usuarios")
      .select("*")
      .eq("email", email)
      .single();

    if (usuario) {
      // Usuário já existe → soma combos
      await supabase
        .from("usuarios")
        .update({
          combos_disponiveis: usuario.combos_disponiveis + combosComprados,
        })
        .eq("email", email);
    } else {
      // Novo usuário
      await supabase.from("usuarios").insert({
        email,
        combos_disponiveis: combosComprados,
      });
    }

    return res.status(200).send("Pagamento processado com sucesso");
  } catch (error) {
    console.error("Erro no webhook:", error);
    return res.status(200).send("Erro tratado");
  }
});

// ===== START =====
export default app;
