import mercadopago from "mercadopago";
import { createClient } from "@supabase/supabase-js";

// ================== CONFIGURAÇÕES ==================
mercadopago.configure({
  access_token: process.env.MERCADOPAGO_ACCESS_TOKEN,
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ================== HANDLER ==================
export default async function handler(req, res) {
  // --------- Health check ---------
  if (req.method === "GET") {
    return res.status(200).json({ ok: true });
  }

  // --------- Webhook Mercado Pago ---------
  if (req.method === "POST") {
    try {
      const paymentId =
        req.body?.data?.id || req.query?.["data.id"];

      if (!paymentId) {
        console.log("Webhook sem paymentId");
        return res.status(200).send("ok");
      }

      console.log("🔔 Webhook recebido. Payment ID:", paymentId);

      const payment = await mercadopago.payment.findById(paymentId);
      const data = payment.body;

      console.log("📦 Status:", data.status);

      const { error } = await supabase.from("payments").insert([
        {
          payment_id: data.id.toString(),
          status: data.status,
          amount: data.transaction_amount,
          method: data.payment_method_id,
          raw: data,
        },
      ]);

      if (error) {
        console.error("❌ Erro Supabase:", error);
        return res.status(500).send("Erro ao salvar");
      }

      console.log("✅ Pagamento salvo com sucesso:", data.id);
      return res.status(200).send("ok");
    } catch (err) {
      console.error("🔥 Erro no webhook:", err);
      return res.status(500).send("erro");
    }
  }

  // --------- Método inválido ---------
  return res.status(405).send("Method not allowed");
}
