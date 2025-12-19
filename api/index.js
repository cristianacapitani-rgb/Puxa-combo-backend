<!DOCTYPE html>
<html>
  <body>
    <h2>Teste de pagamento</h2>

    <button onclick="pagar()">Pagar R$ 1,00</button>

    <script>
      async function pagar() {
        const res = await fetch(
          "https://puxa-combo-backend.vercel.app/api/payments/single",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: "teste@puxacombo.com"
            })
          }
        );

        const data = await res.json();
        console.log(data);

        if (data.checkout_url) {
          window.location.href = data.checkout_url;
        } else {
          alert("Erro ao gerar pagamento");
        }
      }
    </script>
  </body>
</html>
