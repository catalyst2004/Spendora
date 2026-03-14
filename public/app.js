/* ════════════════════════════════════════════
   SPENDORA — app.js  (MySQL backend version)
   All data goes to/from the server API
════════════════════════════════════════════ */

'use strict';

// ─────────────────────────────────────────
// STATE
// ─────────────────────────────────────────
let currentUser = null;   // { id, name, username }
let token       = null;   // JWT stored in sessionStorage
let expenses    = [];
let budgets     = [];
let charts      = {};
let lineChartDays = 7;

// ─────────────────────────────────────────
// API HELPER
// ─────────────────────────────────────────
const API = '/api';

async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const res  = await fetch(API + path, { ...options, headers });
  const data = await res.json();

  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ─────────────────────────────────────────
// SESSION (token in sessionStorage — clears on tab close;
//          use localStorage if you want "remember me")
// ─────────────────────────────────────────
function saveSession(t, u) {
  token       = t;
  currentUser = u;
  sessionStorage.setItem('spendora_token', t);
  sessionStorage.setItem('spendora_user',  JSON.stringify(u));
}
function loadSession() {
  token       = sessionStorage.getItem('spendora_token');
  currentUser = JSON.parse(sessionStorage.getItem('spendora_user') || 'null');
  return !!(token && currentUser);
}
function clearSession() {
  token       = null;
  currentUser = null;
  sessionStorage.removeItem('spendora_token');
  sessionStorage.removeItem('spendora_user');
}

// ─────────────────────────────────────────
// LOADING OVERLAY (show while fetching data)
// ─────────────────────────────────────────
function setLoading(on) {
  let el = document.getElementById('loadingOverlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'loadingOverlay';
    el.style.cssText = 'position:fixed;inset:0;background:rgba(255,255,255,0.7);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;z-index:999;font-family:var(--font);font-size:15px;color:var(--text-secondary);gap:10px;';
    el.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="animation:spin 0.8s linear infinite"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> Loading…';
    if (!document.getElementById('spinStyle')) {
      const s = document.createElement('style');
      s.id = 'spinStyle';
      s.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
      document.head.appendChild(s);
    }
    document.body.appendChild(el);
  }
  el.style.display = on ? 'flex' : 'none';
}

// ─────────────────────────────────────────
// SCREEN MANAGEMENT
// ─────────────────────────────────────────
async function showApp(t, u) {
  saveSession(t, u);

  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('appScreen').classList.remove('hidden');

  const initials = u.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  document.getElementById('userAvatar').textContent = initials;
  document.getElementById('userName').textContent   = u.name;
  document.getElementById('userHandle').textContent = '@' + u.username;
  document.getElementById('todayDate').textContent  = dayjs().format('dddd, MMMM D, YYYY');
  document.getElementById('expDate').value          = dayjs().format('YYYY-MM-DD');

  lucide.createIcons();

  // Load all data from MySQL
  setLoading(true);
  try {
    await loadAllData();
    renderAll();
  } catch (err) {
    showToast('Failed to load your data. Check your connection.');
  } finally {
    setLoading(false);
  }
}

function showAuth() {
  clearSession();
  expenses = [];
  budgets  = [];
  Object.values(charts).forEach(c => c?.destroy?.());
  charts = {};

  document.getElementById('appScreen').classList.add('hidden');
  document.getElementById('authScreen').classList.remove('hidden');
  document.getElementById('loginForm').reset();
  document.getElementById('registerForm').reset();
  document.getElementById('loginError').textContent    = '';
  document.getElementById('registerError').textContent = '';
  lucide.createIcons();
}

async function loadAllData() {
  const [exp, bud] = await Promise.all([
    apiFetch('/expenses'),
    apiFetch('/budgets'),
  ]);
  expenses = exp;
  budgets  = bud;
}

// ─────────────────────────────────────────
// AUTH FORMS
// ─────────────────────────────────────────

// Tab switching
document.querySelectorAll('.auth-tab, .link-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.toggle('active', f.id === tab + 'Form'));
  });
});

// Password visibility toggle
document.querySelectorAll('.pw-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    input.type  = input.type === 'password' ? 'text' : 'password';
    btn.querySelector('svg').setAttribute('data-lucide', input.type === 'password' ? 'eye' : 'eye-off');
    lucide.createIcons({ scope: btn });
  });
});

// Login
document.getElementById('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const errEl = document.getElementById('loginError');
  errEl.textContent = '';
  const btn = e.target.querySelector('button[type="submit"]');
  btn.textContent = 'Signing in…';
  btn.disabled    = true;

  try {
    const data = await apiFetch('/login', {
      method: 'POST',
      body: JSON.stringify({
        username: document.getElementById('loginUser').value,
        password: document.getElementById('loginPass').value,
      }),
    });
    await showApp(data.token, data.user);
  } catch (err) {
    errEl.textContent = err.message;
  } finally {
    btn.textContent = 'Sign in';
    btn.disabled    = false;
  }
});

// Register
document.getElementById('registerForm').addEventListener('submit', async e => {
  e.preventDefault();
  const errEl = document.getElementById('registerError');
  errEl.textContent = '';
  const btn = e.target.querySelector('button[type="submit"]');
  btn.textContent = 'Creating account…';
  btn.disabled    = true;

  try {
    const data = await apiFetch('/register', {
      method: 'POST',
      body: JSON.stringify({
        name:     document.getElementById('regName').value,
        username: document.getElementById('regUser').value,
        password: document.getElementById('regPass').value,
      }),
    });
    await showApp(data.token, data.user);
    showToast('Welcome to Spendora! 🎉');
  } catch (err) {
    errEl.textContent = err.message;
  } finally {
    btn.textContent = 'Create account';
    btn.disabled    = false;
  }
});

// Logout
document.getElementById('logoutBtn').addEventListener('click', () => {
  if (confirm('Sign out of your account?')) showAuth();
});

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────
const CAT_COLORS = {
  '🍔 Food & Dining':  '#f97316',
  '🚗 Transport':      '#3b82f6',
  '🛍️ Shopping':      '#a855f7',
  '💡 Utilities':      '#06b6d4',
  '🏥 Healthcare':     '#10b981',
  '🎬 Entertainment':  '#ef4444',
  '📚 Education':      '#8b5cf6',
  '🏠 Housing':        '#f59e0b',
  '✈️ Travel':         '#0ea5e9',
  '💪 Fitness':        '#22c55e',
  '🎁 Gifts':          '#ec4899',
  '📦 Other':          '#94a3b8',
};

const fmt = n => '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });

function thisMonth() {
  const now = dayjs();
  return expenses.filter(e => dayjs(e.date).month() === now.month() && dayjs(e.date).year() === now.year());
}

function groupByCat(arr) {
  const m = {};
  arr.forEach(e => { m[e.category] = (m[e.category] || 0) + +e.amount; });
  return m;
}

function getDailyTotals(days) {
  return Array.from({ length: days }, (_, i) => {
    const d = dayjs().subtract(days - 1 - i, 'day');
    const v = expenses
      .filter(e => dayjs(e.date).format('YYYY-MM-DD') === d.format('YYYY-MM-DD'))
      .reduce((s, e) => s + +e.amount, 0);
    return { label: d.format(days > 14 ? 'MMM D' : 'ddd D'), value: v };
  });
}

function getMonthlyTotals() {
  const m = {};
  expenses.forEach(e => {
    const k = dayjs(e.date).format('MMM \'YY');
    m[k] = (m[k] || 0) + +e.amount;
  });
  return Object.entries(m)
    .sort((a, b) => dayjs(a[0], "MMM 'YY") - dayjs(b[0], "MMM 'YY"))
    .slice(-9);
}

function catEmoji(cat) { return cat ? cat.split(' ')[0] : '📦'; }
function catName(cat)  { return cat ? cat.split(' ').slice(1).join(' ') : 'Other'; }

// ─────────────────────────────────────────
// KPI CARDS
// ─────────────────────────────────────────
function updateKPIs() {
  const monthly  = thisMonth();
  const total    = monthly.reduce((s, e) => s + +e.amount, 0);
  const daysPast = dayjs().date();
  const catMap   = groupByCat(monthly);
  const topCat   = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0];

  document.getElementById('totalSpent').textContent = fmt(total);
  document.getElementById('txCount').textContent    = expenses.length;
  document.getElementById('dailyAvg').textContent   = fmt(daysPast ? total / daysPast : 0);
  document.getElementById('highestCat').textContent = topCat ? catName(topCat[0]) : '—';
}

// ─────────────────────────────────────────
// SMART INSIGHTS
// ─────────────────────────────────────────
function buildInsights() {
  const grid    = document.getElementById('insightsGrid');
  const monthly = thisMonth();

  if (!monthly.length) {
    grid.innerHTML = `<div class="insight-item info"><i data-lucide="info"></i><p>Add your first expense to unlock smart insights.</p></div>`;
    lucide.createIcons({ scope: grid });
    return;
  }

  const items  = [];
  const catMap = groupByCat(monthly);
  const total  = monthly.reduce((s, e) => s + +e.amount, 0);
  const top    = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0];
  const pct    = Math.round((top[1] / total) * 100);

  items.push({ type: pct > 40 ? 'warn' : 'info', icon: 'pie-chart',
    html: `<strong>${top[0]}</strong> makes up ${pct}% of this month's spending.` });

  const projected = (total / dayjs().date()) * dayjs().daysInMonth();
  items.push({ type: 'info', icon: 'trending-up',
    html: `On current pace you'll spend about <strong>${fmt(projected)}</strong> this month.` });

  const dayFreq = {};
  monthly.forEach(e => { const d = dayjs(e.date).format('ddd'); dayFreq[d] = (dayFreq[d] || 0) + 1; });
  const busiest = Object.entries(dayFreq).sort((a, b) => b[1] - a[1])[0];
  if (busiest) items.push({ type: 'warn', icon: 'calendar',
    html: `You spend most on <strong>${busiest[0]}s</strong>. Plan ahead for those days.` });

  budgets.forEach(b => {
    const spent = catMap[b.category] || 0;
    const p     = Math.round((spent / b.monthly_limit) * 100);
    if (p >= 100)
      items.push({ type: 'warn', icon: 'alert-circle',
        html: `Budget exceeded for <strong>${catName(b.category)}</strong> (${p}% used).` });
    else if (p >= 75)
      items.push({ type: 'warn', icon: 'alert-triangle',
        html: `<strong>${catName(b.category)}</strong> budget is ${p}% used.` });
  });

  const largest = monthly.reduce((m, e) => +e.amount > +m.amount ? e : m, monthly[0]);
  if (+largest.amount > total * 0.25)
    items.push({ type: 'info', icon: 'zap',
      html: `Largest transaction: <strong>${largest.title}</strong> at ${fmt(largest.amount)}.` });

  if (total < 2000 && monthly.length >= 3)
    items.push({ type: 'good', icon: 'award', html: `Spending is low this month — great discipline!` });

  grid.innerHTML = items.map(i =>
    `<div class="insight-item ${i.type}"><i data-lucide="${i.icon}"></i><p>${i.html}</p></div>`
  ).join('');
  lucide.createIcons({ scope: grid });
}

// ─────────────────────────────────────────
// CHARTS
// ─────────────────────────────────────────
const axisStyle = {
  ticks: { color: '#8891b4', font: { size: 11, family: "'Plus Jakarta Sans'" } },
  grid:  { color: 'rgba(74,82,120,0.1)' },
};

function buildLineChart() {
  const data = getDailyTotals(lineChartDays);
  const ctx  = document.getElementById('lineChart').getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 200);
  grad.addColorStop(0, 'rgba(37,99,235,0.15)');
  grad.addColorStop(1, 'rgba(37,99,235,0)');

  if (charts.line) charts.line.destroy();
  charts.line = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => d.label),
      datasets: [{
        data: data.map(d => d.value),
        borderColor: '#2563EB', backgroundColor: grad,
        tension: 0.4, fill: true,
        pointBackgroundColor: '#2563EB',
        pointRadius: 3, pointHoverRadius: 6, borderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ' ' + fmt(ctx.parsed.y) } } },
      scales: {
        x: { ...axisStyle, grid: { color: 'rgba(74,82,120,0.07)' } },
        y: { ...axisStyle, grid: { color: 'rgba(74,82,120,0.07)' }, ticks: { ...axisStyle.ticks, callback: v => fmt(v) } },
      }
    }
  });
}

function buildDonutChart() {
  const catMap = groupByCat(thisMonth());
  const cats   = Object.keys(catMap);
  const vals   = Object.values(catMap);
  const colors = cats.map(c => CAT_COLORS[c] || '#94a3b8');
  const ctx    = document.getElementById('donutChart').getContext('2d');

  if (charts.donut) charts.donut.destroy();
  if (!cats.length) {
    document.getElementById('donutLegend').innerHTML = '<p style="color:var(--text-muted);font-size:13px">No data this month</p>';
    return;
  }

  charts.donut = new Chart(ctx, {
    type: 'doughnut',
    data: { labels: cats, datasets: [{ data: vals, backgroundColor: colors, borderWidth: 0, hoverOffset: 6 }] },
    options: {
      cutout: '68%',
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${catName(ctx.label)}: ${fmt(ctx.parsed)}` } } }
    }
  });

  document.getElementById('donutLegend').innerHTML = cats.map((c, i) =>
    `<div class="leg-item"><div class="leg-dot" style="background:${colors[i]}"></div>${catName(c)}</div>`
  ).join('');
}

function buildBarChart() {
  const data = getMonthlyTotals();
  const ctx  = document.getElementById('barChart').getContext('2d');
  if (charts.bar) charts.bar.destroy();
  if (!data.length) return;

  charts.bar = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d[0]),
      datasets: [{
        data: data.map(d => d[1]),
        backgroundColor: 'rgba(37,99,235,0.12)',
        borderColor: '#2563EB', borderWidth: 1.5,
        borderRadius: 6, borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ' ' + fmt(ctx.parsed.y) } } },
      scales: {
        x: { ...axisStyle, grid: { display: false } },
        y: { ...axisStyle, ticks: { ...axisStyle.ticks, callback: v => fmt(v) } },
      }
    }
  });
}

function buildPieChart() {
  const catMap = groupByCat(expenses);
  const cats   = Object.keys(catMap);
  const vals   = Object.values(catMap);
  const colors = cats.map(c => CAT_COLORS[c] || '#94a3b8');
  const ctx    = document.getElementById('pieChart').getContext('2d');
  if (charts.pie) charts.pie.destroy();
  if (!cats.length) return;

  charts.pie = new Chart(ctx, {
    type: 'pie',
    data: { labels: cats, datasets: [{ data: vals, backgroundColor: colors, borderWidth: 0, hoverOffset: 5 }] },
    options: {
      plugins: {
        legend: { display: true, labels: { color: '#4a5278', font: { size: 12, family: "'Plus Jakarta Sans'" }, boxWidth: 10, padding: 12 } },
        tooltip: { callbacks: { label: ctx => ` ${catName(ctx.label)}: ${fmt(ctx.parsed)}` } }
      }
    }
  });
}

function buildAnalyticsKPIs() {
  const el = document.getElementById('analyticsStats');
  if (!expenses.length) { el.innerHTML = ''; return; }

  const total  = expenses.reduce((s, e) => s + +e.amount, 0);
  const months = getMonthlyTotals();
  const avgMo  = months.length ? months.reduce((s, m) => s + m[1], 0) / months.length : 0;
  const catMap = groupByCat(expenses);
  const topCat = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0];
  const largest= expenses.reduce((m, e) => +e.amount > +m.amount ? e : m, expenses[0]);

  const items = [
    { label: 'All-Time Total',   value: fmt(total) },
    { label: 'Monthly Average',  value: fmt(avgMo) },
    { label: 'Top Category',     value: topCat ? catName(topCat[0]) : '—' },
    { label: 'Largest Purchase', value: fmt(largest.amount) },
    { label: 'Total Entries',    value: expenses.length },
    { label: 'Active Months',    value: months.length },
  ];

  el.innerHTML = items.map(i =>
    `<div class="a-kpi"><p class="a-kpi-label">${i.label}</p><p class="a-kpi-value">${i.value}</p></div>`
  ).join('');
}

// ─────────────────────────────────────────
// TRANSACTIONS
// ─────────────────────────────────────────
function txHTML(e) {
  return `
    <div class="tx-item" data-id="${e.id}">
      <div class="tx-emoji">${catEmoji(e.category)}</div>
      <div class="tx-body">
        <div class="tx-title">${e.title}</div>
        <div class="tx-meta">
          <span>${dayjs(e.date).format('DD MMM YYYY')}</span>
          <span class="tx-badge">${catName(e.category)}</span>
          ${e.payment ? `<span class="tx-badge">${e.payment}</span>` : ''}
          ${e.note    ? `<span class="tx-badge">${e.note}</span>`    : ''}
        </div>
      </div>
      <div class="tx-amount">${fmt(e.amount)}</div>
      <button class="tx-del" data-id="${e.id}"><i data-lucide="trash-2"></i></button>
    </div>
  `;
}

function renderRecent() {
  const el   = document.getElementById('recentList');
  const list = [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6);
  el.innerHTML = list.length
    ? list.map(txHTML).join('')
    : `<div class="empty-state"><i data-lucide="inbox"></i><p>No transactions yet.</p></div>`;
  lucide.createIcons({ scope: el });
}

function renderFull() {
  const el     = document.getElementById('fullTxList');
  const search = document.getElementById('searchInput').value.toLowerCase();
  const catFil = document.getElementById('filterCat').value;
  const sort   = document.getElementById('filterSort').value;

  let list = [...expenses];
  if (search) list = list.filter(e => e.title.toLowerCase().includes(search) || (e.note||'').toLowerCase().includes(search) || (e.category||'').toLowerCase().includes(search));
  if (catFil) list = list.filter(e => e.category === catFil);

  list.sort((a, b) => {
    if (sort === 'date-desc')   return new Date(b.date) - new Date(a.date);
    if (sort === 'date-asc')    return new Date(a.date) - new Date(b.date);
    if (sort === 'amount-desc') return +b.amount - +a.amount;
    if (sort === 'amount-asc')  return +a.amount - +b.amount;
    return 0;
  });

  el.innerHTML = list.length
    ? list.map(txHTML).join('')
    : `<div class="empty-state"><i data-lucide="inbox"></i><p>No transactions found.</p></div>`;
  lucide.createIcons({ scope: el });
}

function populateCategoryFilter() {
  const sel  = document.getElementById('filterCat');
  const cats = [...new Set(expenses.map(e => e.category).filter(Boolean))];
  sel.innerHTML = '<option value="">All Categories</option>' +
    cats.map(c => `<option value="${c}">${c}</option>`).join('');
}

// ─────────────────────────────────────────
// BUDGETS
// ─────────────────────────────────────────
function renderBudgets() {
  const grid   = document.getElementById('budgetGrid');
  const catMap = groupByCat(thisMonth());

  if (!budgets.length) {
    grid.innerHTML = `<div class="empty-state"><i data-lucide="target"></i><p>No budgets set yet.</p></div>`;
    lucide.createIcons({ scope: grid });
    return;
  }

  grid.innerHTML = budgets.map(b => {
    const spent = catMap[b.category] || 0;
    const pct   = Math.min(Math.round((spent / b.monthly_limit) * 100), 100);
    const cls   = pct >= 100 ? 'fill-over' : pct >= 75 ? 'fill-warn' : 'fill-safe';
    const note  = pct >= 100 ? '— Over budget' : pct >= 75 ? '— Approaching limit' : '';
    return `
      <div class="budget-card">
        <div class="bc-head">
          <span class="bc-title">${b.category}</span>
          <button class="bc-del" data-id="${b.id}"><i data-lucide="trash-2"></i></button>
        </div>
        <div class="bc-amounts"><span class="bc-spent">${fmt(spent)}</span><span class="bc-limit">of ${fmt(b.monthly_limit)}</span></div>
        <div class="progress-bg"><div class="progress-fill ${cls}" style="width:${pct}%"></div></div>
        <p class="bc-pct">${pct}% used ${note}</p>
      </div>
    `;
  }).join('');
  lucide.createIcons({ scope: grid });
}

// ─────────────────────────────────────────
// MASTER RENDER
// ─────────────────────────────────────────
function renderAll() {
  updateKPIs();
  buildInsights();
  buildLineChart();
  buildDonutChart();
  renderRecent();
  populateCategoryFilter();
  renderFull();
  buildBarChart();
  buildPieChart();
  buildAnalyticsKPIs();
  renderBudgets();
}

// ─────────────────────────────────────────
// NAVIGATION
// ─────────────────────────────────────────
let currentView = 'dashboard';

function switchView(view, pushState = true) {
  currentView = view;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item[data-view]').forEach(n => n.classList.remove('active'));
  document.getElementById('view-' + view).classList.add('active');
  document.querySelector(`.nav-item[data-view="${view}"]`).classList.add('active');
  document.getElementById('pageTitle').textContent =
    { dashboard: 'Dashboard', transactions: 'Transactions', analytics: 'Analytics', budget: 'Budgets' }[view] || view;

  if (view === 'analytics') { buildBarChart(); buildPieChart(); buildAnalyticsKPIs(); }
  if (view === 'dashboard') { buildLineChart(); buildDonutChart(); }
  document.getElementById('sidebar').classList.remove('open');

  // Push to browser history so back button works
  if (pushState) {
    history.pushState({ view }, '', '#' + view);
  }
}

// Handle back/forward browser navigation
window.addEventListener('popstate', e => {
  if (e.state?.view) {
    switchView(e.state.view, false);
  } else {
    switchView('dashboard', false);
  }
});

// ─────────────────────────────────────────
// MODALS
// ─────────────────────────────────────────
const openOverlay  = id => document.getElementById(id).classList.add('open');
const closeOverlay = id => document.getElementById(id).classList.remove('open');

document.getElementById('openModal').addEventListener('click', () => openOverlay('modal'));
document.getElementById('closeModal').addEventListener('click', () => closeOverlay('modal'));
document.getElementById('openBudgetModal').addEventListener('click', () => openOverlay('budgetModal'));
document.getElementById('closeBudgetModal').addEventListener('click', () => closeOverlay('budgetModal'));
document.querySelectorAll('.overlay').forEach(ov =>
  ov.addEventListener('click', e => { if (e.target === ov) ov.classList.remove('open'); })
);

// ─────────────────────────────────────────
// ADD EXPENSE  →  POST /api/expenses
// ─────────────────────────────────────────
document.getElementById('expenseForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.textContent = 'Saving…';
  btn.disabled    = true;

  try {
    const newExp = await apiFetch('/expenses', {
      method: 'POST',
      body: JSON.stringify({
        title:    document.getElementById('expTitle').value.trim(),
        amount:   parseFloat(document.getElementById('expAmount').value),
        category: document.getElementById('expCategory').value,
        date:     document.getElementById('expDate').value,
        note:     document.getElementById('expNote').value.trim(),
        payment:  document.querySelector('input[name="pay"]:checked')?.value || 'Cash',
      }),
    });

    expenses.unshift(newExp);   // add to front (newest first)
    renderAll();
    closeOverlay('modal');
    e.target.reset();
    document.getElementById('expDate').value = dayjs().format('YYYY-MM-DD');
    showToast('Expense saved.');
  } catch (err) {
    showToast('Error: ' + err.message);
  } finally {
    btn.textContent = 'Save Expense';
    btn.disabled    = false;
  }
});

// ─────────────────────────────────────────
// SET BUDGET  →  POST /api/budgets
// ─────────────────────────────────────────
document.getElementById('budgetForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.textContent = 'Saving…';
  btn.disabled    = true;

  try {
    const saved = await apiFetch('/budgets', {
      method: 'POST',
      body: JSON.stringify({
        category:      document.getElementById('budCat').value,
        monthly_limit: parseFloat(document.getElementById('budLimit').value),
      }),
    });

    // Replace or add in local array
    const idx = budgets.findIndex(b => b.id === saved.id || b.category === saved.category);
    if (idx > -1) budgets[idx] = saved;
    else budgets.push(saved);

    renderBudgets();
    buildInsights();
    closeOverlay('budgetModal');
    e.target.reset();
    showToast('Budget saved.');
  } catch (err) {
    showToast('Error: ' + err.message);
  } finally {
    btn.textContent = 'Save Budget';
    btn.disabled    = false;
  }
});

// ─────────────────────────────────────────
// DELETE EXPENSE  →  DELETE /api/expenses/:id
// ─────────────────────────────────────────
document.addEventListener('click', async e => {
  const btn = e.target.closest('.tx-del');
  if (!btn) return;
  if (!confirm('Delete this expense?')) return;

  const id = btn.dataset.id;
  try {
    await apiFetch('/expenses/' + id, { method: 'DELETE' });
    expenses = expenses.filter(ex => String(ex.id) !== String(id));
    renderAll();
    showToast('Expense removed.');
  } catch (err) {
    showToast('Error: ' + err.message);
  }
});

// ─────────────────────────────────────────
// DELETE BUDGET  →  DELETE /api/budgets/:id
// ─────────────────────────────────────────
document.addEventListener('click', async e => {
  const btn = e.target.closest('.bc-del');
  if (!btn) return;

  const id = btn.dataset.id;
  try {
    await apiFetch('/budgets/' + id, { method: 'DELETE' });
    budgets = budgets.filter(b => String(b.id) !== String(id));
    renderBudgets();
    showToast('Budget removed.');
  } catch (err) {
    showToast('Error: ' + err.message);
  }
});

// ─────────────────────────────────────────
// EXPORT CSV
// ─────────────────────────────────────────
document.getElementById('exportCSV').addEventListener('click', () => {
  if (!expenses.length) { showToast('No data to export.'); return; }
  const rows = [['Title','Amount','Category','Date','Payment','Note'],
    ...expenses.map(e => [e.title, e.amount, e.category, e.date, e.payment, e.note || ''])];
  const csv  = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a    = Object.assign(document.createElement('a'), {
    href: 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv),
    download: `spendora_${currentUser?.username}_${dayjs().format('YYYY-MM-DD')}.csv`,
  });
  a.click();
  showToast('CSV exported.');
});

// ─────────────────────────────────────────
// SEARCH + FILTERS
// ─────────────────────────────────────────
document.getElementById('searchInput').addEventListener('input', () => {
  if (currentView !== 'transactions') switchView('transactions');
  renderFull();
});
document.getElementById('filterCat').addEventListener('change', renderFull);
document.getElementById('filterSort').addEventListener('change', renderFull);

// ─────────────────────────────────────────
// LINE CHART SEGMENTS
// ─────────────────────────────────────────
document.querySelectorAll('.seg').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.seg').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    lineChartDays = parseInt(btn.dataset.days);
    buildLineChart();
  });
});

// ─────────────────────────────────────────
// PAYMENT CHIPS
// ─────────────────────────────────────────
document.getElementById('paymentOptions').addEventListener('click', e => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  document.querySelectorAll('#paymentOptions .chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  chip.querySelector('input').checked = true;
});

// ─────────────────────────────────────────
// HAMBURGER
// ─────────────────────────────────────────
document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
  // Close sidebar when clicking outside on mobile
document.getElementById('appScreen').addEventListener('click', (e) => {
  if (!e.target.closest('.sidebar') && !e.target.closest('#hamburger')) {
    document.getElementById('sidebar').classList.remove('open');
  }
});
});
// ─────────────────────────────────────────
// DARK MODE
// ─────────────────────────────────────────
function isDark() {
  return document.documentElement.classList.contains('dark');
}

function applyTheme(dark) {
  document.documentElement.classList.toggle('dark', dark);
  localStorage.setItem('spendora_theme', dark ? 'dark' : 'light');
  const btn = document.getElementById('themeToggle');
  btn.querySelector('svg').setAttribute('data-lucide', dark ? 'sun' : 'moon');
  lucide.createIcons({ scope: btn });
  buildLineChart();
  buildDonutChart();
  buildBarChart();
  buildPieChart();
}

document.getElementById('themeToggle').addEventListener('click', () => {
  applyTheme(!isDark());
});

// ─────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

// ─────────────────────────────────────────
// INIT — restore session on page load
// ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    // Restore view from URL hash on load
  const hashView = window.location.hash.replace('#', '');
  if (['dashboard','transactions','analytics','budget'].includes(hashView)) {
    currentView = hashView;
  }
   // Restore saved theme
  const savedTheme = localStorage.getItem('spendora_theme');
  if (savedTheme === 'dark') applyTheme(true);

  lucide.createIcons();
  if (loadSession()) {
    // Verify token is still valid with server
    try {
      const user = await apiFetch('/me');
      await showApp(token, user);
    } catch {
      // Token expired or invalid — show login
      showAuth();
    }
  }
});
