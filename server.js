import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, 'db.json');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração de CORS Restrita para Produção
const allowedOrigins = ['http://localhost:5501', 'http://127.0.0.1:5501', 'http://localhost:3000', 'http://127.0.0.1:3000'];
app.use(cors({
  origin: function (origin, callback) {
    // Permite requisições sem origin (como mobile apps ou curl) ou dentro da whitelist
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Acesso não permitido por política de CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
})); 

app.use(express.json()); // Habilita parsing nativo de payloads em formato JSON

// Simulação de Middleware de Log Sênior
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} em ${req.url}`);
  next();
});

// Helper para ler do arquivo db.json
function readDatabase() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const defaultData = [
        { id: 101, name: "Dividendos Ações", amount: 450.00, type: "income", cat: "Outros", date: "2026-06-10", status: "paid" },
        { id: 102, name: "Conta de Energia", amount: 185.30, type: "expense", cat: "Moradia", date: "2026-06-12", status: "paid" }
      ];
      fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2), 'utf-8');
      return defaultData;
    }
    const content = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error("Erro ao ler banco de dados local:", error);
    return [];
  }
}

// Helper para escrever no arquivo db.json
function writeDatabase(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error("Erro ao salvar no banco de dados local:", error);
    return false;
  }
}

// --- DECLARAÇÃO DE ROTAS HTTP REST ---

/**
 * GET /api/transactions
 * Retorna todas as movimentações salvas
 */
app.get('/api/transactions', (req, res) => {
  try {
    const transactions = readDatabase();
    return res.status(200).json({
      success: true,
      count: transactions.length,
      data: transactions
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
  const { id, name, amount, type, cat, date, status, recurrent } = req.body;

  // Validação de consistência
  const parsedAmount = parseFloat(amount);
  if (!name || isNaN(parsedAmount) || !type || !cat || !date) {
    return res.status(400).json({
      success: false,
      message: "Falha de validação. Verifique se todos os campos estão preenchidos corretamente."
    });
  }

  const transactions = readDatabase();
  
  const newRecord = {
    id: id || "tx_" + Math.random().toString(36).substr(2, 9),
    name,
    amount: parsedAmount,
    type,
    cat,
    date,
    recurrent: !!recurrent,
    status: status || "paid"
  };

  transactions.unshift(newRecord); // Insere no início do array
  writeDatabase(transactions);

  return res.status(201).json({
    success: true,
    message: "Lançamento inserido com sucesso na base de dados.",
    data: newRecord
  });
});

/**
 * PUT /api/transactions/:id
 * Atualiza um lançamento financeiro existente
 */
app.put('/api/transactions/:id', (req, res) => {
  const { id } = req.params;
  const { name, amount, type, cat, date, status, recurrent } = req.body;

  const parsedAmount = parseFloat(amount);
  if (!name || isNaN(parsedAmount) || !type || !cat || !date) {
    return res.status(400).json({
      success: false,
      message: "Falha de validação para atualização."
    });
  }

  const transactions = readDatabase();
  // Compara ID como string ou número
  const index = transactions.findIndex(t => String(t.id) === String(id));

  if (index === -1) {
    return res.status(404).json({
      success: false,
      message: "Lançamento não encontrado."
    });
  }

  transactions[index] = {
    ...transactions[index],
    name,
    amount: parsedAmount,
    type,
    cat,
    date,
    recurrent: !!recurrent,
    status: status || "paid"
  };

  writeDatabase(transactions);

  return res.status(200).json({
    success: true,
    message: "Lançamento atualizado com sucesso.",
    data: transactions[index]
  });
});

/**
 * DELETE /api/transactions/:id
 * Exclui um lançamento financeiro
 */
app.delete('/api/transactions/:id', (req, res) => {
  const { id } = req.params;
  const transactions = readDatabase();
  const index = transactions.findIndex(t => String(t.id) === String(id));

  if (index === -1) {
    return res.status(404).json({
      success: false,
      message: "Lançamento não encontrado para exclusão."
    });
  }

  const deleted = transactions.splice(index, 1);
  writeDatabase(transactions);

  return res.status(200).json({
    success: true,
    message: "Lançamento excluído com sucesso.",
    data: deleted[0]
  });
});

// --- MIDDLEWARE DE ERRO GLOBAL ---
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