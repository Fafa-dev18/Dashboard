import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Configurações do seu projeto Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDewKbWupwEPSuMRAsuxAjUXjQMRIoZwOo",
  authDomain: "dashboard-10cc5.firebaseapp.com",
  projectId: "dashboard-10cc5",
  storageBucket: "dashboard-10cc5.firebasestorage.app",
  messagingSenderId: "117274376635",
  appId: "1:117274376635:web:f575c93598e3113b62ac9e",
  measurementId: "G-WGVWPE142W"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const MO = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const CATS = {
  'Moradia': { c: '#3b82f6' }, 'Alimentação': { c: '#f59e0b' }, 'Transporte': { c: '#8b5cf6' },
  'Saúde': { c: '#ef4444' }, 'Lazer': { c: '#ec4899' }, 'Educação': { c: '#10b981' },
  'Salário': { c: '#34d399' }, 'Freelance': { c: '#06b6d4' }, 'Investimento': { c: '#eab308' }, 'Outros': { c: '#64748b' }
};
const GCOLS = ['#34d399', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b'];

let currentUser = null;
let now = new Date(), cm = now.getMonth(), cy = now.getFullYear(), filt = 'all';
let dInst = null, tInst = null;
let txs = [];
let goals = [];
let isSignUpMode = false;

// SALVAR DADOS NA NUVEM FIRESTORE
async function saveDataToCloud() {
  if (!currentUser) return;
  try {
    await setDoc(doc(db, "users_data", currentUser.uid), { txs, goals });
  } catch (e) {
    console.error("Erro ao salvar dados: ", e);
  }
}

// CARREGAR DADOS DA NUVEM FIRESTORE
async function loadDataFromCloud(user) {
  try {
    const docRef = doc(db, "users_data", user.uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      txs = data.txs || [];
      goals = data.goals || [];
    } else {
      txs = []; goals = [];
      await saveDataToCloud();
    }
    render();
  } catch (e) {
    console.error("Erro ao carregar dados: ", e);
  }
}

function brl(n) { return 'R$\u00a0' + (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

// FILTRO DE MÊS CORRENTE + LOGICA DE LANÇAMENTOS FIXOS
function mth() { 
  return txs.filter(t => { 
    const d = new Date(t.date + 'T12:00');
    if (t.recurrent) {
      const tDate = new Date(t.date + 'T12:00');
      // Lançamento fixo aparece se o mês selecionado for igual ou maior que o mês de criação
      return (cy > tDate.getFullYear()) || (cy === tDate.getFullYear() && cm >= tDate.getMonth());
    }
    return d.getMonth() === cm && d.getFullYear() === cy; 
  }); 
}

function updateModalCategories() {
  const typ = document.getElementById('fTyp').value;
  const select = document.getElementById('fCt');
  select.innerHTML = '';
  const options = typ === 'income' ? ['Salário', 'Freelance', 'Investimento', 'Outros'] : ['Moradia', 'Alimentação', 'Transporte', 'Saúde', 'Lazer', 'Educação', 'Outros'];
  options.forEach(o => {
    let opt = document.createElement('option');
    opt.value = o; opt.textContent = o;
    select.appendChild(opt);
  });
}

// RENDERIZAR METRICAS PRINCIPAIS (RECEITA, DESPESA, SALDO)
function renderMetrics() {
  const t = mth();
  const inc = t.filter(x => x.type === 'income').reduce((s, x) => s + x.amount, 0);
  const exp = t.filter(x => x.type === 'expense').reduce((s, x) => s + x.amount, 0);
  const bal = inc - exp;
  document.getElementById('vInc').textContent = brl(inc);
  document.getElementById('vExp').textContent = brl(exp);
  document.getElementById('vIncC').textContent = `${t.filter(x => x.type === 'income').length} entrada(s)`;
  document.getElementById('vExpC').textContent = `${t.filter(x => x.type === 'expense').length} saída(s)`;
  const bEl = document.getElementById('vBal');
  bEl.textContent = (bal < 0 ? '-' : '') + brl(Math.abs(bal));
  bEl.style.color = bal >= 0 ? '#34d399' : '#f87171';
}

// RENDERIZAR GRÁFICO DONUT (DISTRIBUIÇÃO DE GASTOS)
function renderDonut() {
  const exp = mth().filter(t => t.type === 'expense');
  const by = {}; exp.forEach(t => { by[t.cat] = (by[t.cat] || 0) + t.amount; });
  const lbls = Object.keys(by), data = Object.values(by);
  const clrs = lbls.map(l => (CATS[l] || CATS['Outros']).c);
  if (dInst) { dInst.destroy(); dInst = null; }
  const cv = document.getElementById('donutC');
  if (!lbls.length) { cv.style.display = 'none'; document.getElementById('donutLeg').innerHTML = '<div class="empty-state">Sem gráficos neste mês</div>'; return; }
  cv.style.display = 'block';
  dInst = new Chart(cv, {
    type: 'doughnut',
    data: { labels: lbls, datasets: [{ data, backgroundColor: clrs, borderWidth: 0, hoverOffset: 3 }] },
    options: { responsive: false, cutout: '70%', plugins: { legend: { display: false } } }
  });
  const tot = data.reduce((s, v) => s + v, 0);
  document.getElementById('donutLeg').innerHTML = lbls.slice(0, 4).map((l, i) => `
    <div class="dl-item">
      <span class="dl-sq" style="background:${clrs[i]}"></span>
      <span>${l}</span>
      <span class="dl-pct">${Math.round(data[i] / tot * 100)}%</span>
    </div>`).join('');
}

// RENDERIZAR GRÁFICO DE EVOLUÇÃO SEMESTRAL (LINHAS)
function renderTrend() {
  const lbls = [], incs = [], exps = [];
  for (let i = 5; i >= 0; i--) {
    let m = cm - i, y = cy;
    while (m < 0) { m += 12; y--; }
    lbls.push(MO[m].slice(0, 3));
    
    const tx = txs.filter(t => {
      const d = new Date(t.date + 'T12:00');
      if (t.recurrent) {
        return (y > d.getFullYear()) || (y === d.getFullYear() && m >= d.getMonth());
      }
      return d.getMonth() === m && d.getFullYear() === y;
    });
    incs.push(tx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0));
    exps.push(tx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0));
  }
  if (tInst) { tInst.destroy(); tInst = null; }
  tInst = new Chart(document.getElementById('trendC'), {
    type: 'line',
    data: {
      labels: lbls,
      datasets: [
        { label: 'Receitas', data: incs, borderColor: '#34d399', backgroundColor: 'rgba(52,211,153,0.02)', borderWidth: 2, tension: 0.3, fill: true },
        { label: 'Despesas', data: exps, borderColor: '#f87171', backgroundColor: 'transparent', borderWidth: 2, tension: 0.3 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.02)' } },
        x: { ticks: { color: '#64748b' }, grid: { display: false } }
      }
    }
  });
}

// RENDERIZAR LISTA DE METAS
function renderGoals() {
  const el = document.getElementById('goalList');
  if (!goals.length) { el.innerHTML = '<div class="empty-state">Nenhuma meta ativa</div>'; return; }
  el.innerHTML = goals.map((g, i) => {
    const pct = Math.min(100, Math.round(g.current / g.target * 100));
    const c = GCOLS[i % GCOLS.length];
    return `<div class="goal-item">
      <div class="goal-hd">
        <span class="goal-name">${g.name}</span>
        <span style="display:flex;align-items:center;gap:8px">
          <span class="goal-pct" style="color:${c}">${pct}%</span>
          <button class="goal-del" data-index="${i}">✕</button>
        </span>
      </div>
      <div class="goal-bar"><div class="goal-fill" style="width:${pct}%;background:${c}"></div></div>
      <div class="goal-foot">
        <span>Guardado: ${brl(g.current)} / ${brl(g.target)}</span>
        <div class="goal-actions"><button class="goal-add-funds" data-index="${i}">＋ Guardar</button></div>
      </div>
    </div>`;
  }).join('');

  el.querySelectorAll('.goal-add-funds').forEach(b => b.onclick = () => addGoalFunds(b.dataset.index));
  el.querySelectorAll('.goal-del').forEach(b => b.onclick = () => delGoal(b.dataset.index));
}

function addGoalFunds(index) {
  const amountStr = prompt(`Quanto você deseja adicionar à meta "${goals[index].name}"?`);
  if (amountStr === null) return;
  const amount = parseFloat(amountStr.replace(',', '.'));
  if (isNaN(amount) || amount <= 0) return alert('Digite um valor numérico válido.');
  goals[index].current += amount;
  saveDataToCloud(); renderGoals();
}

// RENDERIZAR LISTA DE MOVIMENTAÇÕES (TABELA/LISTA)
function renderTxs() {
  const list = mth().filter(t => filt === 'all' || t.type === filt).sort((a, b) => new Date(b.date) - new Date(a.date));
  const el = document.getElementById('txList');
  if (!list.length) { el.innerHTML = '<li class="empty-state">Sem movimentações para este filtro</li>'; return; }
  el.innerHTML = list.map(t => {
    const d = new Date(t.date + 'T12:00');
    const ds = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const clr = t.type === 'income' ? '#34d399' : '#f87171';
    return `<li class="tx-item">
      <div class="tx-ic" style="background:rgba(${t.type === 'income' ? '52,211,153' : '248,113,113'},0.08);color:${clr}"><b>${t.type === 'income' ? '↑' : '↓'}</b></div>
      <div class="tx-info">
        <div class="tx-name">${t.name} ${t.recurrent ? '<span class="badge-fixo">Fixo</span>' : ''}</div>
        <div class="tx-meta">${t.cat} • ${t.recurrent ? 'Mensal' : ds}</div>
      </div>
      <span class="${t.type === 'income' ? 'tx-in' : 'tx-ex'}">${t.type === 'income' ? '+' : '-'}${brl(t.amount)}</span>
      <button class="tx-del" data-id="${t.id}">🗑</button>
    </li>`;
  }).join('');

  el.querySelectorAll('.tx-del').forEach(b => b.onclick = () => delTx(Number(b.dataset.id)));
}

// RENDERIZAR CALENDÁRIO FLUXO DE CAIXA
function renderCalendar() {
  const grid = document.getElementById('calendarGrid');
  grid.innerHTML = '';
  
  const firstDay = new Date(cy, cm, 1).getDay();
  const totalDays = new Date(cy, cm + 1, 0).getDate();
  const activeTxs = mth();

  for (let i = 0; i < firstDay; i++) {
    const emptyDiv = document.createElement('div');
    emptyDiv.classList.add('cal-day', 'cal-empty');
    grid.appendChild(emptyDiv);
  }

  for (let day = 1; day <= totalDays; day++) {
    const dayDiv = document.createElement('div');
    dayDiv.classList.add('cal-day');
    
    const dayNum = document.createElement('span');
    dayNum.textContent = day;
    dayDiv.appendChild(dayNum);

    const dayEvents = activeTxs.filter(t => {
      const tDate = new Date(t.date + 'T12:00');
      return tDate.getDate() === day;
    });

    if (dayEvents.length > 0) {
      const indicatorContainer = document.createElement('div');
      indicatorContainer.classList.add('cal-indicators');
      
      dayEvents.forEach(e => {
        const dot = document.createElement('span');
        dot.classList.add('cal-dot');
        dot.style.backgroundColor = e.type === 'income' ? '#34d399' : '#f87171';
        dot.title = `${e.name}: ${brl(e.amount)}`;
        indicatorContainer.appendChild(dot);
      });
      dayDiv.appendChild(indicatorContainer);
    }
    grid.appendChild(dayDiv);
  }
}

// FUNÇÃO MESTRE DE ATUALIZAÇÃO DA TELA
function render() {
  document.getElementById('mLbl').textContent = `${MO[cm]} ${cy}`;
  renderMetrics(); renderDonut(); renderTrend(); renderGoals(); renderTxs(); renderCalendar();
}

// EVENTOS DE NAVEGAÇÃO E MODAIS INTERATIVOS
window.chgM = (d) => { cm += d; if (cm > 11) { cm = 0; cy++; } if (cm < 0) { cm = 11; cy--; } render(); };
window.setF = (f, b) => { filt = f; document.querySelectorAll('.tf').forEach(x => x.classList.remove('on')); b.classList.add('on'); renderTxs(); };
window.openTM = () => { document.getElementById('fDt').value = `${cy}-${String(cm + 1).padStart(2, '0')}-15`; document.getElementById('fNm').value = ''; document.getElementById('fAm').value = ''; document.getElementById('fRecurrent').checked = false; updateModalCategories(); document.getElementById('tmModal').classList.add('open'); };
window.openGM = () => { document.getElementById('gNm').value = ''; document.getElementById('gTg').value = ''; document.getElementById('gCr').value = ''; document.getElementById('gmModal').classList.add('open'); };
window.toggleProfileModal = () => {
  if(!currentUser) return;
  document.getElementById('pName').value = currentUser.displayName || '';
  document.getElementById('pAvatar').value = currentUser.photoURL || '';
  document.getElementById('profileModal').classList.add('open');
};
window.closeM = (id) => { document.getElementById(id).classList.remove('open'); };
window.updateModalCategories = updateModalCategories;

// SALVAR TRANSAÇÃO
window.saveTx = () => {
  const n = document.getElementById('fNm').value.trim(), a = parseFloat(document.getElementById('fAm').value), t = document.getElementById('fTyp').value, c = document.getElementById('fCt').value, dt = document.getElementById('fDt').value;
  const isRecurrent = document.getElementById('fRecurrent').checked;
  if (!n || !a || a <= 0 || !dt) return alert('Preencha os campos corretamente.');
  
  txs.push({ id: Date.now(), type: t, name: n, amount: a, cat: c, date: dt, recurrent: isRecurrent });
  saveDataToCloud(); closeM('tmModal'); render();
};
function delTx(id) { txs = txs.filter(t => t.id !== id); saveDataToCloud(); render(); }

// SALVAR METAS
window.saveGoal = () => {
  const n = document.getElementById('gNm').value.trim(), t = parseFloat(document.getElementById('gTg').value), c = parseFloat(document.getElementById('gCr').value) || 0;
  if (!n || !t || t <= 0) return alert('Insira dados válidos.');
  goals.push({ name: n, target: t, current: c });
  saveDataToCloud(); renderGoals(); closeM('gmModal'); render();
};
function delGoal(i) { goals.splice(i, 1); saveDataToCloud(); renderGoals(); }

// EDITAR E SALVAR DADOS DO PERFIL (NOME / FOTO)
window.saveProfile = async () => {
  const name = document.getElementById('pName').value.trim();
  const avatarUrl = document.getElementById('pAvatar').value.trim();
  if(!name) return alert("O nome não pode ficar em branco.");

  try {
    await updateProfile(auth.currentUser, { displayName: name, photoURL: avatarUrl });
    document.getElementById('userDisplay').textContent = name;
    if(avatarUrl) document.getElementById('userAvatar').src = avatarUrl;
    closeM('profileModal');
    alert("Perfil atualizado com sucesso!");
  } catch(e) {
    alert("Erro ao salvar perfil: " + e.message);
  }
};

document.querySelectorAll('.modal-bg').forEach(bg => bg.addEventListener('click', function (e) { if (e.target === this) closeM(this.id); }));

// ESCUTADOR AUTOMÁTICO DE ESTADO DO USUÁRIO (FIREBASE AUTH)
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    document.getElementById('authContainer').style.display = 'none';
    document.getElementById('userDisplay').textContent = user.displayName || user.email.split('@')[0];
    if (user.photoURL) document.getElementById('userAvatar').src = user.photoURL;
    loadDataFromCloud(user);
  } else {
    currentUser = null;
    document.getElementById('authContainer').style.display = 'flex';
    document.getElementById('userDisplay').textContent = "Deslogado";
    document.getElementById('userAvatar').src = "https://api.dicebear.com/7.x/bottts/svg?seed=Financas";
  }
});

// FLUXO DE LOGIN/REGISTRO SEM CONFLITO DE DUPLICIDADE
document.getElementById('btnPrimaryAuth').onclick = async () => {
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  
  if (!email || !password) return alert('Preencha os campos de acesso.');
  
  try {
    if (isSignUpMode) {
      await createUserWithEmailAndPassword(auth, email, password);
      alert('Conta criada com sucesso!');
      isSignUpMode = false;
      document.getElementById('btnPrimaryAuth').textContent = 'Entrar';
      document.getElementById('btnToggleAuth').textContent = 'Criar uma nova conta';
      document.getElementById('authSubtitle').textContent = 'Entre ou crie uma conta para sincronizar seus dados';
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
  } catch (error) { 
    if (error.code === 'auth/email-already-in-use') {
      alert('Este e-mail já está cadastrado. Clique para entrar.');
    } else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
      alert('E-mail ou senha incorretos. Verifique seus dados.');
    } else {
      alert("Erro na autenticação: " + error.message); 
    }
  }
};

// BOTÃO PARA ALTERNAR ENTRE SIGN-IN E SIGN-UP
document.getElementById('btnToggleAuth').onclick = () => {
  isSignUpMode = !isSignUpMode;
  document.getElementById('authEmail').value = '';
  document.getElementById('authPassword').value = '';
  document.getElementById('btnPrimaryAuth').textContent = isSignUpMode ? 'Criar Conta' : 'Entrar';
  document.getElementById('btnToggleAuth').textContent = isSignUpMode ? 'Já tenho uma conta (Entrar)' : 'Criar uma nova conta';
  document.getElementById('authSubtitle').textContent = isSignUpMode ? 'Preencha os dados abaixo para se registrar' : 'Entre ou crie uma conta para sincronizar seus dados';
};

document.getElementById('btnLogout').onclick = () => signOut(auth);