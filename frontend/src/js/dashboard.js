import { api } from './api.js';

let categories = [];
let transactions = [];
let origins = [];
let chart = null;
let editingId = null;
let editingCategoryId = null;
let editingOriginId = null;

let sortCol = 'date';
let sortDir = 'desc';
const colFilters = { description: '', category: '', type: '', origin: '' };
let tableInitialized = false;

function formatAmount(amount) {
  const currency = localStorage.getItem('currency') || 'ARS';
  const locale = currency === 'ARS' ? 'es-AR' : 'en-US';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export async function initDashboard(user) {
  document.getElementById('user-name').textContent = user.name;
  document.getElementById('btn-logout').addEventListener('click', logout);

  const currencySelect = document.getElementById('currency-select');
  currencySelect.value = localStorage.getItem('currency') || 'ARS';

  await loadCategories();
  await loadOrigins();
  await loadTransactions();
  setupForm();
  setupTypeToggle();
  setupCategoryPanel();
  setupOriginPanel();
  document.getElementById('btn-add-expense').addEventListener('click', openAddForm);
  document.getElementById('btn-cancel').addEventListener('click', closeForm);
  document.getElementById('btn-categories').addEventListener('click', toggleCategoryPanel);
  document.getElementById('btn-close-categories').addEventListener('click', toggleCategoryPanel);
  document.getElementById('btn-origins').addEventListener('click', toggleOriginsPanel);
  document.getElementById('btn-close-origins').addEventListener('click', toggleOriginsPanel);

  document.getElementById('filter-category').addEventListener('change', (e) => {
    colFilters.category = e.target.value;
    renderList();
  });
  document.getElementById('filter-type').addEventListener('change', (e) => {
    colFilters.type = e.target.value;
    renderList();
  });
  document.getElementById('filter-month').addEventListener('change', renderChart);
  window.addEventListener('themechange', renderChart);

  currencySelect.addEventListener('change', () => {
    localStorage.setItem('currency', currencySelect.value);
    renderList();
    renderChart();
    updateSummary();
  });

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      tableInitialized = false;
      renderList();
    }, 250);
  });
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.reload();
}

async function loadCategories() {
  try {
    categories = await api.categories.getAll();
    refreshCategorySelects();
  } catch (err) {
    console.error('Failed to load categories:', err);
  }
}

function refreshCategorySelects() {
  document.querySelectorAll('.category-select').forEach((sel) => {
    const current = sel.value;
    sel.innerHTML = '';
    categories.forEach((cat) => {
      const opt = document.createElement('option');
      opt.value = cat.name;
      opt.textContent = cat.name;
      sel.appendChild(opt);
    });
    if (current) sel.value = current;
  });

  const filterCat = document.getElementById('filter-category');
  const currentFilter = filterCat.value;
  filterCat.innerHTML = '<option value="">Todas las categorías</option>';
  categories.forEach((cat) => {
    const opt = document.createElement('option');
    opt.value = cat.name;
    opt.textContent = cat.name;
    filterCat.appendChild(opt);
  });
  if (currentFilter) filterCat.value = currentFilter;

  updateCategoryFilterOptions();
}

async function loadOrigins() {
  try {
    origins = await api.origins.getAll();
    refreshOriginSelects();
  } catch (err) {
    console.error('Failed to load origins:', err);
  }
}

function refreshOriginSelects() {
  document.querySelectorAll('.origin-select').forEach((sel) => {
    const current = sel.value;
    sel.innerHTML = '';
    origins.forEach((orig) => {
      const opt = document.createElement('option');
      opt.value = orig.name;
      opt.textContent = orig.name;
      sel.appendChild(opt);
    });
    if (current) {
      sel.value = current;
    } else {
      const debito = origins.find((o) => o.name === 'Débito');
      if (debito) sel.value = debito.name;
    }
  });
  updateOriginFilterOptions();
}

async function loadTransactions() {
  try {
    transactions = await api.transactions.getAll();
    renderList();
    renderChart();
    updateSummary();
  } catch (err) {
    console.error('Failed to load transactions:', err);
  }
}

function selectedCurrency() {
  return document.getElementById('currency-select').value || 'ARS';
}

function getFiltered() {
  const currency = selectedCurrency();
  return transactions.filter((t) => {
    if (t.currency !== currency) return false;
    if (colFilters.category && t.category !== colFilters.category) return false;
    if (colFilters.type && t.type !== colFilters.type) return false;
    if (colFilters.origin && t.origin !== colFilters.origin) return false;
    if (colFilters.description && !t.description.toLowerCase().includes(colFilters.description.toLowerCase())) return false;
    return true;
  });
}

function getSortedFiltered() {
  return [...getFiltered()].sort((a, b) => {
    let va = a[sortCol];
    let vb = b[sortCol];
    if (sortCol === 'amount') { va = Number(va); vb = Number(vb); }
    else { va = String(va); vb = String(vb); }
    const cmp = va < vb ? -1 : va > vb ? 1 : 0;
    return sortDir === 'asc' ? cmp : -cmp;
  });
}

// ─── Render dispatch ──────────────────────────────

function renderList() {
  const list = document.getElementById('expense-list');
  if (window.innerWidth >= 769) {
    if (!tableInitialized && list.querySelector('.expense-item')) {
      list.innerHTML = '';
    }
    renderTable();
  } else {
    if (tableInitialized) {
      tableInitialized = false;
      list.innerHTML = '';
    }
    renderCards();
  }
}

// ─── Desktop Table View ───────────────────────────

function buildTableShell() {
  return `
    <table class="tx-table">
      <colgroup>
        <col style="width:82px">
        <col>
        <col style="width:108px">
        <col style="width:98px">
        <col style="width:72px">
        <col style="width:100px">
        <col style="width:66px">
      </colgroup>
      <thead>
        <tr class="tx-head">
          <th class="sortable" data-col="date">Fecha <span class="sort-icon" data-col="date"></span></th>
          <th class="sortable tx-col-desc" data-col="description">Descripción <span class="sort-icon" data-col="description"></span></th>
          <th class="sortable" data-col="category">Categoría <span class="sort-icon" data-col="category"></span></th>
          <th class="sortable" data-col="origin">Origen <span class="sort-icon" data-col="origin"></span></th>
          <th class="sortable" data-col="type">Tipo <span class="sort-icon" data-col="type"></span></th>
          <th class="sortable tx-right" data-col="amount">Monto <span class="sort-icon" data-col="amount"></span></th>
          <th class="tx-actions-head"></th>
        </tr>
        <tr class="tx-filter-row">
          <td></td>
          <td><input type="search" id="cf-description" placeholder="Buscar…" value="${escHtml(colFilters.description)}" /></td>
          <td><select id="cf-category"><option value="">Todas</option></select></td>
          <td><select id="cf-origin"><option value="">Todos</option></select></td>
          <td>
            <select id="cf-type">
              <option value="">Todos</option>
              <option value="expense"${colFilters.type === 'expense' ? ' selected' : ''}>Egreso</option>
              <option value="income"${colFilters.type === 'income' ? ' selected' : ''}>Ingreso</option>
            </select>
          </td>
          <td></td>
          <td></td>
        </tr>
      </thead>
      <tbody class="tx-tbody"></tbody>
    </table>`;
}

function updateCategoryFilterOptions() {
  const sel = document.getElementById('cf-category');
  if (!sel) return;
  sel.innerHTML = '<option value="">Todas</option>';
  categories.forEach((cat) => {
    const opt = document.createElement('option');
    opt.value = cat.name;
    opt.textContent = cat.name;
    if (cat.name === colFilters.category) opt.selected = true;
    sel.appendChild(opt);
  });
}

function updateOriginFilterOptions() {
  const sel = document.getElementById('cf-origin');
  if (!sel) return;
  sel.innerHTML = '<option value="">Todos</option>';
  origins.forEach((orig) => {
    const opt = document.createElement('option');
    opt.value = orig.name;
    opt.textContent = orig.name;
    if (orig.name === colFilters.origin) opt.selected = true;
    sel.appendChild(opt);
  });
}

function bindTableHeaderEvents() {
  const list = document.getElementById('expense-list');

  list.querySelectorAll('.tx-head th.sortable').forEach((th) => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (sortCol === col) {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        sortCol = col;
        sortDir = col === 'amount' ? 'desc' : 'asc';
      }
      updateSortIndicators();
      renderTableBody();
    });
  });

  list.querySelector('#cf-description').addEventListener('input', (e) => {
    colFilters.description = e.target.value;
    renderTableBody();
  });

  list.querySelector('#cf-category').addEventListener('change', (e) => {
    colFilters.category = e.target.value;
    document.getElementById('filter-category').value = e.target.value;
    renderTableBody();
  });

  list.querySelector('#cf-origin').addEventListener('change', (e) => {
    colFilters.origin = e.target.value;
    renderTableBody();
  });

  list.querySelector('#cf-type').addEventListener('change', (e) => {
    colFilters.type = e.target.value;
    document.getElementById('filter-type').value = e.target.value;
    renderTableBody();
  });
}

function updateSortIndicators() {
  document.querySelectorAll('.sort-icon').forEach((icon) => {
    const col = icon.dataset.col;
    icon.className = 'sort-icon' + (sortCol === col ? ` ${sortDir}` : '');
  });
  document.querySelectorAll('.tx-head th').forEach((th) => {
    th.classList.toggle('sort-active', th.dataset.col === sortCol);
  });
}

function renderTable() {
  const list = document.getElementById('expense-list');
  if (!tableInitialized) {
    list.innerHTML = buildTableShell();
    bindTableHeaderEvents();
    tableInitialized = true;
  }
  updateCategoryFilterOptions();
  updateOriginFilterOptions();
  updateSortIndicators();
  renderTableBody();
}

function renderTableBody() {
  const tbody = document.querySelector('.tx-tbody');
  if (!tbody) return;

  const filtered = getSortedFiltered();
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="tx-empty">Sin movimientos para los filtros aplicados.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((t) => {
    const isIncome = t.type === 'income';
    const color = categoryColor(t.category);
    return `
      <tr data-id="${t.id}">
        <td class="tx-date">${formatDate(t.date)}</td>
        <td class="tx-desc">${escHtml(t.description)}</td>
        <td><span class="expense-category-badge" style="background:${color}22;color:${color}">${escHtml(t.category)}</span></td>
        <td><span class="tx-origin-pill">${escHtml(t.origin || 'Débito')}</span></td>
        <td><span class="tx-type-pill ${isIncome ? 'tx-type--income' : 'tx-type--expense'}">${isIncome ? 'Ingreso' : 'Egreso'}</span></td>
        <td class="tx-right">
          <span class="tx-amount ${isIncome ? 'amount--income' : 'amount--expense'}">${isIncome ? '+' : '-'}${formatAmount(t.amount)}</span>
        </td>
        <td class="tx-actions-cell">
          <div class="tx-actions">
            <button class="btn-icon btn-edit" aria-label="Edit" data-id="${t.id}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="btn-icon btn-delete" aria-label="Delete" data-id="${t.id}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
              </svg>
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');

  tbody.querySelectorAll('.btn-edit').forEach((btn) => {
    btn.addEventListener('click', () => openEditForm(Number(btn.dataset.id)));
  });
  tbody.querySelectorAll('.btn-delete').forEach((btn) => {
    btn.addEventListener('click', () => deleteTransaction(Number(btn.dataset.id)));
  });
}

// ─── Mobile Card View ─────────────────────────────

function renderCards() {
  const list = document.getElementById('expense-list');
  const filtered = getSortedFiltered();

  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M9 14l2 2 4-4M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0z"/>
        </svg>
        <p>Sin movimientos. ¡Agregá el primero!</p>
      </div>`;
    return;
  }

  list.innerHTML = filtered.map((t) => {
    const isIncome = t.type === 'income';
    return `
    <div class="expense-item" data-id="${t.id}">
      <div class="expense-left">
        <span class="type-dot ${isIncome ? 'type-dot--income' : 'type-dot--expense'}" title="${t.type}"></span>
        <span class="expense-category-badge" style="background:${categoryColor(t.category)}22;color:${categoryColor(t.category)}">${escHtml(t.category)}</span>
        <div>
          <p class="expense-description">${escHtml(t.description)}</p>
          <p class="expense-date">${formatDate(t.date)} · ${escHtml(t.origin || 'Débito')}</p>
        </div>
      </div>
      <div class="expense-right">
        <span class="expense-amount ${isIncome ? 'amount--income' : ''}">${isIncome ? '+' : '-'}${formatAmount(t.amount)}</span>
        <div class="expense-actions">
          <button class="btn-icon btn-edit" aria-label="Edit" data-id="${t.id}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="btn-icon btn-delete" aria-label="Delete" data-id="${t.id}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>`;
  }).join('');

  list.querySelectorAll('.btn-edit').forEach((btn) => {
    btn.addEventListener('click', () => openEditForm(Number(btn.dataset.id)));
  });
  list.querySelectorAll('.btn-delete').forEach((btn) => {
    btn.addEventListener('click', () => deleteTransaction(Number(btn.dataset.id)));
  });
}

// ─── Summary ──────────────────────────────────────

function updateSummary() {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthTx = transactions.filter((t) => t.date.startsWith(currentMonth) && t.currency === selectedCurrency());

  const income = monthTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expenses = monthTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = income - expenses;

  document.getElementById('total-income').textContent = formatAmount(income);
  document.getElementById('total-expenses').textContent = formatAmount(expenses);

  const balanceEl = document.getElementById('total-balance');
  balanceEl.textContent = (balance >= 0 ? '+' : '') + formatAmount(Math.abs(balance));
  balanceEl.className = balance >= 0 ? 'amount--income' : 'amount--expense';
}

// ─── Chart ────────────────────────────────────────

function renderChart() {
  const monthFilter = document.getElementById('filter-month').value;
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const targetMonth = monthFilter || currentMonth;

  const monthExpenses = transactions.filter(
    (t) => t.type === 'expense' && t.currency === selectedCurrency() && t.date.startsWith(targetMonth)
  );

  const totals = {};
  monthExpenses.forEach((t) => {
    totals[t.category] = (totals[t.category] || 0) + t.amount;
  });

  const labels = Object.keys(totals);
  const data = Object.values(totals);
  const colors = labels.map((l) => categoryColor(l));

  const canvas = document.getElementById('expense-chart');
  if (chart) chart.destroy();

  if (labels.length === 0) {
    canvas.parentElement.innerHTML = `
      <canvas id="expense-chart"></canvas>
      <p class="chart-empty">Sin egresos para ${targetMonth}</p>`;
    return;
  }

  chart = new Chart(document.getElementById('expense-chart'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: 'var(--color-surface)',
      }],
    },
    options: {
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: 'var(--color-text)', padding: 12, font: { size: 12 } },
        },
        tooltip: {
          callbacks: { label: (ctx) => ` ${ctx.label}: ${formatAmount(ctx.parsed)}` },
        },
      },
      cutout: '65%',
    },
  });
}

// ─── Form ─────────────────────────────────────────

function setupTypeToggle() {
  const btns = document.querySelectorAll('.type-btn');
  const input = document.getElementById('tx-type');
  btns.forEach((btn) => {
    btn.addEventListener('click', () => {
      btns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      input.value = btn.dataset.type;
    });
  });
}

function setupForm() {
  const form = document.getElementById('form-expense');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('error-expense');
    errorEl.hidden = true;
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;

    const body = {
      type: document.getElementById('tx-type').value,
      currency: selectedCurrency(),
      amount: form.amount.value,
      description: form.description.value,
      category: form.category.value,
      origin: form.origin.value,
      date: form.date.value,
    };

    try {
      if (editingId) {
        const updated = await api.transactions.update(editingId, body);
        transactions = transactions.map((t) => (t.id === editingId ? updated : t));
      } else {
        const created = await api.transactions.create(body);
        transactions.unshift(created);
      }
      closeForm();
      renderList();
      renderChart();
      updateSummary();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
    } finally {
      btn.disabled = false;
    }
  });

  form.date.value = new Date().toISOString().slice(0, 10);
}

function openAddForm() {
  editingId = null;
  const form = document.getElementById('form-expense');
  form.reset();
  form.date.value = new Date().toISOString().slice(0, 10);
  setFormType('expense');
  const debito = origins.find((o) => o.name === 'Débito');
  if (debito) form.origin.value = debito.name;
  document.getElementById('form-title').textContent = 'Nuevo movimiento';
  document.getElementById('error-expense').hidden = true;
  document.getElementById('expense-form-panel').hidden = false;
  form.description.focus();
}

function openEditForm(id) {
  const tx = transactions.find((t) => t.id === id);
  if (!tx) return;
  editingId = id;
  const form = document.getElementById('form-expense');
  setFormType(tx.type);
  form.description.value = tx.description;
  form.amount.value = tx.amount;
  form.category.value = tx.category;
  form.origin.value = tx.origin || 'Débito';
  form.date.value = tx.date;
  document.getElementById('form-title').textContent = 'Editar movimiento';
  document.getElementById('error-expense').hidden = true;
  document.getElementById('expense-form-panel').hidden = false;
  form.description.focus();
}

function setFormType(type) {
  document.getElementById('tx-type').value = type;
  document.querySelectorAll('.type-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.type === type);
  });
}

function closeForm() {
  document.getElementById('expense-form-panel').hidden = true;
  editingId = null;
}

async function deleteTransaction(id) {
  if (!confirm('¿Eliminar este movimiento?')) return;
  try {
    await api.transactions.delete(id);
    transactions = transactions.filter((t) => t.id !== id);
    renderList();
    renderChart();
    updateSummary();
  } catch (err) {
    alert(err.message);
  }
}

// ─── Category panel ───────────────────────────────

function toggleCategoryPanel() {
  const panel = document.getElementById('categories-panel');
  panel.hidden = !panel.hidden;
  if (!panel.hidden) renderCategoryList();
}

function renderCategoryList() {
  const list = document.getElementById('categories-list');
  if (categories.length === 0) {
    list.innerHTML = '<p style="color:var(--color-text-muted);font-size:.875rem;">Sin categorías.</p>';
    return;
  }
  list.innerHTML = categories.map((cat) => `
    <div class="category-row" data-id="${cat.id}">
      <span class="category-color-dot" style="background:${cat.color}"></span>
      <span class="category-row-name">${escHtml(cat.name)}</span>
      <div class="expense-actions">
        <button class="btn-icon btn-edit-cat" aria-label="Editar" data-id="${cat.id}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="btn-icon btn-delete-cat" aria-label="Eliminar" data-id="${cat.id}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
          </svg>
        </button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.btn-edit-cat').forEach((btn) => {
    btn.addEventListener('click', () => openEditCategory(Number(btn.dataset.id)));
  });
  list.querySelectorAll('.btn-delete-cat').forEach((btn) => {
    btn.addEventListener('click', () => deleteCategory(Number(btn.dataset.id)));
  });
}

function setupCategoryPanel() {
  const form = document.getElementById('form-category');
  const errorEl = document.getElementById('error-category');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    const body = { name: form.catname.value.trim(), color: form.catcolor.value };
    try {
      if (editingCategoryId) {
        const updated = await api.categories.update(editingCategoryId, body);
        categories = categories.map((c) => (c.id === editingCategoryId ? updated : c));
        editingCategoryId = null;
        btn.textContent = 'Agregar';
      } else {
        const created = await api.categories.create(body);
        categories.push(created);
        categories.sort((a, b) => a.name.localeCompare(b.name));
      }
      form.reset();
      form.catcolor.value = '#6366f1';
      refreshCategorySelects();
      renderCategoryList();
      renderList();
      renderChart();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
    } finally {
      btn.disabled = false;
    }
  });
}

function openEditCategory(id) {
  const cat = categories.find((c) => c.id === id);
  if (!cat) return;
  editingCategoryId = id;
  const form = document.getElementById('form-category');
  form.catname.value = cat.name;
  form.catcolor.value = cat.color;
  form.querySelector('button[type="submit"]').textContent = 'Guardar cambios';
  form.catname.focus();
}

async function deleteCategory(id) {
  const cat = categories.find((c) => c.id === id);
  if (!cat || !confirm(`¿Eliminar la categoría "${cat.name}"?`)) return;
  const errorEl = document.getElementById('error-category');
  errorEl.hidden = true;
  try {
    await api.categories.delete(id);
    categories = categories.filter((c) => c.id !== id);
    refreshCategorySelects();
    renderCategoryList();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  }
}

// ─── Origins panel ────────────────────────────────

function toggleOriginsPanel() {
  const panel = document.getElementById('origins-panel');
  panel.hidden = !panel.hidden;
  if (!panel.hidden) renderOriginList();
}

function renderOriginList() {
  const list = document.getElementById('origins-list');
  if (origins.length === 0) {
    list.innerHTML = '<p style="color:var(--color-text-muted);font-size:.875rem;">Sin orígenes.</p>';
    return;
  }
  list.innerHTML = origins.map((orig) => `
    <div class="category-row" data-id="${orig.id}">
      <span class="category-row-name">${escHtml(orig.name)}</span>
      <div class="expense-actions">
        <button class="btn-icon btn-edit-orig" aria-label="Editar" data-id="${orig.id}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="btn-icon btn-delete-orig" aria-label="Eliminar" data-id="${orig.id}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
          </svg>
        </button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.btn-edit-orig').forEach((btn) => {
    btn.addEventListener('click', () => openEditOrigin(Number(btn.dataset.id)));
  });
  list.querySelectorAll('.btn-delete-orig').forEach((btn) => {
    btn.addEventListener('click', () => deleteOrigin(Number(btn.dataset.id)));
  });
}

function setupOriginPanel() {
  const form = document.getElementById('form-origin');
  const errorEl = document.getElementById('error-origin');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    const body = { name: form.origname.value.trim() };
    try {
      if (editingOriginId) {
        const updated = await api.origins.update(editingOriginId, body);
        origins = origins.map((o) => (o.id === editingOriginId ? updated : o));
        editingOriginId = null;
        btn.textContent = 'Agregar';
      } else {
        const created = await api.origins.create(body);
        origins.push(created);
        origins.sort((a, b) => a.name.localeCompare(b.name));
      }
      form.reset();
      refreshOriginSelects();
      renderOriginList();
      renderList();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
    } finally {
      btn.disabled = false;
    }
  });
}

function openEditOrigin(id) {
  const orig = origins.find((o) => o.id === id);
  if (!orig) return;
  editingOriginId = id;
  const form = document.getElementById('form-origin');
  form.origname.value = orig.name;
  form.querySelector('button[type="submit"]').textContent = 'Guardar cambios';
  form.origname.focus();
}

async function deleteOrigin(id) {
  const orig = origins.find((o) => o.id === id);
  if (!orig || !confirm(`¿Eliminar el origen "${orig.name}"?`)) return;
  const errorEl = document.getElementById('error-origin');
  errorEl.hidden = true;
  try {
    await api.origins.delete(id);
    origins = origins.filter((o) => o.id !== id);
    refreshOriginSelects();
    renderOriginList();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  }
}

// ─── Helpers ──────────────────────────────────────

function categoryColor(name) {
  const cat = categories.find((c) => c.name === name);
  return cat ? cat.color : '#94a3b8';
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const parts = String(dateStr).replace(/\//g, '-').slice(0, 10).split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
