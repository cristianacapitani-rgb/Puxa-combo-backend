import mercadopago from "mercadopago";
import { createClient } from "@supabase/supabase-js";

mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN,
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).json({ ok: true });
  }

  try {
    const paymentId =
      req.body?.data?.id || req.query?.["data.id"];

    if (!paymentId) {
      return res.status(200).json({ ignored: true });
    }

    const payment = await mercadopago.payment.findById(paymentId);
    const data = payment.body;

    if (data.status !== "approved") {
      return res.status(200).json({ status: data.status });
    }

    const { error } = await supabase.from("payments").insert([
      {
        payment_id: String(data.id),
        status: data.status,
        amount: data.transaction_amount,
        method: data.payment_method_id,
        raw: data,
      },
    ]);

    if (error) {
      console.error("Supabase error:", error);
      return res.status(500).json({ error });
    }

    return res.status(200).json({ saved: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(500).json({ err });
  }
}
