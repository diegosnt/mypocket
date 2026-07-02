import { api } from './api.js';

let charts = {};
let txData = [];
let catData = [];
let ccData = [];

export function initAnalytics() {
  setDefaults();
  setLoading();
  document.getElementById('analytics-apply').addEventListener('click', fetchAndRender);
  document.getElementById('analytics-currency').addEventListener('change', render);
  window.addEventListener('themechange', () => {
    if (document.getElementById('analytics-body').style.display !== 'none') render();
  });
  fetchAndRender();
}

function setDefaults() {
  const now = new Date();
  const oneMonthAgo = new Date(now);
  oneMonthAgo.setMonth(now.getMonth() - 1);
  document.getElementById('analytics-from').value = oneMonthAgo.toISOString().slice(0, 10);
  document.getElementById('analytics-to').value = now.toISOString().slice(0, 10);
  document.getElementById('analytics-currency').value = localStorage.getItem('currency') || 'ARS';
}

function setLoading() {
  document.getElementById('analytics-kpis').innerHTML =
    '<p style="grid-column:1/-1;color:var(--color-text-muted);font-size:.9rem;">Cargando...</p>';
  ['wrap-category', 'wrap-period', 'wrap-balance', 'wrap-payment'].forEach((id) => {
    emptyWrap(id, 'Cargando...');
  });
}

function setError(msg) {
  document.getElementById('analytics-kpis').innerHTML =
    `<p style="grid-column:1/-1;color:var(--color-danger);font-size:.9rem;">Error: ${msg}</p>`;
  ['wrap-category', 'wrap-period', 'wrap-balance', 'wrap-payment'].forEach((id) => {
    emptyWrap(id, 'Error al cargar datos');
  });
}

async function fetchAndRender() {
  setLoading();
  try {
    [txData, catData, ccData] = await Promise.all([
      api.transactions.getAll(),
      api.categories.getAll(),
      api.creditCards.getAll(),
    ]);
    render();
  } catch (err) {
    console.error('[analytics]', err);
    setError(err.message);
  }
}

function cur() {
  return document.getElementById('analytics-currency').value || 'ARS';
}

function fmt(n) {
  const c = cur();
  return new Intl.NumberFormat(c === 'ARS' ? 'es-AR' : 'en-US', {
    style: 'currency', currency: c,
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
}

function getFiltered() {
  const from = document.getElementById('analytics-from').value;
  const to = document.getElementById('analytics-to').value;
  const c = cur();
  return txData.filter((t) => {
    if (t.currency !== c) return false;
    if (from && t.date < from) return false;
    if (to && t.date > to) return false;
    return true;
  });
}

function tc() {
  const s = getComputedStyle(document.documentElement);
  const g = (v) => s.getPropertyValue(v).trim();
  return {
    text: g('--color-text'),
    muted: g('--color-text-muted'),
    border: g('--color-border'),
    surface: g('--color-surface'),
    success: g('--color-success'),
    danger: g('--color-danger'),
    primary: g('--color-primary'),
  };
}

function destroyChart(key) {
  if (charts[key]) { charts[key].destroy(); delete charts[key]; }
}

function clearWrap(id) {
  const el = document.getElementById(id);
  el.innerHTML = '';
  el.style.height = '';
  return el;
}

function emptyWrap(id, msg) {
  const el = document.getElementById(id);
  el.innerHTML = `<p class="chart-empty" style="padding-top:4rem;">${msg}</p>`;
}

function addCanvas(wrap) {
  const c = document.createElement('canvas');
  wrap.appendChild(c);
  return c;
}

function render() {
  const tx = getFiltered();
  renderKPIs(tx);
  renderCategoryDonut(tx);
  renderPeriodBar(tx);
  renderBalanceLine(tx);
  renderPaymentBar(tx);
}

// ─── KPIs ─────────────────────────────────────────

function renderKPIs(tx) {
  const settled = tx.filter((t) => t.status === 'settled');
  const income = settled.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expenses = settled.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = income - expenses;

  document.getElementById('analytics-kpis').innerHTML = `
    <div class="kpi-card"><p>Ingresos</p><strong class="amount--income">${fmt(income)}</strong></div>
    <div class="kpi-card"><p>Egresos</p><strong class="amount--expense">${fmt(expenses)}</strong></div>
    <div class="kpi-card"><p>Balance</p><strong class="${balance >= 0 ? 'amount--income' : 'amount--expense'}">${(balance >= 0 ? '+' : '') + fmt(Math.abs(balance))}</strong></div>
    <div class="kpi-card"><p>Movimientos</p><strong>${tx.length}</strong></div>`;
}

// ─── 1. Donut: egresos por categoría ──────────────

function renderCategoryDonut(tx) {
  destroyChart('cat');
  const expenses = tx.filter((t) => t.type === 'expense' && t.status === 'settled');
  const totals = {};
  expenses.forEach((t) => { totals[t.category] = (totals[t.category] || 0) + t.amount; });
  const labels = Object.keys(totals).sort((a, b) => totals[b] - totals[a]);

  if (!labels.length) return emptyWrap('wrap-category', 'Sin egresos en el período');

  const wrap = clearWrap('wrap-category');
  const canvas = addCanvas(wrap);
  const { text, surface } = tc();

  charts.cat = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: labels.map((l) => totals[l]),
        backgroundColor: labels.map((l) => {
          const cat = catData.find((c) => c.name === l);
          return (cat ? cat.color : '#94a3b8') + 'dd';
        }),
        borderColor: surface,
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: labels.length > 6 ? 'bottom' : 'right',
          labels: { color: text, padding: 10, font: { size: 11 }, boxWidth: 12, boxHeight: 12 },
        },
        tooltip: { callbacks: { label: (c) => ` ${c.label}: ${fmt(c.parsed)}` } },
      },
      cutout: '58%',
    },
  });
}

// ─── 2. Bar: ingresos vs egresos por período ───────

function renderPeriodBar(tx) {
  destroyChart('period');
  const settled = tx.filter((t) => t.status === 'settled');
  if (!settled.length) return emptyWrap('wrap-period', 'Sin movimientos liquidados en el período');

  const from = document.getElementById('analytics-from').value;
  const to = document.getElementById('analytics-to').value;
  const daysDiff = from && to ? Math.round((new Date(to) - new Date(from)) / 86400000) : 90;
  const groupBy = daysDiff <= 14 ? 'day' : daysDiff <= 60 ? 'week' : 'month';

  function getKey(dateStr) {
    if (groupBy === 'day') return dateStr.slice(0, 10);
    if (groupBy === 'month') return dateStr.slice(0, 7);
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDay();
    const mon = new Date(d);
    mon.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    return mon.toISOString().slice(0, 10);
  }

  function fmtKey(key) {
    if (groupBy === 'day') return key.slice(5).replace('-', '/');
    if (groupBy === 'month') {
      const [y, m] = key.split('-');
      return new Date(+y, +m - 1, 1).toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
    }
    return 'Sem ' + key.slice(5).replace('-', '/');
  }

  const keys = [...new Set(settled.map((t) => getKey(t.date)))].sort();
  const incomeD = keys.map((k) =>
    settled.filter((t) => t.type === 'income' && getKey(t.date) === k).reduce((s, t) => s + t.amount, 0)
  );
  const expenseD = keys.map((k) =>
    settled.filter((t) => t.type === 'expense' && getKey(t.date) === k).reduce((s, t) => s + t.amount, 0)
  );

  const { text, muted, border, success, danger } = tc();
  const wrap = clearWrap('wrap-period');
  const canvas = addCanvas(wrap);

  charts.period = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: keys.map(fmtKey),
      datasets: [
        { label: 'Ingresos', data: incomeD, backgroundColor: success + '88', borderColor: success, borderWidth: 1, borderRadius: 4 },
        { label: 'Egresos', data: expenseD, backgroundColor: danger + '88', borderColor: danger, borderWidth: 1, borderRadius: 4 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: text, font: { size: 11 }, boxWidth: 12, boxHeight: 12 } },
        tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${fmt(c.parsed.y)}` } },
      },
      scales: {
        x: { ticks: { color: muted, font: { size: 10 } }, grid: { color: border + '60' } },
        y: { ticks: { color: muted, font: { size: 10 }, callback: (v) => fmt(v) }, grid: { color: border + '60' } },
      },
    },
  });
}

// ─── 3. Line: balance acumulado ────────────────────

function renderBalanceLine(tx) {
  destroyChart('balance');
  const settled = tx
    .filter((t) => t.status === 'settled')
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  if (!settled.length) return emptyWrap('wrap-balance', 'Sin movimientos liquidados en el período');

  const byDate = {};
  settled.forEach((t) => {
    const d = t.date.slice(0, 10);
    byDate[d] = (byDate[d] || 0) + (t.type === 'income' ? t.amount : -t.amount);
  });

  const dates = Object.keys(byDate).sort();
  let cum = 0;
  const points = dates.map((d) => { cum += byDate[d]; return { x: d, y: cum }; });

  const { muted, border, success, danger } = tc();
  const lineColor = cum >= 0 ? success : danger;
  const wrap = clearWrap('wrap-balance');
  const canvas = addCanvas(wrap);

  charts.balance = new Chart(canvas, {
    type: 'line',
    data: {
      labels: points.map((p) => p.x.slice(5).replace('-', '/')),
      datasets: [{
        label: 'Balance',
        data: points.map((p) => p.y),
        borderColor: lineColor,
        backgroundColor: lineColor + '22',
        fill: true,
        tension: 0.3,
        pointRadius: points.length > 40 ? 0 : 3,
        pointHoverRadius: 5,
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => ` ${fmt(c.parsed.y)}` } },
      },
      scales: {
        x: { ticks: { color: muted, font: { size: 10 }, maxTicksLimit: 10 }, grid: { color: border + '60' } },
        y: { ticks: { color: muted, font: { size: 10 }, callback: (v) => fmt(v) }, grid: { color: border + '60' } },
      },
    },
  });
}

// ─── 4. Horizontal bar: egresos por medio de pago ─

function renderPaymentBar(tx) {
  destroyChart('payment');
  const expenses = tx.filter((t) => t.type === 'expense' && t.status === 'settled');
  const totals = {};

  expenses.forEach((t) => {
    let label;
    if (t.credit_card_id) {
      const cc = ccData.find((c) => c.id === t.credit_card_id);
      label = cc ? (cc.bank ? `${cc.name} — ${cc.bank}` : cc.name) : 'TC';
    } else {
      label = t.origin || 'Débito';
    }
    totals[label] = (totals[label] || 0) + t.amount;
  });

  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return emptyWrap('wrap-payment', 'Sin egresos en el período');

  const labels = entries.map(([k]) => k);
  const values = entries.map(([, v]) => v);
  const palette = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#14b8a6', '#f97316', '#a855f7'];

  const { text, muted, border } = tc();
  const wrap = clearWrap('wrap-payment');
  wrap.style.height = Math.max(180, entries.length * 42 + 40) + 'px';
  const canvas = addCanvas(wrap);

  charts.payment = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: labels.map((_, i) => palette[i % palette.length] + 'bb'),
        borderColor: labels.map((_, i) => palette[i % palette.length]),
        borderWidth: 1,
        borderRadius: 4,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => ` ${fmt(c.parsed.x)}` } },
      },
      scales: {
        x: { ticks: { color: muted, font: { size: 10 }, callback: (v) => fmt(v) }, grid: { color: border + '60' } },
        y: { ticks: { color: text, font: { size: 11 } }, grid: { display: false } },
      },
    },
  });
}
