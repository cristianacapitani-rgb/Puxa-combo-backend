// db.mock.js - Simulação de Banco de Dados
// Em produção, substitua isso por PostgreSQL ou Firebase Admin

const db = {
  users: {},
  transactions: new Set(), // Para evitar duplicidade (Idempotência)

  // Busca usuário (simulado)
  getUser: async (userId) => {
    console.log(`[DB] Buscando usuário: ${userId}`);
    return db.users[userId] || { id: userId, plan: 'free', credits: 0 };
  },

  // Atualiza usuário
  updateUser: async (userId, data) => {
    console.log(`[DB] Atualizando usuário ${userId}:`, data);
    db.users[userId] = { ...db.users[userId], ...data };
    return db.users[userId];
  },

  // Verifica se transação já foi processada
  transactionExists: async (paymentId) => {
    return db.transactions.has(paymentId);
  },

  // Salva transação
  saveTransaction: async (paymentId, metadata) => {
    console.log(`[DB] Transação salva: ${paymentId}`, metadata);
    db.transactions.add(paymentId);
  }
};

module.exports = db;
