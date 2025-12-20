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
  if (req.method === "GET") {
    return res.status(200).json({ ok: true });
  }

  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  try {
    const paymentId =
      req.body?.data?.id || req.query?.["data.id"];

    if (!paymentId) {
      return res.status(200).send("ok");
    }

    const payment = await mercadopago.payment.findById(paymentId);
    const data = payment.body;

    if (data.status !== "approved") {
      return res.status(200).send("not approved");
    }

    const amount = Number(data.transaction_amount);

    // Busca o pagamento pending mais recente com esse valor
    const { data: pending, error } = await supabase
      .from("payments")
      .select("*")
      .eq("amount", amount)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !pending) {
      console.error("Pagamento pending não encontrado");
      return res.status(200).send("pending not found");
    }

    // Atualiza pagamento
    await supabase
      .from("payments")
      .update({
        status: "approved",
        payment_id: data.id.toString(),
        method: data.payment_method_id,
        raw: data,
        received_at: new Date(),
      })
      .eq("id", pending.id);

    // Libera créditos
    await supabase
      .from("users")
      .update({
        single_combo_credits:
          pending.credits + pending.single_combo_credits,
      })
      .eq("id", pending.user_id);

    return res.status(200).send("ok");
  } catch (err) {
    console.error("Erro webhook:", err);
    return res.status(500).send("error");
  }
}
