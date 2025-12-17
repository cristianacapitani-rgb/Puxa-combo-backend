import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.post("/api/webhooks/mercadopago", async (req, res) => {
  try {
    const paymentId =
      req.body?.data?.id || req.query?.["data.id"];

    if (!paymentId) {
      return res.sendStatus(200);
    }

    const payment = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        },
      }
    );

    const data = await payment.json();

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
      console.error("Erro Supabase:", error);
      return res.sendStatus(500);
    }

    console.log("✅ Pagamento salvo:", data.id);
    res.sendStatus(200);
  } catch (err) {
    console.error("Erro webhook:", err);
    res.sendStatus(500);
  }
});
