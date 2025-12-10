const mercadopago = require('mercadopago');
const db = require('./db.mock');

// Configuração do MP
mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN || 'TEST-TOKEN-PLACEHOLDER'
});

exports.handleWebhook = async (req, res) => {
  const { query, body } = req;
  
  // O MP envia o ID no query (?id=...) ou no body.data.id dependendo da versão
  const topic = query.topic || body.type;
  const id = query.id || body.data?.id;

  console.log(`[Webhook] Recebido: Tópico: ${topic}, ID: ${id}`);

  // 1. Validar se é pagamento
  if (topic !== 'payment') {
    return res.status(200).send('Ignored: Not a payment');
  }

  try {
    // 2. Idempotência: Verificar se já processamos esse ID
    const alreadyProcessed = await db.transactionExists(id);
    if (alreadyProcessed) {
      console.log(`[Webhook] Pagamento ${id} já processado.`);
      return res.status(200).send('Already processed');
    }

    // 3. Buscar dados atualizados no Mercado Pago
    // Nota: Em prod, descomente a linha abaixo. Usaremos dados mockados se não tiver token.
    let payment;
    if (process.env.MP_ACCESS_TOKEN) {
       const mpResponse = await mercadopago.payment.get(id);
       payment = mpResponse.body;
    } else {
       // Mock para teste sem token real
       console.log("[Aviso] Usando Mock de Pagamento (sem token configurado)");
       payment = {
         status: 'approved',
         external_reference: JSON.stringify({
            user_id: "user_123",
            product_type: "basic", // mude isso para testar: 'pro', 'single_combo_pack5'
         })
       };
    }

    // 4. Verificar se foi aprovado
    if (payment.status !== 'approved') {
      console.log(`[Webhook] Pagamento ${id} não aprovado (Status: ${payment.status})`);
      return res.status(200).send('Not approved');
    }

    // 5. Ler Metadata (external_reference)
    // O MP retorna external_reference como string, precisamos fazer parse
    let metadata = {};
    try {
        metadata = JSON.parse(payment.external_reference);
    } catch (e) {
        console.error("Erro ao ler metadata", e);
        metadata = payment.metadata || {}; // Fallback
    }

    const { user_id, product_type } = metadata;
    console.log(`[Lógica] Processando produto: ${product_type} para usuário: ${user_id}`);

    // 6. Aplicar Lógica de Negócio
    const user = await db.getUser(user_id);

    if (product_type === 'single_combo_pack5') {
        // Creditar +5 combos
        await db.updateUser(user_id, { 
            credits: (user.credits || 0) + 5 
        });
        console.log(`--> Sucesso: +5 Combos creditados.`);

    } else if (product_type === 'basic') {
        // Ativar Plano Básico
        await db.updateUser(user_id, { plan: 'basic' });
        console.log(`--> Sucesso: Plano Básico ativado.`);

    } else if (product_type === 'pro') {
        // Ativar Plano Pro
        await db.updateUser(user_id, { plan: 'pro' });
        console.log(`--> Sucesso: Plano Pro ativado.`);
    }

    // 7. Salvar Transação para evitar duplicidade
    await db.saveTransaction(id, metadata);

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('[Erro Webhook]', error);
    // Retornar 500 faz o MP tentar de novo. Só retorne se for erro de rede/servidor.
    // Se for erro de lógica, retorne 200 para parar o loop.
    return res.status(500).send('Internal Server Error');
  }
};
