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

    console.log("✅ Pagamento salvo com sucesso:", data.id);
    res.sendStatus(200);
  } catch (err) {
    console.error("Erro no webhook:", err);
    res.sendStatus(500);
  }
});
