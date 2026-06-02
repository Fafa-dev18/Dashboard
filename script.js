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
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
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

async function saveDataToCloud() {
  if (!currentUser) return;
  try {
    await setDoc(doc(db, "users_data", currentUser.uid), {
      txs,
      goals,
      budgets,
    });
  } catch (e) {
    console.error(e);
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
      console.log("Dados carregados com sucesso!");
    } else {
      // Se não existir, NÃO reseta automaticamente sem aviso.
      // Apenas inicializa vazio para a sessão atual, sem sobrescrever o servidor.
      txs = [];
      goals = [];
      budgets = {};
      console.warn("Nenhum dado encontrado no Firestore para este utilizador.");
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

function mth() {
  return txs.filter((t) => {
    const d = new Date(t.date + "T12:00");
    if (t.recurrent) {
      const tDate = new Date(t.date + "T12:00");
      return (
        cy > tDate.getFullYear() ||
        (cy === tDate.getFullYear() && cm >= tDate.getMonth())
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

  document.getElementById("vInc").textContent = brl(inc);
  document.getElementById("vExp").textContent = brl(expPuras);
  document.getElementById("vInv").textContent = brl(inv);

  document.getElementById("vIncC").textContent =
    `${t.filter((x) => x.type === "income").length} entrada(s)`;
  document.getElementById("vExpC").textContent =
    `${t.filter((x) => x.type === "expense" && !x.name.startsWith("Aporte:")).length} saída(s)`;

  const bEl = document.getElementById("vBal");
  const bStat = document.getElementById("vBalStatus");
  bEl.textContent = (bal < 0 ? "-" : "") + brl(Math.abs(bal));

  if (bal >= 0) {
    bEl.style.color = "#34d399";
    bStat.textContent = "Você está operando no verde!";
    bStat.style.color = "#34d399";
  } else {
    bEl.style.color = "#f87171";
    bStat.textContent = "Cuidado! Fluxo negativo.";
    bStat.style.color = "#f87171";
  }
}

function renderBudgets() {
  const el = document.getElementById("budgetList");
  const t = mth().filter((x) => x.type === "expense");
  const categories = [
    "Moradia", "Alimentação", "Transporte", "Saúde", "Lazer", "Educação", "Outros",
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

  el.innerHTML = html || '<div class="empty-state">Nenhum teto de gastos definido.</div>';
  el.querySelectorAll(".budget-del").forEach(
    (b) => (b.onclick = () => delBudget(b.dataset.cat)),
  );
}

function renderInsights() {
  const el = document.getElementById("insightsList");
  const t = mth();
  const currentExp = t.filter((x) => x.type === "expense");
  let html = "";

  const byCat = {};
  currentExp.forEach((x) => {
    byCat[x.cat] = (byCat[x.cat] || 0) + x.amount;
  });
  let topCat = "", maxSpent = 0;
  Object.keys(byCat).forEach((c) => {
    if (byCat[c] > maxSpent) { maxSpent = byCat[c]; topCat = c; }
  });

  if (topCat) {
    html += `<div class="insight-item">🚨 <b>Dreno de Caixa:</b> Sua maior despesa este mês está concentrada em <b>${topCat}</b> com um total de ${brl(maxSpent)}.</div>`;
  }

  const inc = t.filter((x) => x.type === "income").reduce((s, x) => s + x.amount, 0);
  const fixas = t.filter((x) => x.type === "expense" && x.recurrent).reduce((s, x) => s + x.amount, 0);
  if (inc > 0 && fixas > 0) {
    const compPct = Math.round((fixas / inc) * 100);
    if (compPct > 50) {
      html += `<div class="insight-item">⚠️ <b>Renda Comprometida:</b> ${compPct}% das suas receitas deste mês já estão travadas em contas recorrentes/fixas (${brl(fixas)}).</div>`;
    }
  }

  Object.keys(budgets).forEach((cat) => {
    const limit = budgets[cat] || 0;
    const spent = currentExp.filter((x) => x.cat === cat).reduce((s, x) => s + x.amount, 0);
    if (limit > 0 && spent > limit) {
      html += `<div class="insight-item" style="color:#f87171;">❌ <b>Limite Excedido:</b> Você estourou o planejamento de <b>${cat}</b> por ${brl(spent - limit)}!</div>`;
    }
  });

  el.innerHTML = html || '<div class="empty-state">Sem alertas no momento. Seu fluxo de caixa está equilibrado!</div>';
}

function renderDonut() {
  const exp = mth().filter((t) => t.type === "expense");
  const by = {};
  exp.forEach((t) => { by[t.cat] = (by[t.cat] || 0) + t.amount; });
  const lbls = Object.keys(by), data = Object.values(by);
  const clrs = lbls.map((l) => (CATS[l] || CATS["Outros"]).c);
  if (dInst) { dInst.destroy(); dInst = null; }
  const cv = document.getElementById("donutC");
  if (!lbls.length) {
    cv.style.display = "none";
    document.getElementById("donutLeg").innerHTML = '<div class="empty-state">Sem despesas registradas</div>';
    return;
  }
  cv.style.display = "block";
  dInst = new Chart(cv, {
    type: "doughnut",
    data: {
      labels: lbls,
      datasets: [{ data, backgroundColor: clrs, borderWidth: 0, hoverOffset: 4 }],
    },
    options: { responsive: false, cutout: "70%", plugins: { legend: { display: false } } },
  });
  const tot = data.reduce((s, v) => s + v, 0);
  document.getElementById("donutLeg").innerHTML = lbls
    .map((l, i) => `
    <div class="dl-item">
      <span class="dl-sq" style="background:${clrs[i]}"></span>
      <span>${l}</span>
      <span class="dl-pct">${Math.round((data[i] / tot) * 100)}%</span>
    </div>`)
    .join("");
}

function renderTrend() {
  const lbls = [], incs = [], exps = [];
  for (let i = 5; i >= 0; i--) {
    let m = cm - i, y = cy;
    while (m < 0) { m += 12; y--; }
    lbls.push(MO[m].slice(0, 3));
    const tx = txs.filter((t) => {
      const d = new Date(t.date + "T12:00");
      if (t.recurrent) return (y > d.getFullYear() || (y === d.getFullYear() && m >= d.getMonth()));
      return d.getMonth() === m && d.getFullYear() === y;
    });
    incs.push(tx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0));
    exps.push(tx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0));
  }
  if (tInst) { tInst.destroy(); tInst = null; }
  tInst = new Chart(document.getElementById("trendC"), {
    type: "line",
    data: {
      labels: lbls,
      datasets: [
        { label: "Receitas", data: incs, borderColor: "#34d399", backgroundColor: "rgba(52,211,153,0.05)", borderWidth: 2, tension: 0.3, fill: true },
        { label: "Despesas", data: exps, borderColor: "#f87171", backgroundColor: "transparent", borderWidth: 2, tension: 0.3 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { ticks: { color: "#64748b", font: { size: 10 } }, grid: { color: "rgba(255,255,255,0.02)" } },
        x: { ticks: { color: "#64748b" }, grid: { display: false } },
      },
    },
  });
}

function renderGoals() {
  const el = document.getElementById("goalList");
  if (!goals.length) { el.innerHTML = '<div class="empty-state">Nenhuma meta ativa</div>'; return; }
  el.innerHTML = goals.map((g, i) => {
    const pct = Math.min(100, Math.round((g.current / g.target) * 100));
    const c = GCOLS[i % GCOLS.length];
    return `<div class="goal-item">
      <div class="goal-hd">
        <span class="goal-name"><b>${g.name}</b></span>
        <span style="display:flex;align-items:center;gap:8px">
          <span class="goal-pct" style="color:${c}">${pct}%</span>
          <button class="goal-del" data-index="${i}">✕</button>
        </span>
      </div>
      <div class="goal-bar"><div class="goal-fill" style="width:${pct}%;background:${c}"></div></div>
      <div class="goal-foot">
        <span>${brl(g.current)} / ${brl(g.target)}</span>
        <div class="goal-actions"><button class="goal-add-funds" data-index="${i}">＋ Guardar</button></div>
      </div>
    </div>`;
  }).join("");
  el.querySelectorAll(".goal-add-funds").forEach((b) => (b.onclick = () => openFundModal(b.dataset.index)));
  el.querySelectorAll(".goal-del").forEach((b) => (b.onclick = () => delGoal(b.dataset.index)));
}

function openFundModal(index) {
  const goal = goals[index];
  document.getElementById("fundModalTitle").textContent = `Aporte para: ${goal.name}`;
  document.getElementById("fundTargetIndex").value = index;
  document.getElementById("fundAmount").value = "";
  document.getElementById("fundModal").classList.add("open");
}

window.confirmGoalFunds = () => {
  const index = document.getElementById("fundTargetIndex").value;
  const amount = parseFloat(document.getElementById("fundAmount").value);
  if (isNaN(amount) || amount <= 0) return alert("Insira um valor válido.");
  const goal = goals[index];
  goal.current += amount;
  txs.push({ id: Date.now(), type: "expense", name: `Aporte: ${goal.name}`, amount: amount, cat: "Investimento", date: new Date().toISOString().split("T")[0], recurrent: false });
  saveDataToCloud();
  closeM("fundModal");
  render();
};

function renderTxs() {
  const list = mth().filter((t) => filt === "all" || t.type === filt).sort((a, b) => new Date(b.date) - new Date(a.date));
  const el = document.getElementById("txList");
  if (!list.length) { el.innerHTML = '<li class="empty-state">Sem movimentações este mês</li>'; return; }
  el.innerHTML = list.map((t) => {
    const d = new Date(t.date + "T12:00");
    const ds = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    const clr = t.type === "income" ? "#34d399" : "#f87171";
    return `<li class="tx-item">
      <div class="tx-ic" style="background:rgba(${t.type === "income" ? "52,211,153" : "248,113,113"},0.05);color:${clr}"><b>${t.type === "income" ? "↑" : "↓"}</b></div>
      <div class="tx-info">
        <div class="tx-name">${t.name} ${t.recurrent ? '<span class="badge-fixo">Fixo</span>' : ""}</div>
        <div class="tx-meta">${t.cat} • ${ds}</div>
      </div>
      <span class="${t.type === "income" ? "tx-in" : "tx-ex"}">${t.type === "income" ? "+" : "-"}${brl(t.amount)}</span>
      <button class="tx-del" data-id="${t.id}">🗑</button>
    </li>`;
  }).join("");
  el.querySelectorAll(".tx-del").forEach((b) => (b.onclick = () => delTx(Number(b.dataset.id))));
}

function renderCalendar() {
  const grid = document.getElementById("calendarGrid");
  if (!grid) return;
  grid.innerHTML = "";
  const firstDay = new Date(cy, cm, 1).getDay();
  const totalDays = new Date(cy, cm + 1, 0).getDate();
  const activeTxs = mth();
  for (let i = 0; i < firstDay; i++) {
    const e = document.createElement("div"); e.classList.add("cal-day", "cal-empty"); grid.appendChild(e);
  }
  for (let day = 1; day <= totalDays; day++) {
    const dayDiv = document.createElement("div"); dayDiv.classList.add("cal-day");
    const dayNum = document.createElement("span"); dayNum.textContent = day; dayDiv.appendChild(dayNum);
    const dayEvents = activeTxs.filter((t) => new Date(t.date + "T12:00").getDate() === day);
    if (dayEvents.length > 0) {
      const ic = document.createElement("div"); ic.classList.add("cal-indicators");
      const tooltip = document.createElement("div"); tooltip.classList.add("cal-tooltip");
      let tooltipHtml = `<span class="ct-title">Dia ${day} de ${MO[cm]}</span><ul class="ct-list">`;
      dayEvents.forEach((e) => {
        const dot = document.createElement("span"); dot.classList.add("cal-dot"); dot.style.backgroundColor = e.type === "income" ? "#34d399" : "#f87171"; ic.appendChild(dot);
        const sign = e.type === "income" ? "+" : "-"; const cls = e.type === "income" ? "inc" : "exp";
        tooltipHtml += `<li class="ct-item ${cls}">${e.name.substring(0, 12)}: ${sign}${brl(e.amount)}</li>`;
      });
      tooltipHtml += "</ul>"; tooltip.innerHTML = tooltipHtml; dayDiv.appendChild(ic); dayDiv.appendChild(tooltip);
    }
    grid.appendChild(dayDiv);
  }
}

function render() {
  const mLbl = document.getElementById("mLbl");
  if (mLbl) mLbl.textContent = `${MO[cm]} ${cy}`;
  renderMetrics(); renderDonut(); renderTrend(); renderGoals(); renderBudgets(); renderInsights(); renderTxs(); renderCalendar();
}

window.openBudgetModal = () => { document.getElementById("bLmt").value = ""; document.getElementById("budgetModal").classList.add("open"); };
window.saveBudget = () => {
  const cat = document.getElementById("bCt").value;
  const limit = parseFloat(document.getElementById("bLmt").value);
  if (isNaN(limit) || limit <= 0) return alert("Defina um valor limite real.");
  budgets[cat] = limit; saveDataToCloud(); closeM("budgetModal"); render();
};
function delBudget(cat) { delete budgets[cat]; saveDataToCloud(); render(); }

window.chgM = (d) => {
  cm += d;
  if (cm > 11) { cm = 0; cy++; }
  if (cm < 0) { cm = 11; cy--; }
  render();
};
window.setF = (f, b) => {
  filt = f;
  document.querySelectorAll(".tf").forEach((x) => x.classList.remove("on"));
  b.classList.add("on");
  renderTxs();
};

window.openTM = () => {
  const hoje = new Date(); const ano = hoje.getFullYear(); const mes = String(hoje.getMonth() + 1).padStart(2, "0"); const dia = String(hoje.getDate()).padStart(2, "0");
  document.getElementById("fDt").value = `${ano}-${mes}-${dia}`;
  document.getElementById("fNm").value = ""; document.getElementById("fAm").value = ""; document.getElementById("fRecurrent").checked = false;
  updateModalCategories(); document.getElementById("tmModal").classList.add("open");
};
window.openGM = () => {
  document.getElementById("gNm").value = ""; document.getElementById("gTg").value = ""; document.getElementById("gCr").value = "";
  document.getElementById("gmModal").classList.add("open");
};
window.closeM = (id) => { document.getElementById(id).classList.remove("open"); };

function updateModalCategories() {
  const typ = document.getElementById("fTyp").value;
  const select = document.getElementById("fCt");
  if (!select) return;
  select.innerHTML = "";
  const options = typ === "income" ? ["Salário", "Freelance", "Investimento", "Outros"] : ["Moradia", "Alimentação", "Transporte", "Saúde", "Lazer", "Educação", "Outros"];
  options.forEach((o) => { let opt = document.createElement("option"); opt.value = o; opt.textContent = o; select.appendChild(opt); });
}
window.updateModalCategories = updateModalCategories;

window.saveTx = () => {
  const n = document.getElementById("fNm").value.trim(), a = parseFloat(document.getElementById("fAm").value), t = document.getElementById("fTyp").value, c = document.getElementById("fCt").value, dt = document.getElementById("fDt").value;
  if (!n || !a || a <= 0 || !dt) return alert("Preencha os campos corretamente.");
  txs.push({ id: Date.now(), type: t, name: n, amount: a, cat: c, date: dt, recurrent: document.getElementById("fRecurrent").checked });
  saveDataToCloud(); closeM("tmModal"); render();
};
function delTx(id) { txs = txs.filter((t) => t.id !== id); saveDataToCloud(); render(); }

window.saveGoal = () => {
  const n = document.getElementById("gNm").value.trim(), t = parseFloat(document.getElementById("gTg").value), c = parseFloat(document.getElementById("gCr").value) || 0;
  if (!n || t <= 0) return alert("Valores inválidos.");
  goals.push({ name: n, target: t, current: c }); saveDataToCloud(); closeM("gmModal"); render();
};
function delGoal(i) { goals.splice(i, 1); saveDataToCloud(); render(); }

const defaultAvatar = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256&auto=format&fit=crop";

if (!document.getElementById("pLocalFile")) {
  const localInput = document.createElement("input");
  localInput.type = "file"; localInput.id = "pLocalFile"; localInput.accept = "image/*"; localInput.style.display = "none";
  document.body.appendChild(localInput);
  localInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file || !currentUser) return;
    if (!file.type.startsWith("image/")) return alert("Por favor, selecione apenas arquivos de imagem.");
    try {
      document.getElementById("userDisplay").textContent = "Enviando foto...";
      const storageRef = ref(storage, `users/${currentUser.uid}/avatar.jpg`);
      await uploadBytes(storageRef, file);
      const uploadedUrl = await getDownloadURL(storageRef);
      document.getElementById("pPhoto").value = uploadedUrl;
      document.getElementById("profileModalAvatar").src = uploadedUrl;
      document.getElementById("userDisplay").textContent = currentUser.displayName || "Usuário";
    } catch (err) { console.error(err); alert("Erro ao fazer upload da imagem local: " + err.message); }
  };
}

window.openProfileModal = () => {
  if (!currentUser) return alert("Nenhum usuário conectado.");
  document.getElementById("pName").value = currentUser.displayName || "";
  document.getElementById("pPhoto").value = currentUser.photoURL || "";
  document.getElementById("profileModalAvatar").src = currentUser.photoURL || defaultAvatar;
  document.getElementById("profileModal").classList.add("open");
};

document.getElementById("profileModalAvatar").onclick = () => { document.getElementById("pLocalFile").click(); };

window.saveProfile = async () => {
  if (!currentUser) return;
  const nameInput = document.getElementById("pName").value.trim();
  const photoInput = document.getElementById("pPhoto").value.trim();
  if (!nameInput) return alert("O nome não pode ficar em branco.");
  try {
    await updateProfile(currentUser, { displayName: nameInput, photoURL: photoInput || defaultAvatar });
    document.getElementById("userDisplay").textContent = currentUser.displayName;
    document.getElementById("userAvatar").src = currentUser.photoURL || defaultAvatar;
    closeM("profileModal"); alert("Perfil atualizado com sucesso!");
  } catch (error) { console.error(error); alert("Erro ao atualizar o perfil: " + error.message); }
};

document.getElementById("userMenuTrigger").onclick = function (e) { e.stopPropagation(); document.getElementById("userDropdown").classList.toggle("show"); };
document.addEventListener("click", () => { const dropdown = document.getElementById("userDropdown"); if (dropdown) dropdown.classList.remove("show"); });

onAuthStateChanged(auth, (user) => {
  const container = document.getElementById("authContainer");
  if (user) {
    currentUser = user;
    if (container) container.style.display = "none";
    document.getElementById("userDisplay").textContent = user.displayName || user.email.split("@")[0];
    document.getElementById("userAvatar").src = user.photoURL || defaultAvatar;
    loadDataFromCloud(user);
  } else {
    currentUser = null;
    if (container) container.style.display = "flex";
    document.getElementById("userDisplay").textContent = "Desconectado";
    document.getElementById("userAvatar").src = defaultAvatar;
  }
});

document.getElementById("btnPrimaryAuth").onclick = async () => {
  const e = document.getElementById("authEmail").value.trim(), p = document.getElementById("authPassword").value;
  if (!e || !p) return alert("Preencha as credenciais.");
  try {
    if (isSignUpMode) { await createUserWithEmailAndPassword(auth, e, p); alert("Conta Registrada!"); }
    else { await signInWithEmailAndPassword(auth, e, p); }
  } catch (err) { alert("Erro de Acesso: " + err.message); }
};

document.getElementById("btnGoogleAuth").onclick = async () => {
  try {
    auth.languageCode = "pt-BR";
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    console.error("Erro detalhado do Google Auth:", error);
    if (error.code === "auth/popup-blocked") { alert("O pop-up de login foi bloqueado pelo seu navegador. Ative as permissões de pop-up para este site."); }
    else if (error.code === "auth/cancelled-popup-request") { console.log("O usuário fechou a janela do Google."); }
    else { alert("Erro ao entrar com o Google: " + error.message); }
  }
};

function showToast(msg) {
  const toast = document.createElement("div"); toast.className = "toast"; toast.innerText = msg; document.body.appendChild(toast); setTimeout(() => toast.remove(), 3000);
}
document.getElementById("btnToggleAuth").onclick = () => {
  isSignUpMode = !isSignUpMode;
  document.getElementById("btnPrimaryAuth").textContent = isSignUpMode ? "Criar Conta" : "Entrar";
};
document.getElementById("btnLogout").onclick = () => signOut(auth);
document.querySelectorAll(".modal-bg").forEach((bg) => (bg.onclick = function (e) { if (e.target === this) closeM(this.id); }));