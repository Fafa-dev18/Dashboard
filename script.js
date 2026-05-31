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

let now = new Date(),
  cm = now.getMonth(),
  cy = now.getFullYear(),
  filt = "all";
let nid = 100,
  dInst = null,
  tInst = null;

const defTx = [
  {
    id: 1,
    type: "income",
    name: "Salário Mensal",
    amount: 5500,
    cat: "Salário",
    date: `${cy}-${String(cm + 1).padStart(2, "0")}-05`,
  },
  {
    id: 2,
    type: "expense",
    name: "Aluguel Residencial",
    amount: 1200,
    cat: "Moradia",
    date: `${cy}-${String(cm + 1).padStart(2, "0")}-07`,
  },
  {
    id: 3,
    type: "expense",
    name: "Compras Supermercado",
    amount: 420,
    cat: "Alimentação",
    date: `${cy}-${String(cm + 1).padStart(2, "0")}-10`,
  },
  {
    id: 4,
    type: "expense",
    name: "App Transporte / Uber",
    amount: 85,
    cat: "Transporte",
    date: `${cy}-${String(cm + 1).padStart(2, "0")}-12`,
  },
  {
    id: 5,
    type: "income",
    name: "Projeto Freelance Website",
    amount: 800,
    cat: "Freelance",
    date: `${cy}-${String(cm + 1).padStart(2, "0")}-15`,
  },
  {
    id: 6,
    type: "expense",
    name: "Mensalidade Academia",
    amount: 90,
    cat: "Saúde",
    date: `${cy}-${String(cm + 1).padStart(2, "0")}-16`,
  },
];

let txs = JSON.parse(localStorage.getItem("fin3_tx")) || defTx;
let goals = JSON.parse(localStorage.getItem("fin3_gl")) || [];
nid = Math.max(nid, ...txs.map((t) => t.id)) + 1;

function save() {
  try {
    localStorage.setItem("fin3_tx", JSON.stringify(txs));
    localStorage.setItem("fin3_gl", JSON.stringify(goals));
  } catch (e) {}
}
function brl(n) {
  return (
    "R$\u00a0" +
    n.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}
function mth() {
  return txs.filter((t) => {
    const d = new Date(t.date + "T12:00");
    return d.getMonth() === cm && d.getFullYear() === cy;
  });
}

function updateModalCategories() {
  const typ = document.getElementById("fTyp").value;
  const select = document.getElementById("fCt");
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
    let opt = document.createElement("option");
    opt.value = o;
    opt.textContent = o;
    select.appendChild(opt);
  });
}

function renderMetrics() {
  const t = mth();
  const inc = t
    .filter((x) => x.type === "income")
    .reduce((s, x) => s + x.amount, 0);
  const exp = t
    .filter((x) => x.type === "expense")
    .reduce((s, x) => s + x.amount, 0);
  const bal = inc - exp;
  document.getElementById("vInc").textContent = brl(inc);
  document.getElementById("vExp").textContent = brl(exp);
  document.getElementById("vIncC").textContent =
    `${t.filter((x) => x.type === "income").length} entrada(s)`;
  document.getElementById("vExpC").textContent =
    `${t.filter((x) => x.type === "expense").length} saída(s)`;

  const bEl = document.getElementById("vBal");
  bEl.textContent = (bal < 0 ? "-" : "") + brl(Math.abs(bal));
  bEl.style.color = bal >= 0 ? "#34d399" : "#f87171";
}

function renderCats() {
  const exp = mth().filter((t) => t.type === "expense");
  const by = {};
  exp.forEach((t) => {
    by[t.cat] = (by[t.cat] || 0) + t.amount;
  });
  const s = Object.entries(by).sort((a, b) => b[1] - a[1]);
  const max = s[0] ? s[0][1] : 1;
  const el = document.getElementById("catList");
  if (!s.length) {
    el.innerHTML = '<div class="empty-state">Nenhuma despesa computada</div>';
    return;
  }
  el.innerHTML = s
    .slice(0, 5)
    .map(
      ([c, a]) => `
    <div class="cat-row">
      <span class="cat-dot" style="background:${(CATS[c] || CATS["Outros"]).c}"></span>
      <span class="cat-name">${c}</span>
      <div class="cat-bar"><div class="cat-fill" style="width:${Math.round((a / max) * 100)}%;background:${(CATS[c] || CATS["Outros"]).c}"></div></div>
      <span class="cat-amt">${brl(a)}</span>
    </div>`,
    )
    .join("");
}

function renderDonut() {
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
  if (!lbls.length) {
    cv.style.display = "none";
    document.getElementById("donutLeg").innerHTML =
      '<div class="empty-state">Sem gráficos neste mês</div>';
    return;
  }
  cv.style.display = "block";
  dInst = new Chart(cv, {
    type: "doughnut",
    data: {
      labels: lbls,
      datasets: [
        { data, backgroundColor: clrs, borderWidth: 0, hoverOffset: 3 },
      ],
    },
    options: {
      responsive: false,
      cutout: "70%",
      plugins: { legend: { display: false } },
    },
  });
  const tot = data.reduce((s, v) => s + v, 0);
  document.getElementById("donutLeg").innerHTML = lbls
    .slice(0, 4)
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

function renderTrend() {
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
  tInst = new Chart(document.getElementById("trendC"), {
    type: "line",
    data: {
      labels: lbls,
      datasets: [
        {
          label: "Receitas",
          data: incs,
          borderColor: "#34d399",
          backgroundColor: "rgba(52,211,153,0.02)",
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
  if (!goals.length) {
    el.innerHTML = '<div class="empty-state">Nenhuma meta ativa</div>';
    return;
  }
  el.innerHTML = goals
    .map((g, i) => {
      const pct = Math.min(100, Math.round((g.current / g.target) * 100));
      const c = GCOLS[i % GCOLS.length];
      return `<div class="goal-item">
      <div class="goal-hd">
        <span class="goal-name">${g.name}</span>
        <span style="display:flex;align-items:center;gap:8px">
          <span class="goal-pct" style="color:${c}">${pct}%</span>
          <button class="goal-del" onclick="delGoal(${i})">✕</button>
        </span>
      </div>
      <div class="goal-bar"><div class="goal-fill" style="width:${pct}%;background:${c}"></div></div>
      <div class="goal-foot">
        <span>Guardado: ${brl(g.current)} / ${brl(g.target)}</span>
        <div class="goal-actions">
          <button class="goal-add-funds" onclick="addGoalFunds(${i})">＋ Guardar</button>
        </div>
      </div>
    </div>`;
    })
    .join("");
}

function addGoalFunds(index) {
  const amountStr = prompt(
    `Quanto você deseja adicionar à meta "${goals[index].name}"?`,
  );
  if (amountStr === null) return;
  const amount = parseFloat(amountStr.replace(",", "."));
  if (isNaN(amount) || amount <= 0) {
    return alert(
      "Por favor, digite um valor numérico válido e maior que zero.",
    );
  }
  goals[index].current += amount;
  save();
  renderGoals();
}

function renderTxs() {
  const list = mth()
    .filter((t) => filt === "all" || t.type === filt)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const el = document.getElementById("txList");
  if (!list.length) {
    el.innerHTML =
      '<li class="empty-state">Sem movimentações para este filtro</li>';
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
      return `<li class="tx-item">
      <div class="tx-ic" style="background:rgba(${t.type === "income" ? "52,211,153" : "248,113,113"},0.08);color:${clr}"><b>${t.type === "income" ? "↑" : "↓"}</b></div>
      <div class="tx-info">
        <div class="tx-name">${t.name}</div>
        <div class="tx-meta">${t.cat} • ${ds}</div>
      </div>
      <span class="${t.type === "income" ? "tx-in" : "tx-ex"}">${t.type === "income" ? "+" : "-"}${brl(t.amount)}</span>
      <button class="tx-del" onclick="delTx(${t.id})">🗑</button>
    </li>`;
    })
    .join("");
}

function render() {
  document.getElementById("mLbl").textContent = `${MO[cm]} ${cy}`;
  renderMetrics();
  renderCats();
  renderDonut();
  renderTrend();
  renderGoals();
  renderTxs();
}

function chgM(d) {
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
}
function setF(f, b) {
  filt = f;
  document.querySelectorAll(".tf").forEach((x) => x.classList.remove("on"));
  b.classList.add("on");
  renderTxs();
}

function openTM() {
  const targetDate = `${cy}-${String(cm + 1).padStart(2, "0")}-15`;
  document.getElementById("fDt").value = targetDate;
  document.getElementById("fNm").value = "";
  document.getElementById("fAm").value = "";
  updateModalCategories();
  document.getElementById("tmModal").classList.add("open");
}
function openGM() {
  document.getElementById("gNm").value = "";
  document.getElementById("gTg").value = "";
  document.getElementById("gCr").value = "";
  document.getElementById("gmModal").classList.add("open");
}
function closeM(id) {
  document.getElementById(id).classList.remove("open");
}

function saveTx() {
  const n = document.getElementById("fNm").value.trim();
  const a = parseFloat(document.getElementById("fAm").value);
  const t = document.getElementById("fTyp").value;
  const c = document.getElementById("fCt").value;
  const dt = document.getElementById("fDt").value;
  if (!n || !a || a <= 0 || !dt)
    return alert("Por favor, preencha todos os campos corretamente.");
  txs.push({ id: nid++, type: t, name: n, amount: a, cat: c, date: dt });
  save();
  closeM("tmModal");
  render();
}
function delTx(id) {
  txs = txs.filter((t) => t.id !== id);
  save();
  render();
}
function saveGoal() {
  const n = document.getElementById("gNm").value.trim();
  const t = parseFloat(document.getElementById("gTg").value);
  const c = parseFloat(document.getElementById("gCr").value) || 0;
  if (!n || !t || t <= 0) return alert("Insira dados de meta válidos.");
  goals.push({ name: n, target: t, current: c });
  save();
  closeM("gmModal");
  renderGoals();
}
function delGoal(i) {
  goals.splice(i, 1);
  save();
  renderGoals();
}

document.querySelectorAll(".modal-bg").forEach((bg) => {
  bg.addEventListener("click", function (e) {
    if (e.target === this) closeM(this.id);
  });
});

// Inicialização
render();
