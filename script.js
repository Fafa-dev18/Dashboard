import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";


const firebaseConfig = {
  apiKey: "AIzaSyDewKbWupwEPSuMRAsuxAjUXjQMRIoZwOo",
  authDomain: "dashboard-10cc5.firebaseapp.com",
  projectId: "dashboard-10cc5",
  storageBucket: "dashboard-10cc5.firebasestorage.app",
  messagingSenderId: "117274376635",
  appId: "1:117274376635:web:f575c93598e3113b62ac9e",
  measurementId: "G-WGVWPE142W",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();


const MO = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const CATS = {
  Moradia: { c: "#3b82f6" },
  Alimentação: { c: "#f59e0b" },
  Transporte: { c: "#8b5cf6" },
  Saúde: { c: "#ef4444" },
  Lazer: { c: "#ec4899" },
  Educação: { c: "#10b981" },
  Salário: { c: "#34d399" },
  Freelance: { c: "#06b6d4" },
  Investimento: { c: "#eab308" },
  Outros: { c: "#64748b" },
};

const GCOLS = ["#34d399", "#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b"];
const defaultAvatar =
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256&auto=format&fit=crop";


let currentUser = null;
let now = new Date(),
  cm = now.getMonth(),
  cy = now.getFullYear(),
  filt = "all";
let dInst = null,
  tInst = null;

let txs = [];
let goals = [];
let budgets = {};
let isSignUpMode = false;

// Modo Planejamento
let isPlanningMode = false;
let backupTxs = [],
  backupBudgets = {},
  backupGoals = [];

// Gráfico de donut
let activeChartMode = "categories"; // "categories" | "rule503020"

// Privacidade
let isPrivacyModeOn = false;

async function saveDataToCloud() {
  if (isPlanningMode) {
    showToast("⚠️ Simulação: Alterações retidas localmente.");
    render();
    return;
  }

  if (txs.length > 0) {
    const last = txs[txs.length - 1];
    if (last.type === "expense" && !last.recurrent) {
      const match = txs.filter(
        (x) =>
          x.name.toLowerCase() === last.name.toLowerCase() &&
          x.amount === last.amount,
      );
      if (match.length === 2) {
        showToast(
          `💡 Lançamento repetido detectado! Considere marcar "${last.name}" como Fixo.`,
        );
      }
    }
  }

  if (!currentUser) return;
  try {
    await setDoc(doc(db, "users_data", currentUser.uid), {
      txs,
      goals,
      budgets,
    });
  } catch (e) {
    console.error("Erro ao salvar:", e);
  }
}

async function loadDataFromCloud(user) {
  try {
    const docSnap = await getDoc(doc(db, "users_data", user.uid));
    if (docSnap.exists()) {
      const data = docSnap.data();
      txs = data.txs || [];
      goals = data.goals || [];
      budgets = data.budgets || {};
    } else {
      txs = [];
      goals = [];
      budgets = {};
      console.warn("Nenhum dado encontrado no Firestore para este usuário.");
    }
    render();
  } catch (e) {
    console.error("Erro ao carregar do Firestore:", e);
  }
}


function brl(n) {
  return (
    "R$\u00a0" +
    (n || 0).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

// Apresenta notificações temporárias na interface de forma elegante
function showToast(msg) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerText = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function mth() {
  return txs.filter((t) => {
    const d = new Date(t.date + "T12:00");
    if (t.recurrent) {
      return (
        cy > d.getFullYear() || (cy === d.getFullYear() && cm >= d.getMonth())
      );
    }
    return d.getMonth() === cm && d.getFullYear() === cy;
  });
}


function renderMetrics() {
  const t = mth();
  const inc = t
    .filter((x) => x.type === "income")
    .reduce((s, x) => s + x.amount, 0);
  const expPuras = t
    .filter((x) => x.type === "expense" && !x.name.startsWith("Aporte:"))
    .reduce((s, x) => s + x.amount, 0);
  const inv = t
    .filter((x) => x.cat === "Investimento" || x.name.startsWith("Aporte:"))
    .reduce((s, x) => s + x.amount, 0);
  const bal = inc - expPuras - inv;

  const vInc = document.getElementById("vInc");
  const vExp = document.getElementById("vExp");
  const vInv = document.getElementById("vInv");
  const vIncC = document.getElementById("vIncC");
  const vExpC = document.getElementById("vExpC");

  if (vInc) vInc.textContent = brl(inc);
  if (vExp) vExp.textContent = brl(expPuras);
  if (vInv) vInv.textContent = brl(inv);
  if (vIncC)
    vIncC.textContent = `${t.filter((x) => x.type === "income").length} entrada(s)`;
  if (vExpC)
    vExpC.textContent = `${t.filter((x) => x.type === "expense" && !x.name.startsWith("Aporte:")).length} saída(s)`;

  const bEl = document.getElementById("vBal");
  const bStat = document.getElementById("vBalStatus");

  if (bEl) {
    bEl.textContent = (bal < 0 ? "-" : "") + brl(Math.abs(bal));
    if (bal >= 0) {
      bEl.style.color = "#34d399";
      if (bStat) {
        bStat.textContent = "Você está operando no verde!";
        bStat.style.color = "#34d399";
      }
    } else {
      bEl.style.color = "#f87171";
      if (bStat) {
        bStat.textContent = "Cuidado! Fluxo negativo.";
        bStat.style.color = "#f87171";
      }
    }
  }

  const poupadoReal = inv + (bal > 0 ? bal : 0);
  const rate = inc > 0 ? (poupadoReal / inc) * 100 : 0;

  const sRateEl = document.getElementById("vSavingsRate");
  if (sRateEl) sRateEl.textContent = `${rate.toFixed(1)}%`;

  const sRateBig = document.getElementById("vSavingsRateBig");
  if (sRateBig) {
    sRateBig.textContent = `${rate.toFixed(1)}%`;
    sRateBig.style.color = rate >= 20 ? "var(--teal)" : "var(--amber)";
  }
  const banner = document.getElementById("savingsRateBanner");
  if (banner)
    banner.style.borderLeftColor = rate >= 20 ? "var(--teal)" : "var(--amber)";

  if (isPrivacyModeOn) applyPrivacyBlurEffects();
}


function renderBudgets() {
  const el = document.getElementById("budgetList");
  if (!el) return;

  const t = mth().filter((x) => x.type === "expense");
  const categories = [
    "Moradia",
    "Alimentação",
    "Transporte",
    "Saúde",
    "Lazer",
    "Educação",
    "Outros",
  ];
  let html = "";

  categories.forEach((cat) => {
    const limit = budgets[cat] || 0;
    if (limit > 0) {
      
      const spent = t
        .filter((x) => x.cat === cat)
        .reduce((s, x) => s + x.amount, 0);
      const pct = Math.min(100, Math.round((spent / limit) * 100));
      let color = "#3b82f6";
      if (pct >= 75 && pct < 100) color = "#eab308";
      if (pct >= 100) color = "#ef4444";

      html += `
        <div class="budget-item">
          <div class="budget-hd">
            <span>${cat}</span>
            <span style="color:${color}; font-weight:600;">${pct}%</span>
          </div>
          <div class="budget-bar"><div class="budget-fill" style="width:${pct}%; background:${color}"></div></div>
          <div class="budget-foot">
            <span>Gasto: ${brl(spent)} / Limite: ${brl(limit)}</span>
            <button class="budget-del" data-cat="${cat}">✕</button>
          </div>
        </div>`;
    }
  });

  el.innerHTML =
    html || '<div class="empty-state">Nenhum teto de gastos definido.</div>';
  el.querySelectorAll(".budget-del").forEach(
    (b) => (b.onclick = () => delBudget(b.dataset.cat)),
  );
}
function renderInsights() {
  const el = document.getElementById("insightsList");
  if (!el) return;

  const t = mth();
  const hoje = new Date();
  const totalDiasMes = new Date(cy, cm + 1, 0).getDate();
  const diasPassados =
    cm === hoje.getMonth() && cy === hoje.getFullYear()
      ? hoje.getDate()
      : totalDiasMes;
  const currentExp = t.filter((x) => x.type === "expense");
  let html = "";

  const byCat = {};
  currentExp.forEach((x) => {
    byCat[x.cat] = (byCat[x.cat] || 0) + x.amount;
  });
  let topCat = "",
    maxSpent = 0;
  Object.keys(byCat).forEach((c) => {
    if (byCat[c] > maxSpent) {
      maxSpent = byCat[c];
      topCat = c;
    }
  });
  if (topCat) {
    html += `<div class="insight-item">🚨 <b>Dreno de Caixa:</b> Maior despesa em <b>${topCat}</b> — ${brl(maxSpent)}.</div>`;
  }

  const inc = t
    .filter((x) => x.type === "income")
    .reduce((s, x) => s + x.amount, 0);
  const fixas = t
    .filter((x) => x.type === "expense" && x.recurrent)
    .reduce((s, x) => s + x.amount, 0);
  if (inc > 0 && fixas > 0) {
    const compPct = Math.round((fixas / inc) * 100);
    if (compPct > 50) {
     
      html += `<div class="insight-item">⚠️ <b>Renda Comprometida:</b> ${compPct}% das receitas travadas em fixos (${brl(fixas)}).</div>`;
    }
  }

  Object.keys(budgets).forEach((cat) => {
    const limit = budgets[cat] || 0;
    const spent = currentExp
      .filter((x) => x.cat === cat)
      .reduce((s, x) => s + x.amount, 0);
    if (limit > 0 && spent > limit) {
      html += `<div class="insight-item" style="color:#f87171;">❌ <b>Limite Excedido:</b> <b>${cat}</b> estourado por ${brl(spent - limit)}!</div>`;
    }
  });
  const pendentes = t.filter(
    (x) => x.type === "expense" && x.status === "pending",
  );
  const totalPendentes = pendentes.reduce((s, x) => s + x.amount, 0);
  if (totalPendentes > 0) {
    html += `<div class="insight-item" style="border-left:4px solid var(--red); background:rgba(251,113,133,0.05);">📅 <b>Contas Pendentes:</b> ${pendentes.length} conta(s) a vencer — ${brl(totalPendentes)}.</div>`;
  }

  Object.keys(budgets).forEach((cat) => {
    const limit = budgets[cat] || 0;
    if (limit > 0) {
      const spent = currentExp
        .filter((x) => x.cat === cat)
        .reduce((s, x) => s + x.amount, 0);
      const pct = (spent / limit) * 100;
      if (pct >= 80 && pct < 100) {
        html += `<div class="insight-item" style="border-left:4px solid var(--amber);">⚠️ <b>Teto de Gastos:</b> ${Math.round(pct)}% do limite de <b>${cat}</b> consumido.</div>`;
      }
    }
  });

  let mesAnt = cm - 1,
    anoAnt = cy;
  if (mesAnt < 0) {
    mesAnt = 11;
    anoAnt--;
  }
  const txsAnt = txs.filter((tx) => {
    const d = new Date(tx.date + "T12:00");
    if (tx.recurrent)
      return (
        anoAnt > d.getFullYear() ||
        (anoAnt === d.getFullYear() && mesAnt >= d.getMonth())
      );
    return d.getMonth() === mesAnt && d.getFullYear() === anoAnt;
  });
  const despesasAnt = txsAnt
    .filter((x) => x.type === "expense" && !x.name.startsWith("Aporte:"))
    .reduce((s, x) => s + x.amount, 0);
  const despesasAtuais = currentExp
    .filter((x) => !x.name.startsWith("Aporte:"))
    .reduce((s, x) => s + x.amount, 0);
  if (despesasAnt > 0) {
    const variacao = ((despesasAtuais - despesasAnt) / despesasAnt) * 100;
    html += `<div class="insight-item" style="border-left:4px solid var(--purple);">📊 <b>Comparativo Mensal:</b> Mês anterior: ${brl(despesasAnt)}. Atual: ${variacao >= 0 ? "🔺 " + variacao.toFixed(1) + "% maior" : "🔻 " + Math.abs(variacao).toFixed(1) + "% menor"}.</div>`;
  }

  const mediaGasto = diasPassados > 0 ? despesasAtuais / diasPassados : 0;
  const projetado = mediaGasto * totalDiasMes;
  const previsaoLivre = inc - projetado;
  if (cm === hoje.getMonth() && cy === hoje.getFullYear()) {
    html += `<div class="insight-item" style="border-left:4px solid var(--blue);">🔮 <b>Previsão do Mês:</b> Média diária de ${brl(mediaGasto)} → despesa estimada de <b>${brl(projetado)}</b> e saldo final de <b>${brl(previsaoLivre)}</b>.</div>`;
  }

  el.innerHTML =
    html || '<div class="empty-state">Sem alertas. Fluxo equilibrado!</div>';
}


function renderDonut() {
  if (activeChartMode === "rule503020") {
    renderDonut503020();
    return;
  }

  const exp = mth().filter((t) => t.type === "expense");
  const by = {};
  exp.forEach((t) => {
    by[t.cat] = (by[t.cat] || 0) + t.amount;
  });
  const lbls = Object.keys(by),
    data = Object.values(by);
  const clrs = lbls.map((l) => (CATS[l] || CATS["Outros"]).c);

  if (dInst) {
    dInst.destroy();
    dInst = null;
  }
  const cv = document.getElementById("donutC");
  const leg = document.getElementById("donutLeg");
  if (!cv) return;

  if (!lbls.length) {
    cv.style.display = "none";
    if (leg)
      leg.innerHTML = '<div class="empty-state">Sem despesas registradas</div>';
    return;
  }
  cv.style.display = "block";
  dInst = new Chart(cv, {
    type: "doughnut",
    data: {
      labels: lbls,
      datasets: [
        { data, backgroundColor: clrs, borderWidth: 0, hoverOffset: 4 },
      ],
    },
    options: {
      responsive: false,
      cutout: "70%",
      plugins: { legend: { display: false } },
    },
  });

  const tot = data.reduce((s, v) => s + v, 0);
  if (leg) {
    leg.innerHTML = lbls
      .map(
        (l, i) => `
      <div class="dl-item">
        <span class="dl-sq" style="background:${clrs[i]}"></span>
        <span>${l}</span>
        <span class="dl-pct">${Math.round((data[i] / tot) * 100)}%</span>
      </div>`,
      )
      .join("");
  }
}

function renderDonut503020() {
  const exp = mth().filter((t) => t.type === "expense");
  let essenciais = 0,
    estiloVida = 0,
    investimentos = 0;
  exp.forEach((t) => {
    if (["Moradia", "Alimentação", "Transporte", "Saúde"].includes(t.cat))
      essenciais += t.amount;
    else if (["Lazer", "Outros", "Educação"].includes(t.cat))
      estiloVida += t.amount;
    else if (t.cat === "Investimento" || t.name.startsWith("Aporte:"))
      investimentos += t.amount;
  });

  const lbls = ["Necessidades (50%)", "Desejos (30%)", "Poupança/Inv. (20%)"];
  const data = [essenciais, estiloVida, investimentos];
  const clrs = ["#3b82f6", "#ec4899", "#34d399"];

  if (dInst) {
    dInst.destroy();
    dInst = null;
  }
  const cv = document.getElementById("donutC");
  const leg = document.getElementById("donutLeg");
  if (!cv) return;

  if (!essenciais && !estiloVida && !investimentos) {
    cv.style.display = "none";
    if (leg)
      leg.innerHTML = '<div class="empty-state">Sem despesas registradas</div>';
    return;
  }
  cv.style.display = "block";
  dInst = new Chart(cv, {
    type: "doughnut",
    data: {
      labels: lbls,
      datasets: [
        { data, backgroundColor: clrs, borderWidth: 0, hoverOffset: 4 },
      ],
    },
    options: {
      responsive: false,
      cutout: "70%",
      plugins: { legend: { display: false } },
    },
  });

  const tot = data.reduce((s, v) => s + v, 0) || 1;
  if (leg) {
    leg.innerHTML = lbls
      .map(
        (l, i) => `
      <div class="dl-item">
        <span class="dl-sq" style="background:${clrs[i]}"></span>
        <span>${l}</span>
        <span class="dl-pct">${Math.round((data[i] / tot) * 100)}%</span>
      </div>`,
      )
      .join("");
  }
}

window.toggleChartMode = function () {
  activeChartMode =
    activeChartMode === "categories" ? "rule503020" : "categories";
  const btn = document.getElementById("btnToggleChart");
  if (btn)
    btn.textContent =
      activeChartMode === "categories"
        ? "🔄 Ver 50/30/20"
        : "🔄 Ver Categorias";
  renderDonut();
};


function renderTrend() {
  const trendCanvas = document.getElementById("trendC");
  if (!trendCanvas) return;

  const lbls = [],
    incs = [],
    exps = [];
  for (let i = 5; i >= 0; i--) {
    let m = cm - i,
      y = cy;
    while (m < 0) {
      m += 12;
      y--;
    }
    lbls.push(MO[m].slice(0, 3));
    const tx = txs.filter((t) => {
      const d = new Date(t.date + "T12:00");
      if (t.recurrent)
        return (
          y > d.getFullYear() || (y === d.getFullYear() && m >= d.getMonth())
        );
      return d.getMonth() === m && d.getFullYear() === y;
    });
    incs.push(
      tx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
    );
    exps.push(
      tx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0),
    );
  }
  if (tInst) {
    tInst.destroy();
    tInst = null;
  }
  tInst = new Chart(trendCanvas, {
    type: "line",
    data: {
      labels: lbls,
      datasets: [
        {
          label: "Receitas",
          data: incs,
          borderColor: "#34d399",
          backgroundColor: "rgba(52,211,153,0.05)",
          borderWidth: 2,
          tension: 0.3,
          fill: true,
        },
        {
          label: "Despesas",
          data: exps,
          borderColor: "#f87171",
          backgroundColor: "transparent",
          borderWidth: 2,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          ticks: { color: "#64748b", font: { size: 10 } },
          grid: { color: "rgba(255,255,255,0.02)" },
        },
        x: { ticks: { color: "#64748b" }, grid: { display: false } },
      },
    },
  });
}


function renderGoals() {
  const el = document.getElementById("goalList");
  if (!el) return;
  if (!goals.length) {
    el.innerHTML = '<div class="empty-state">Nenhuma meta ativa</div>';
    return;
  }

  el.innerHTML = goals
    .map((g, i) => {
      const pct = Math.min(100, Math.round((g.current / g.target) * 100));
      const c = GCOLS[i % GCOLS.length];
      let infoPrazo = "";
      if (g.deadline) {
        const hoje = new Date();
        const dataAlvo = new Date(g.deadline + "T12:00");
        const mesesFalt =
          (dataAlvo.getFullYear() - hoje.getFullYear()) * 12 +
          (dataAlvo.getMonth() - hoje.getMonth());
        if (mesesFalt > 0) {
          const mensal = Math.max(0, g.target - g.current) / mesesFalt;
          infoPrazo = `<div style="font-size:11px;margin-top:4px;color:var(--text-muted);">⏱️ Faltam ${mesesFalt} meses. Aporte sugerido: <b>${brl(mensal)}/mês</b></div>`;
        } else {
          infoPrazo = `<div style="font-size:11px;margin-top:4px;color:var(--red);">⚠️ Prazo atingido ou muito próximo!</div>`;
        }
      }

      return `<div class="goal-item">
      <div class="goal-hd">
        <span class="goal-name"><b>${g.name}</b></span>
        <span style="display:flex;align-items:center;gap:8px">
          <span class="goal-pct" style="color:${c}">${pct}%</span>
          <button class="goal-del" data-index="${i}">✕</button>
        </span>
      </div>
      <div class="goal-bar"><div class="goal-fill" style="width:${pct}%;background:${c}"></div></div>
      <div class="goal-foot" style="flex-direction:column;align-items:flex-start;gap:6px;">
        <div style="display:flex;justify-content:space-between;width:100%;">
          <span class="privacy-blur">${brl(g.current)} / ${brl(g.target)}</span>
          <button class="goal-add-funds" data-index="${i}">＋ Guardar</button>
        </div>
        ${infoPrazo}
      </div>
    </div>`;
    })
    .join("");

  el.querySelectorAll(".goal-add-funds").forEach(
    (b) => (b.onclick = () => openFundModal(b.dataset.index)),
  );
  el.querySelectorAll(".goal-del").forEach(
    (b) => (b.onclick = () => delGoal(b.dataset.index)),
  );
  if (isPrivacyModeOn) applyPrivacyBlurEffects();
}

function openFundModal(index) {
  const goal = goals[index];
  document.getElementById("fundModalTitle").textContent =
    `Aporte para: ${goal.name}`;
  document.getElementById("fundTargetIndex").value = index;
  document.getElementById("fundAmount").value = "";
  document.getElementById("fundModal").classList.add("open");
}

window.confirmGoalFunds = () => {
  const index = document.getElementById("fundTargetIndex").value;
  const amount = parseFloat(document.getElementById("fundAmount").value);
  if (isNaN(amount) || amount <= 0) return alert("Insira um valor válido.");
  goals[index].current += amount;
  txs.push({
    id: Date.now(),
    type: "expense",
    name: `Aporte: ${goals[index].name}`,
    amount,
    cat: "Investimento",
    date: new Date().toISOString().split("T")[0],
    recurrent: false,
    status: "paid",
  });
  saveDataToCloud();
  closeM("fundModal");
  render();
};

function delGoal(i) {
  goals.splice(i, 1);
  saveDataToCloud();
  render();
}


function renderTxs() {
  const el = document.getElementById("txList");
  if (!el) return;

  const list = mth()
    .filter((t) => filt === "all" || t.type === filt)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (!list.length) {
    el.innerHTML = '<li class="empty-state">Sem movimentações este mês</li>';
    return;
  }

  el.innerHTML = list
    .map((t) => {
      const d = new Date(t.date + "T12:00");
      const ds = d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      });
      const clr = t.type === "income" ? "#34d399" : "#f87171";
      const statusBadge =
        t.status === "pending"
          ? '<span class="badge-fixo" style="background:rgba(234,179,8,0.15);color:#eab308;">Pendente</span>'
          : "";
      return `<li class="tx-item">
      <div class="tx-ic" style="background:rgba(${t.type === "income" ? "52,211,153" : "248,113,113"},0.05);color:${clr}"><b>${t.type === "income" ? "↑" : "↓"}</b></div>
      <div class="tx-info">
        <div class="tx-name">${t.name} ${t.recurrent ? '<span class="badge-fixo">Fixo</span>' : ""} ${statusBadge}</div>
        <div class="tx-meta">${t.cat} • ${ds}</div>
      </div>
      <span class="${t.type === "income" ? "tx-in" : "tx-ex"}">${t.type === "income" ? "+" : "-"}${brl(t.amount)}</span>
      <button class="tx-del" data-id="${t.id}">🗑</button>
    </li>`;
    })
    .join("");

  el.querySelectorAll(".tx-del").forEach(
    (b) => (b.onclick = () => delTx(Number(b.dataset.id))),
  );
  window.filterTransactionsAdvanced();
  if (isPrivacyModeOn) applyPrivacyBlurEffects();
}

function delTx(id) {
  txs = txs.filter((t) => t.id !== id);
  saveDataToCloud();
  render();
}


function renderCalendar() {
  const grid = document.getElementById("calendarGrid");
  if (!grid) return;
  grid.innerHTML = "";
  const firstDay = new Date(cy, cm, 1).getDay();
  const totalDays = new Date(cy, cm + 1, 0).getDate();
  const activeTxs = mth();

  for (let i = 0; i < firstDay; i++) {
    const e = document.createElement("div");
    e.classList.add("cal-day", "cal-empty");
    grid.appendChild(e);
  }

  for (let day = 1; day <= totalDays; day++) {
    const dayDiv = document.createElement("div");
    dayDiv.classList.add("cal-day");
    const dayNum = document.createElement("span");
    dayNum.textContent = day;
    dayDiv.appendChild(dayNum);

    const dayEvents = activeTxs.filter(
      (t) => new Date(t.date + "T12:00").getDate() === day,
    );
    if (dayEvents.length > 0) {
      const ic = document.createElement("div");
      const tooltip = document.createElement("div");
      ic.classList.add("cal-indicators");
      tooltip.classList.add("cal-tooltip");
      let tooltipHtml = `<span class="ct-title">Dia ${day} de ${MO[cm]}</span><ul class="ct-list">`;
      dayEvents.forEach((e) => {
        const dot = document.createElement("span");
        dot.classList.add("cal-dot");
        dot.style.backgroundColor = e.type === "income" ? "#34d399" : "#f87171";
        ic.appendChild(dot);
        tooltipHtml += `<li class="ct-item ${e.type === "income" ? "inc" : "exp"}">${e.name.substring(0, 12)}: ${e.type === "income" ? "+" : "-"}${brl(e.amount)}</li>`;
      });
      tooltipHtml += "</ul>";
      tooltip.innerHTML = tooltipHtml;
      dayDiv.appendChild(ic);
      dayDiv.appendChild(tooltip);
    }
    grid.appendChild(dayDiv);
  }
}


function render() {
  const mLbl = document.getElementById("mLbl");
  if (mLbl) mLbl.textContent = `${MO[cm]} ${cy}`;
  renderMetrics();
  renderDonut();
  renderTrend();
  renderGoals();
  renderBudgets();
  renderInsights();
  renderTxs();
  renderCalendar();
}

window.switchTab = function (tabId) {
  render();
};


window.openTM = () => {
  const hoje = new Date();
  document.getElementById("fDt").value = hoje.toISOString().split("T")[0];
  document.getElementById("fNm").value = "";
  document.getElementById("fAm").value = "";
  document.getElementById("fRecurrent").checked = false;

  // OTIMIZAÇÃO UX: Garante que o tipo padrão começa como despesa de forma explícita
  const fTyp = document.getElementById("fTyp");
  if (fTyp) fTyp.value = "expense";

  const fPaid = document.getElementById("fPaid");
  if (fPaid) fPaid.checked = true;

  updateModalCategories();
  document.getElementById("tmModal").classList.add("open");
};

window.openGM = () => {
  document.getElementById("gNm").value = "";
  document.getElementById("gTg").value = "";
  document.getElementById("gCr").value = "";
  const gDl = document.getElementById("gDeadline");
  if (gDl) gDl.value = "";
  document.getElementById("gmModal").classList.add("open");
};

window.closeM = (id) => document.getElementById(id).classList.remove("open");

function updateModalCategories() {
  const typEl = document.getElementById("fTyp");
  const typ = typEl ? typEl.value : "expense";
  const select = document.getElementById("fCt");
  if (!select) return;
  select.innerHTML = "";
  const options =
    typ === "income"
      ? ["Salário", "Freelance", "Investimento", "Outros"]
      : [
          "Moradia",
          "Alimentação",
          "Transporte",
          "Saúde",
          "Lazer",
          "Educação",
          "Outros",
        ];
  options.forEach((o) => {
    const opt = document.createElement("option");
    opt.value = o;
    opt.textContent = o;
    select.appendChild(opt);
  });
}
window.updateModalCategories = updateModalCategories;


window.saveTx = () => {
  const n = document.getElementById("fNm").value.trim();
  const a = parseFloat(document.getElementById("fAm").value);
  const t = document.getElementById("fTyp").value;
  const c = document.getElementById("fCt").value;
  const dt = document.getElementById("fDt").value;
  if (!n || !a || a <= 0 || !dt)
    return alert("Preencha os campos corretamente.");
  const paid = document.getElementById("fPaid")
    ? document.getElementById("fPaid").checked
    : true;
  txs.push({
    id: Date.now(),
    type: t,
    name: n,
    amount: a,
    cat: c,
    date: dt,
    recurrent: document.getElementById("fRecurrent").checked,
    status: paid ? "paid" : "pending",
  });
  saveDataToCloud();
  closeM("tmModal");
  render();
};


window.openBudgetModal = () => {
  document.getElementById("bLmt").value = "";
  document.getElementById("budgetModal").classList.add("open");
};

window.saveBudget = () => {
  const cat = document.getElementById("bCt").value;
  const limit = parseFloat(document.getElementById("bLmt").value);
  if (isNaN(limit) || limit <= 0) return alert("Defina um valor limite real.");
  budgets[cat] = limit;
  saveDataToCloud();
  closeM("budgetModal");
  render();
};

function delBudget(cat) {
  delete budgets[cat];
  saveDataToCloud();
  render();
}

window.saveGoal = () => {
  const n = document.getElementById("gNm").value.trim();
  const t = parseFloat(document.getElementById("gTg").value);
  const c = parseFloat(document.getElementById("gCr").value) || 0;
  const dl = document.getElementById("gDeadline")?.value || "";
  if (!n || t <= 0) return alert("Valores inválidos.");
  goals.push({ name: n, target: t, current: c, deadline: dl });
  saveDataToCloud();
  closeM("gmModal");
  render();
};


window.chgM = (d) => {
  cm += d;
  if (cm > 11) {
    cm = 0;
    cy++;
  }
  if (cm < 0) {
    cm = 11;
    cy--;
  }
  render();
};

window.setF = (f, b) => {
  filt = f;
  document.querySelectorAll(".tf").forEach((x) => x.classList.remove("on"));
  b.classList.add("on");
  renderTxs();
};


document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("fNm")?.addEventListener("input", (e) => {
    const text = e.target.value.toLowerCase();
    const selectCat = document.getElementById("fCt");
    if (!selectCat) return;

    if (/uber|99|combustivel|posto|carro|oficina/i.test(text))
      selectCat.value = "Transporte";
    else if (/mercado|ifood|restaurante|jantar|almoço|padaria/i.test(text))
      selectCat.value = "Alimentação";
    else if (/aluguel|renda|condominio|luz|agua|internet|energia/i.test(text))
      selectCat.value = "Moradia";
    else if (/farmacia|medico|hospital|remedio|consulta/i.test(text))
      selectCat.value = "Saúde";
    else if (/netflix|spotify|cinema|bar|festa|jogos|lazer/i.test(text))
      selectCat.value = "Lazer";
    else if (/curso|faculdade|livro|escola|mensalidade/i.test(text))
      selectCat.value = "Educação";
    else if (/salario|freelance|pix recebido|ted/i.test(text)) {
      const fTyp = document.getElementById("fTyp");
      if (fTyp && fTyp.value !== "income") {
        fTyp.value = "income";
        updateModalCategories();
      }
      selectCat.value = /freelance/i.test(text) ? "Freelance" : "Salário";
    }
  });
});

window.filterTransactionsAdvanced = function () {
  const query =
    document.getElementById("txSearchInput")?.value.toLowerCase() || "";
  document.querySelectorAll("#txList .tx-item").forEach((item) => {
    item.style.display = item.innerText.toLowerCase().includes(query)
      ? "flex"
      : "none";
  });
};


window.togglePrivacyMode = function () {
  isPrivacyModeOn = !isPrivacyModeOn;
  const btn = document.getElementById("btnPrivacy");
  if (btn) btn.textContent = isPrivacyModeOn ? "🕶️" : "👁️";
  applyPrivacyBlurEffects();
};

function applyPrivacyBlurEffects() {
  const targets = document.querySelectorAll(
    "#vInc, #vExp, #vInv, #vBal, .tx-in, .tx-ex, .privacy-blur",
  );
  targets.forEach((el) => {
    el.style.filter = isPrivacyModeOn ? "blur(5px)" : "none";
    el.style.transition = "filter 0.2s ease";
  });
}


window.togglePlanningMode = function () {
  isPlanningMode = !isPlanningMode;
  const btn = document.getElementById("btnPlanning");
  const workspace = document.querySelector(".main-content");

  if (isPlanningMode) {
    backupTxs = JSON.parse(JSON.stringify(txs));
    backupBudgets = JSON.parse(JSON.stringify(budgets));
    backupGoals = JSON.parse(JSON.stringify(goals));
    if (btn) {
      btn.textContent = "🛠️ Modo Planejamento: ON";
      btn.style.background = "rgba(245,158,11,0.2)";
    }
    if (workspace) workspace.style.border = "2px dashed var(--amber)";
    showToast(
      "Modo Planejamento ativado. Simule sem alterar seus dados reais.",
    );
  } else {
    txs = backupTxs;
    budgets = backupBudgets;
    goals = backupGoals;
    if (btn) {
      btn.textContent = "🛠️ Modo Planejamento: OFF";
      btn.style.background = "transparent";
    }
    if (workspace) workspace.style.border = "none";
    showToast("Simulação encerrada. Dados reais restaurados.");
    render();
  }
};


window.exportToCSV = function () {
  const list = mth();
  if (!list.length)
    return alert("Nenhuma movimentação para exportar neste mês.");
  let csv =
    "data:text/csv;charset=utf-8,Data,Descricao,Valor,Tipo,Categoria,Status\n";
  list.forEach((x) => {
    csv += `${x.date},${x.name},${x.amount},${x.type},${x.cat},${x.status || "paid"}\n`;
  });
  const link = document.createElement("a");
  link.setAttribute("href", encodeURI(csv));
  link.setAttribute("download", `Relatorio_${MO[cm]}_${cy}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

window.handleCSVImport = function (event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    const lines = e.target.result.split("\n");
    let added = 0;
    lines.forEach((line, index) => {
      if (index === 0 || !line.trim()) return;
      const col = line.split(",");
      if (col.length >= 4) {
        const d = col[0].trim(),
          n = col[1].trim();
        const am = parseFloat(col[2].trim()),
          t = col[3].trim().toLowerCase();
        const c = col[4] ? col[4].trim() : "Outros";
        if (d && n && !isNaN(am) && (t === "income" || t === "expense")) {
          txs.push({
            id: Date.now() + index,
            type: t,
            name: n,
            amount: am,
            cat: CATS[c] ? c : "Outros",
            date: d,
            recurrent: false,
            status: "paid",
          });
          added++;
        }
      }
    });
    if (added > 0) {
      showToast(`📥 ${added} transações importadas com sucesso!`);
      saveDataToCloud();
      render();
    } else {
      alert(
        "Nenhum registro válido. Formato esperado:\nAAAA-MM-DD,Descrição,Valor,income|expense,Categoria",
      );
    }
  };
  reader.readAsText(file);
};


document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("pLocalFile")) {
    const localInput = document.createElement("input");
    localInput.type = "file";
    localInput.id = "pLocalFile";
    localInput.accept = "image/*";
    localInput.style.display = "none";
    document.body.appendChild(localInput);

    localInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file || !currentUser) return;
      if (!file.type.startsWith("image/"))
        return alert("Selecione apenas arquivos de imagem.");
      try {
        const userDisplay = document.getElementById("userDisplay");
        if (userDisplay) userDisplay.textContent = "Enviando foto...";
        const storageRef = ref(storage, `users/${currentUser.uid}/avatar.jpg`);
        await uploadBytes(storageRef, file);
        const uploadedUrl = await getDownloadURL(storageRef);

        const pPhoto = document.getElementById("pPhoto");
        const pmAvatar = document.getElementById("profileModalAvatar");
        if (pPhoto) pPhoto.value = uploadedUrl;
        if (pmAvatar) pmAvatar.src = uploadedUrl;
        if (userDisplay)
          userDisplay.textContent = currentUser.displayName || "Usuário";
      } catch (err) {
        console.error(err);
        alert("Erro ao fazer upload: " + err.message);
      }
    };
  }

  const pma = document.getElementById("profileModalAvatar");
  if (pma) pma.onclick = () => document.getElementById("pLocalFile")?.click();

  const umt = document.getElementById("userMenuTrigger");
  if (umt) {
    umt.onclick = function (e) {
      e.stopPropagation();
      document.getElementById("userDropdown")?.classList.toggle("show");
    };
  }
});

window.openProfileModal = () => {
  if (!currentUser) return alert("Nenhum usuário conectado.");
  document.getElementById("pName").value = currentUser.displayName || "";
  document.getElementById("pPhoto").value = currentUser.photoURL || "";
  document.getElementById("profileModalAvatar").src =
    currentUser.photoURL || defaultAvatar;
  document.getElementById("profileModal").classList.add("open");
};

window.saveProfile = async () => {
  if (!currentUser) return;
  const nameInput = document.getElementById("pName").value.trim();
  const photoInput = document.getElementById("pPhoto").value.trim();
  if (!nameInput) return alert("O nome não pode ficar em branco.");
  try {
    await updateProfile(currentUser, {
      displayName: nameInput,
      photoURL: photoInput || defaultAvatar,
    });
    const ud = document.getElementById("userDisplay");
    const ua = document.getElementById("userAvatar");
    if (ud) ud.textContent = currentUser.displayName;
    if (ua) ua.src = currentUser.photoURL || defaultAvatar;
    closeM("profileModal");
    alert("Perfil atualizado com sucesso!");
  } catch (error) {
    console.error(error);
    alert("Erro ao atualizar perfil: " + error.message);
  }
};

document.addEventListener("click", () => {
  document.getElementById("userDropdown")?.classList.remove("show");
});


onAuthStateChanged(auth, (user) => {
  const container = document.getElementById("authContainer");
  const ud = document.getElementById("userDisplay");
  const ua = document.getElementById("userAvatar");

  if (user) {
    currentUser = user;
    if (container) container.style.display = "none";
    if (ud) ud.textContent = user.displayName || user.email.split("@")[0];
    if (ua) ua.src = user.photoURL || defaultAvatar;
    loadDataFromCloud(user);
  } else {
    currentUser = null;
    if (container) container.style.display = "flex";
    if (ud) ud.textContent = "Desconectado";
    if (ua) ua.src = defaultAvatar;
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const bpa = document.getElementById("btnPrimaryAuth");
  if (bpa) {
    bpa.onclick = async () => {
      const e = document.getElementById("authEmail").value.trim();
      const p = document.getElementById("authPassword").value;
      if (!e || !p) return alert("Preencha as credenciais.");
      try {
        if (isSignUpMode) {
          await createUserWithEmailAndPassword(auth, e, p);
          alert("Conta criada com sucesso!");
        } else {
          await signInWithEmailAndPassword(auth, e, p);
        }
      } catch (err) {
        alert("Erro de acesso: " + err.message);
      }
    };
  }

  const bga = document.getElementById("btnGoogleAuth");
  if (bga) {
    bga.onclick = async () => {
      try {
        auth.languageCode = "pt-BR";
        await signInWithPopup(auth, googleProvider);
      } catch (error) {
        if (error.code === "auth/popup-blocked") {
          alert(
            "Pop-up bloqueado pelo navegador. Ative as permissões de pop-up para este site.",
          );
        } else if (error.code !== "auth/cancelled-popup-request") {
          alert("Erro ao entrar com o Google: " + error.message);
        }
      }
    };
  }

  const bta = document.getElementById("btnToggleAuth");
  if (bta) {
    bta.onclick = () => {
      isSignUpMode = !isSignUpMode;
      document.getElementById("btnPrimaryAuth").textContent = isSignUpMode
        ? "Criar Conta"
        : "Entrar";
    };
  }

  const blo = document.getElementById("btnLogout");
  if (blo) blo.onclick = () => signOut(auth);

  document.querySelectorAll(".modal-bg").forEach((bg) => {
    bg.onclick = function (e) {
      if (e.target === this) closeM(this.id);
    };
  });
});


window.chgM = chgM;
window.openTM = openTM;
window.openGM = openGM;
window.openBudgetModal = openBudgetModal;


window.scrollToSection = function (id, btn) {
  const target = document.getElementById(id);
  if (target) {
    target.scrollIntoView({ behavior: "smooth" });
  }
  document
    .querySelectorAll(".sb-item")
    .forEach((x) => x.classList.remove("active"));
  if (btn) {
    btn.classList.add("active");
  }
};
