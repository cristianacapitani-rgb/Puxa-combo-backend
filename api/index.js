import mercadopago from "mercadopago";
import { createClient } from "@supabase/supabase-js";

mercadopago.configure({
  access_token: process.env.MERCADOPAGO_ACCESS_TOKEN,
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Health check
  if (req.method === "GET") {
    return res.status(200).json({ ok: true });
  }

  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  try {
    const paymentId =
      req.body?.data?.id ||
      req.query?.["data.id"];

    if (!paymentId) {
      console.log("Webhook sem paymentId");
      return res.status(200).send("ok");
    }

    console.log("🔔 Webhook recebido. Payment ID:", paymentId);

    const payment = await mercadopago.payment.findById(paymentId);
    const data = payment.body;

    console.log("📌 Status:", data.status);
    console.log("💰 Valor:", data.transaction_amount);

    if (data.status !== "approved") {
      return res.status(200).send("Pagamento não aprovado");
    }

    // Procura pagamento pendente com esse valor
    const { data: pendingPayment, error: findError } = await supabase
      .from("payments")
      .select("*")
      .eq("amount", data.transaction_amount)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (findError || !pendingPayment) {
      console.error("❌ Pagamento pendente não encontrado");
      return res.status(200).send("Pagamento não vinculado");
    }

    // Atualiza pagamento
    await supabase
      .from("payments")
      .update({
        status: "approved",
        payment_id: data.id,
        method: data.payment_method_id,
        raw: data,
        received_at: new Date(),
      })
      .eq("id", pendingPayment.id);

    // Libera créditos
    await supabase
      .from("users")
      .update({
        single_combo_credits:
          pendingPayment.credits + pendingPayment.single_combo_credits,
      })
      .eq("id", pendingPayment.user_id);

    console.log("✅ Créditos liberados para usuário:", pendingPayment.user_id);

    return res.status(200).send("ok");
  } catch (err) {
    console.error("🔥 Erro no webhook:", err);
    return res.status(500).send("erro");
  }
}
