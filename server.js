import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração de CORS Restrita para Produção
const allowedOrigins = ['http://localhost:5501', 'http://127.0.0.1:5501'];
app.use(cors({
  origin: function (origin, callback) {
    // Permite requisições sem origin (como mobile apps ou curl) ou dentro da whitelist
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Acesso não permitido por política de CORS'));
    }
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
})); 

app.use(express.json()); // Habilita parsing nativo de payloads em formato JSON

// Simulação de Middleware de Log Sênior
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} em ${req.url}`);
  next();
});

// Banco de dados em memória temporária (Simulação Sênior)
let databaseTransactions = [
  { id: "101", name: "Dividendos Ações", amount: 450.00, type: "income", cat: "Outros", date: "2026-06-10" },
  { id: "102", name: "Conta de Energia", amount: 185.30, type: "expense", cat: "Moradia", date: "2026-06-12" }
];

// --- DECLARAÇÃO DE ROTAS HTTP REST ---

/**
 * GET /api/transactions
 * Retorna todas as movimentações salvas de forma segura
 */
app.get('/api/transactions', (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      count: databaseTransactions.length,
      data: databaseTransactions
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Erro interno ao processar dados." });
  }
});

/**
 * POST /api/transactions
 * Registra uma nova movimentação financeira vinda do painel
 */
app.post('/api/transactions', (req, res) => {
  const { name, amount, type, cat, date } = req.body;

  // Validação explícita de consistência dos dados
  const parsedAmount = parseFloat(amount);
  if (!name || isNaN(parsedAmount) || !type || !cat || !date) {
    return res.status(400).json({
      success: false,
      message: "Falha de validação. Verifique se todos os campos estão preenchidos corretamente."
    });
  }

  const newRecord = {
    id: "tx_" + Math.random().toString(36).substr(2, 9),
    name,
    amount: parsedAmount,
    type,
    cat,
    date
  };

  databaseTransactions.unshift(newRecord); // Insere no início do array

  return res.status(201).json({
    success: true,
    message: "Lançamento inserido com sucesso na base de dados.",
    data: newRecord
  });
});

// --- MIDDLEWARE DE ERRO GLOBAL (SENIOR PRACTICE) ---
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${err.stack}`);
  res.status(500).json({
    success: false,
    message: "Ocorreu um erro interno no servidor. Tente novamente mais tarde."
  });
});

// Inicialização ativa do servidor Node
app.listen(PORT, () => {
  console.log(`🚀 Servidor Finanças Pro rodando com sucesso na porta ${PORT}`);
});