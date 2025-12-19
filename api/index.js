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
  // Health check
  if (req.method === "GET") {
    return res.status(200).json({ status: "online" });
  }

  // Criar pagamento teste R$1
  if (req.method === "POST") {
    try {
      const preference = {
        items: [
          {
            title: "Teste Puxa Combo",
            quantity: 1,
            unit_price: 1.0,
          },
        ],
        notification_url:
          "https://puxa-combo-backend.vercel.app/api/webhook",
        back_urls: {
          success: "https://google.com",
          failure: "https://google.com",
          pending: "https://google.com",
        },
        auto_return: "approved",
      };

      const response = await mercadopago.preferences.create(preference);

      return res.status(200).json({
        checkout_url: response.body.init_point,
        preference_id: response.body.id,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Erro ao criar pagamento" });
    }
  }

  return res.status(405).end();
}
