import { api } from './api.js';

let categories = [];
let transactions = [];
let origins = [];
let creditCards = [];
let chart = null;
let editingId = null;
let editingCategoryId = null;
let editingOriginId = null;
let editingCreditCardId = null;

let importParsedRows = [];

let payCardTarget = { id: null, currency: 'ARS' };

let sortCol = 'date';
let sortDir = 'desc';
const colFilters = { description: '', category: '', type: '', origin: '' };
let tableInitialized = false;

const PAGE_SIZE = 25;
let currentPage = 1;

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
  await loadCreditCards();
  await loadTransactions();
  setupForm();
  setupTypeToggle();
  setupCategoryPanel();
  setupOriginPanel();
  setupCreditCardPanel();
  document.getElementById('btn-add-expense').addEventListener('click', openAddForm);
  document.getElementById('btn-cancel').addEventListener('click', closeForm);
  document.getElementById('btn-categories').addEventListener('click', openCategoriesModal);
  document.getElementById('btn-close-categories').addEventListener('click', closeCategoriesModal);
  document.getElementById('btn-origins').addEventListener('click', openOriginsModal);
  document.getElementById('btn-close-origins').addEventListener('click', closeOriginsModal);
  document.getElementById('btn-credit-cards').addEventListener('click', openCreditCardsModal);
  document.getElementById('btn-close-credit-cards').addEventListener('click', closeCreditCardsModal);
  document.getElementById('btn-import').addEventListener('click', openImportModal);
  document.getElementById('btn-close-import').addEventListener('click', closeImportModal);
  document.getElementById('import-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeImportModal();
  });
  document.getElementById('btn-close-pay-card').addEventListener('click', closePayCardModal);
  document.getElementById('pay-card-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closePayCardModal();
  });
  document.getElementById('pay-card-currency').addEventListener('change', updatePayCardPreview);
  document.getElementById('pay-card-amount').addEventListener('input', updatePayCardPreview);
  document.getElementById('btn-confirm-pay-card').addEventListener('click', confirmPayCard);
  document.getElementById('btn-chart').addEventListener('click', openChartModal);
  document.getElementById('btn-close-chart').addEventListener('click', closeChartModal);
  document.getElementById('chart-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeChartModal();
  });
  document.getElementById('expense-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeForm();
  });
  document.getElementById('categories-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeCategoriesModal();
  });
  document.getElementById('origins-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeOriginsModal();
  });
  document.getElementById('credit-cards-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeCreditCardsModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeChartModal();
      closeForm();
      closeCategoriesModal();
      closeOriginsModal();
      closeCreditCardsModal();
      closeImportModal();
      closePayCardModal();
    }
  });

  document.getElementById('filter-category').addEventListener('change', (e) => {
    colFilters.category = e.target.value;
    currentPage = 1;
    renderList();
  });
  document.getElementById('filter-type').addEventListener('change', (e) => {
    colFilters.type = e.target.value;
    currentPage = 1;
    renderList();
  });
  document.getElementById('filter-month').addEventListener('change', renderChart);
  window.addEventListener('themechange', () => {
    if (!document.getElementById('chart-modal').hidden) renderChart();
  });

  currencySelect.addEventListener('change', () => {
    localStorage.setItem('currency', currencySelect.value);
    currentPage = 1;
    renderList();
    if (!document.getElementById('chart-modal').hidden) renderChart();
    updateSummary();
  });

  document.getElementById('import-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const { rows } = parseCSV(ev.target.result);
      importParsedRows = rows;
      renderImportPreview(rows);
    };
    reader.readAsText(file, 'UTF-8');
  });

  document.getElementById('import-card').addEventListener('change', () => {
    const valid = importParsedRows.filter((r) => r.errors.length === 0);
    document.getElementById('btn-confirm-import').disabled =
      valid.length === 0 || !document.getElementById('import-card').value;
  });

  document.getElementById('btn-confirm-import').addEventListener('click', confirmImport);

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

async function loadCreditCards() {
  try {
    creditCards = await api.creditCards.getAll();
    refreshPaymentSelect();
  } catch (err) {
    console.error('Failed to load credit cards:', err);
  }
}

function refreshOriginSelects() {
  updateOriginFilterOptions();
  refreshPaymentSelect();
}

function refreshPaymentSelect() {
  const sel = document.getElementById('exp-payment');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '';

  if (origins.length > 0) {
    const group = document.createElement('optgroup');
    group.label = 'Medios de pago';
    origins.forEach((orig) => {
      const opt = document.createElement('option');
      opt.value = orig.name;
      opt.textContent = orig.name;
      group.appendChild(opt);
    });
    sel.appendChild(group);
  }

  if (creditCards.length > 0) {
    const group = document.createElement('optgroup');
    group.label = 'Tarjetas de crédito';
    creditCards.forEach((cc) => {
      const opt = document.createElement('option');
      opt.value = `tc:${cc.id}`;
      opt.textContent = cc.bank ? `${cc.name} — ${cc.bank}` : cc.name;
      group.appendChild(opt);
    });
    sel.appendChild(group);
  }

  if (current) sel.value = current;
  else {
    const debito = origins.find((o) => o.name === 'Débito');
    if (debito) sel.value = debito.name;
  }
}

async function loadTransactions() {
  try {
    transactions = await api.transactions.getAll();
    currentPage = 1;
    renderList();
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
    if (colFilters.origin && (t.origin !== colFilters.origin || t.credit_card_id)) return false;
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

function getPagedItems() {
  const all = getSortedFiltered();
  const start = (currentPage - 1) * PAGE_SIZE;
  return all.slice(start, start + PAGE_SIZE);
}

function totalPages() {
  return Math.max(1, Math.ceil(getSortedFiltered().length / PAGE_SIZE));
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
      currentPage = 1;
      updateSortIndicators();
      renderTableBody();
    });
  });

  list.querySelector('#cf-description').addEventListener('input', (e) => {
    colFilters.description = e.target.value;
    currentPage = 1;
    renderTableBody();
  });

  list.querySelector('#cf-category').addEventListener('change', (e) => {
    colFilters.category = e.target.value;
    document.getElementById('filter-category').value = e.target.value;
    currentPage = 1;
    renderTableBody();
  });

  list.querySelector('#cf-origin').addEventListener('change', (e) => {
    colFilters.origin = e.target.value;
    currentPage = 1;
    renderTableBody();
  });

  list.querySelector('#cf-type').addEventListener('change', (e) => {
    colFilters.type = e.target.value;
    document.getElementById('filter-type').value = e.target.value;
    currentPage = 1;
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

  const filtered = getPagedItems();
  if (getSortedFiltered().length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="tx-empty">Sin movimientos para los filtros aplicados.</td></tr>`;
    renderPagination();
    return;
  }

  tbody.innerHTML = filtered.map((t) => {
    const isIncome = t.type === 'income';
    const color = categoryColor(t.category);
    const isPending = t.status === 'pending';
    return `
      <tr data-id="${t.id}">
        <td class="tx-date">${formatDate(t.date)}</td>
        <td class="tx-desc">${escHtml(t.description)}</td>
        <td><span class="expense-category-badge" style="background:${color}22;color:${color}">${escHtml(t.category)}</span></td>
        <td><span class="tx-origin-pill">${escHtml(paymentLabel(t))}</span></td>
        <td><span class="tx-type-pill ${isIncome ? 'tx-type--income' : 'tx-type--expense'}">${isIncome ? 'Ingreso' : 'Egreso'}</span></td>
        <td class="tx-right">
          <span class="tx-amount ${isIncome ? 'amount--income' : 'amount--expense'}">${isIncome ? '+' : '-'}${formatAmount(t.amount)}</span>${isPending ? '<span class="tx-pending-badge">Pendiente</span>' : ''}
        </td>
        <td class="tx-actions-cell">
          <div class="tx-actions">
            <button class="btn-icon btn-clone" aria-label="Clonar" data-id="${t.id}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            </button>
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

  tbody.querySelectorAll('.btn-clone').forEach((btn) => {
    btn.addEventListener('click', () => cloneTransaction(Number(btn.dataset.id)));
  });
  tbody.querySelectorAll('.btn-edit').forEach((btn) => {
    btn.addEventListener('click', () => openEditForm(Number(btn.dataset.id)));
  });
  tbody.querySelectorAll('.btn-delete').forEach((btn) => {
    btn.addEventListener('click', () => deleteTransaction(Number(btn.dataset.id)));
  });
  renderPagination();
}

// ─── Mobile Card View ─────────────────────────────

function renderCards() {
  const list = document.getElementById('expense-list');
  const filtered = getPagedItems();

  if (getSortedFiltered().length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M9 14l2 2 4-4M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0z"/>
        </svg>
        <p>Sin movimientos. ¡Agregá el primero!</p>
      </div>`;
    renderPagination();
    return;
  }

  list.innerHTML = filtered.map((t) => {
    const isIncome = t.type === 'income';
    const isPending = t.status === 'pending';
    return `
    <div class="expense-item" data-id="${t.id}">
      <div class="expense-left">
        <span class="type-dot ${isIncome ? 'type-dot--income' : 'type-dot--expense'}" title="${t.type}"></span>
        <span class="expense-category-badge" style="background:${categoryColor(t.category)}22;color:${categoryColor(t.category)}">${escHtml(t.category)}</span>
        <div>
          <p class="expense-description">${escHtml(t.description)}</p>
          <p class="expense-date">${formatDate(t.date)} · ${escHtml(paymentLabel(t))}</p>
        </div>
      </div>
      <div class="expense-right">
        <span class="expense-amount ${isIncome ? 'amount--income' : ''}">${isIncome ? '+' : '-'}${formatAmount(t.amount)}${isPending ? '<span class="tx-pending-badge">Pendiente</span>' : ''}</span>
        <div class="expense-actions">
          <button class="btn-icon btn-clone" aria-label="Clonar" data-id="${t.id}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </button>
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

  list.querySelectorAll('.btn-clone').forEach((btn) => {
    btn.addEventListener('click', () => cloneTransaction(Number(btn.dataset.id)));
  });
  list.querySelectorAll('.btn-edit').forEach((btn) => {
    btn.addEventListener('click', () => openEditForm(Number(btn.dataset.id)));
  });
  list.querySelectorAll('.btn-delete').forEach((btn) => {
    btn.addEventListener('click', () => deleteTransaction(Number(btn.dataset.id)));
  });
  renderPagination();
}

// ─── Summary ──────────────────────────────────────

function updateSummary() {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currency = selectedCurrency();
  const monthTx = transactions.filter((t) => t.date.startsWith(currentMonth) && t.currency === currency);

  const settled = monthTx.filter((t) => t.status === 'settled');
  const income = settled.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expenses = settled.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = income - expenses;

  document.getElementById('total-income').textContent = formatAmount(income);
  document.getElementById('total-expenses').textContent = formatAmount(expenses);

  const balanceEl = document.getElementById('total-balance');
  balanceEl.textContent = (balance >= 0 ? '+' : '') + formatAmount(Math.abs(balance));
  balanceEl.className = balance >= 0 ? 'amount--income' : 'amount--expense';

  renderTCDebtSummary();
}

function renderTCDebtSummary() {
  const el = document.getElementById('tc-debt-summary');
  if (!el) return;
  const pending = transactions.filter((t) => t.status === 'pending' && t.credit_card_id);
  if (pending.length === 0) { el.hidden = true; return; }

  const byCard = {};
  pending.forEach((t) => {
    const key = t.credit_card_id;
    if (!byCard[key]) byCard[key] = { ARS: 0, USD: 0 };
    byCard[key][t.currency] = (byCard[key][t.currency] || 0) + t.amount;
  });

  el.hidden = false;
  el.innerHTML = `
    <div class="tc-debt-header">Deuda en tarjetas</div>
    <div class="tc-debt-cards">
      ${Object.entries(byCard).map(([cardId, amounts]) => {
        const cc = creditCards.find((c) => c.id === Number(cardId));
        const label = cc ? (cc.bank ? `${cc.name} — ${cc.bank}` : cc.name) : `TC #${cardId}`;
        const parts = [];
        if (amounts.ARS) parts.push(new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(amounts.ARS));
        if (amounts.USD) parts.push(new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(amounts.USD));
        return `<div class="tc-debt-item">
  <span class="tc-debt-name">${escHtml(label)}</span>
  <span class="tc-debt-amount">${parts.join(' · ')}</span>
  <button class="btn btn-secondary tc-debt-pay-btn" style="padding:.25rem .75rem;font-size:.75rem;width:auto;" data-card-id="${cardId}">Pagar</button>
</div>`;
      }).join('')}
    </div>`;
  el.querySelectorAll('.tc-debt-pay-btn').forEach((btn) => {
    btn.addEventListener('click', () => openPayCardModal(Number(btn.dataset.cardId)));
  });
}

// ─── Chart Modal ─────────────────────────────────

function openChartModal() {
  const modal = document.getElementById('chart-modal');
  modal.hidden = false;
  const now = new Date();
  const input = document.getElementById('filter-month');
  if (!input.value) {
    input.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  renderChart();
}

function closeChartModal() {
  document.getElementById('chart-modal').hidden = true;
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

    const paymentValue = form.payment.value;
    const isTC = paymentValue.startsWith('tc:');
    const body = {
      type: document.getElementById('tx-type').value,
      currency: selectedCurrency(),
      amount: form.amount.value,
      description: form.description.value,
      category: form.category.value,
      date: form.date.value,
      ...(isTC
        ? { credit_card_id: Number(paymentValue.slice(3)) }
        : { origin: paymentValue }),
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
      currentPage = 1;
      renderList();
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
  if (debito) form.payment.value = debito.name;
  document.getElementById('form-title').textContent = 'Nuevo movimiento';
  document.getElementById('error-expense').hidden = true;
  document.getElementById('expense-modal').hidden = false;
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
  if (tx.credit_card_id) {
    form.payment.value = `tc:${tx.credit_card_id}`;
  } else {
    form.payment.value = tx.origin || 'Débito';
  }
  form.date.value = tx.date;
  document.getElementById('form-title').textContent = 'Editar movimiento';
  document.getElementById('error-expense').hidden = true;
  document.getElementById('expense-modal').hidden = false;
  form.description.focus();
}

function setFormType(type) {
  document.getElementById('tx-type').value = type;
  document.querySelectorAll('.type-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.type === type);
  });
}

function closeForm() {
  document.getElementById('expense-modal').hidden = true;
  editingId = null;
}

function cloneTransaction(id) {
  const tx = transactions.find((t) => t.id === id);
  if (!tx) return;
  editingId = null;
  const form = document.getElementById('form-expense');
  form.reset();
  setFormType(tx.type);
  form.description.value = tx.description;
  form.amount.value = tx.amount;
  form.category.value = tx.category;
  if (tx.credit_card_id) {
    form.payment.value = `tc:${tx.credit_card_id}`;
  } else {
    form.payment.value = tx.origin || 'Débito';
  }
  form.date.value = new Date().toISOString().slice(0, 10);
  document.getElementById('form-title').textContent = 'Nuevo movimiento';
  document.getElementById('error-expense').hidden = true;
  document.getElementById('expense-modal').hidden = false;
  form.description.focus();
}

async function deleteTransaction(id) {
  if (!confirm('¿Eliminar este movimiento?')) return;
  try {
    await api.transactions.delete(id);
    transactions = transactions.filter((t) => t.id !== id);
    currentPage = 1;
    renderList();
    updateSummary();
  } catch (err) {
    alert(err.message);
  }
}

// ─── Category panel ───────────────────────────────

function openCategoriesModal() {
  document.getElementById('categories-modal').hidden = false;
  renderCategoryList();
}

function closeCategoriesModal() {
  document.getElementById('categories-modal').hidden = true;
  editingCategoryId = null;
  const form = document.getElementById('form-category');
  form.reset();
  form.catcolor.value = '#6366f1';
  form.querySelector('button[type="submit"]').textContent = 'Agregar';
  document.getElementById('error-category').hidden = true;
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

function openOriginsModal() {
  document.getElementById('origins-modal').hidden = false;
  renderOriginList();
}

function closeOriginsModal() {
  document.getElementById('origins-modal').hidden = true;
  editingOriginId = null;
  const form = document.getElementById('form-origin');
  form.reset();
  form.querySelector('button[type="submit"]').textContent = 'Agregar';
  document.getElementById('error-origin').hidden = true;
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

// ─── Credit card panel ────────────────────────────

function openCreditCardsModal() {
  document.getElementById('credit-cards-modal').hidden = false;
  renderCreditCardList();
}

function closeCreditCardsModal() {
  document.getElementById('credit-cards-modal').hidden = true;
  editingCreditCardId = null;
  const form = document.getElementById('form-credit-card');
  form.reset();
  form.querySelector('button[type="submit"]').textContent = 'Agregar';
  document.getElementById('error-credit-card').hidden = true;
}

function renderCreditCardList() {
  const list = document.getElementById('credit-cards-list');
  if (creditCards.length === 0) {
    list.innerHTML = '<p style="color:var(--color-text-muted);font-size:.875rem;">Sin tarjetas registradas.</p>';
    return;
  }
  list.innerHTML = creditCards.map((cc) => `
    <div class="category-row" data-id="${cc.id}">
      <span class="category-row-name">${escHtml(cc.bank ? `${cc.name} — ${cc.bank}` : cc.name)}</span>
      <div class="expense-actions">
        <button class="btn-icon btn-edit-cc" aria-label="Editar" data-id="${cc.id}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="btn-icon btn-delete-cc" aria-label="Eliminar" data-id="${cc.id}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
          </svg>
        </button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.btn-edit-cc').forEach((btn) => {
    btn.addEventListener('click', () => openEditCreditCard(Number(btn.dataset.id)));
  });
  list.querySelectorAll('.btn-delete-cc').forEach((btn) => {
    btn.addEventListener('click', () => deleteCreditCard(Number(btn.dataset.id)));
  });
}

function setupCreditCardPanel() {
  const form = document.getElementById('form-credit-card');
  const errorEl = document.getElementById('error-credit-card');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    const body = { name: form.ccname.value.trim(), bank: form.ccbank.value.trim() };
    try {
      if (editingCreditCardId) {
        const updated = await api.creditCards.update(editingCreditCardId, body);
        creditCards = creditCards.map((c) => (c.id === editingCreditCardId ? updated : c));
        editingCreditCardId = null;
        btn.textContent = 'Agregar';
      } else {
        const created = await api.creditCards.create(body);
        creditCards.push(created);
        creditCards.sort((a, b) => a.name.localeCompare(b.name));
      }
      form.reset();
      refreshPaymentSelect();
      renderCreditCardList();
      renderList();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
    } finally {
      btn.disabled = false;
    }
  });
}

function openEditCreditCard(id) {
  const cc = creditCards.find((c) => c.id === id);
  if (!cc) return;
  editingCreditCardId = id;
  const form = document.getElementById('form-credit-card');
  form.ccname.value = cc.name;
  form.ccbank.value = cc.bank || '';
  form.querySelector('button[type="submit"]').textContent = 'Guardar cambios';
  form.ccname.focus();
}

async function deleteCreditCard(id) {
  const cc = creditCards.find((c) => c.id === id);
  if (!cc || !confirm(`¿Eliminar la tarjeta "${cc.bank ? `${cc.name} — ${cc.bank}` : cc.name}"?`)) return;
  const errorEl = document.getElementById('error-credit-card');
  errorEl.hidden = true;
  try {
    await api.creditCards.delete(id);
    creditCards = creditCards.filter((c) => c.id !== id);
    refreshPaymentSelect();
    renderCreditCardList();
    renderList();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  }
}

// ─── Import modal ─────────────────────────────────

function openImportModal() {
  importParsedRows = [];
  document.getElementById('import-preview').hidden = true;
  document.getElementById('import-preview-body').innerHTML = '';
  document.getElementById('import-summary').textContent = '';
  document.getElementById('btn-confirm-import').disabled = true;
  document.getElementById('error-import').hidden = true;
  document.getElementById('import-file').value = '';

  const sel = document.getElementById('import-card');
  sel.innerHTML = creditCards.length === 0
    ? '<option value="">Sin tarjetas cargadas</option>'
    : creditCards.map((cc) => `<option value="${cc.id}">${escHtml(cc.bank ? cc.name + ' — ' + cc.bank : cc.name)}</option>`).join('');

  document.getElementById('import-modal').hidden = false;
}

function closeImportModal() {
  document.getElementById('import-modal').hidden = true;
  importParsedRows = [];
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { headers: [], rows: [] };

  const parseRow = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
      else { current += ch; }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseRow(lines[0]).map((h) => h.toLowerCase().replace(/[^a-záéíóúñ]/gi, ''));
  const idx = (name) => headers.indexOf(name);

  const fechaIdx = idx('fecha') !== -1 ? idx('fecha') : idx('date');
  const descIdx = idx('descripcion') !== -1 ? idx('descripcion') : idx('description');
  const montoIdx = idx('monto') !== -1 ? idx('monto') : idx('amount') !== -1 ? idx('amount') : idx('importe');
  const monedaIdx = idx('moneda') !== -1 ? idx('moneda') : idx('currency');
  const catIdx = idx('categoria') !== -1 ? idx('categoria') : idx('category');

  const parseMonto = (str) => {
    if (!str) return NaN;
    const s = String(str).trim().replace(/[$ ]/g, '');
    if (/^\d{1,3}(\.\d{3})*(,\d+)?$/.test(s)) {
      return parseFloat(s.replace(/\./g, '').replace(',', '.'));
    }
    return parseFloat(s.replace(',', '.'));
  };

  const parseFecha = (str) => {
    if (!str) return null;
    const s = String(str).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return null;
  };

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseRow(lines[i]);
    const fecha = parseFecha(fechaIdx !== -1 ? cols[fechaIdx] : null);
    const descripcion = descIdx !== -1 ? cols[descIdx] : '';
    const rawMonto = montoIdx !== -1 ? cols[montoIdx] : '';
    const monto = parseMonto(rawMonto);
    const moneda = monedaIdx !== -1 && cols[monedaIdx] ? cols[monedaIdx].trim().toUpperCase() : 'ARS';
    const categoria = catIdx !== -1 && cols[catIdx] ? cols[catIdx].trim() : 'Otros';

    const errors = [];
    if (!fecha) errors.push('Fecha inválida');
    if (isNaN(monto) || monto <= 0) errors.push('Monto inválido');
    if (!descripcion.trim()) errors.push('Sin descripción');
    if (!['ARS', 'USD'].includes(moneda)) errors.push('Moneda inválida');

    rows.push({ fecha, descripcion, monto: isNaN(monto) ? 0 : monto, moneda, categoria, errors, rawMonto });
  }

  return { rows };
}

function renderImportPreview(rows) {
  const preview = document.getElementById('import-preview');
  const tbody = document.getElementById('import-preview-body');
  const summary = document.getElementById('import-summary');
  const btn = document.getElementById('btn-confirm-import');

  if (rows.length === 0) {
    preview.hidden = true;
    btn.disabled = true;
    return;
  }

  const valid = rows.filter((r) => r.errors.length === 0);
  const invalid = rows.filter((r) => r.errors.length > 0);

  summary.textContent = `${valid.length} fila${valid.length !== 1 ? 's' : ''} válida${valid.length !== 1 ? 's' : ''}${invalid.length > 0 ? ` · ${invalid.length} con error` : ''}`;
  btn.textContent = `Importar ${valid.length} movimiento${valid.length !== 1 ? 's' : ''}`;
  btn.disabled = valid.length === 0 || !document.getElementById('import-card').value;

  tbody.innerHTML = rows.map((r, i) => {
    const hasError = r.errors.length > 0;
    const cat = categories.find((c) => c.name === r.categoria);
    const finalCat = cat ? r.categoria : `${escHtml(r.categoria)} → Otros`;
    return `<tr class="${hasError ? 'import-row--error' : ''}">
      <td>${i + 1}</td>
      <td>${escHtml(r.fecha || '—')}</td>
      <td>${escHtml(r.descripcion || '—')}${hasError ? `<br><span class="import-error-msg">${escHtml(r.errors.join(', '))}</span>` : ''}</td>
      <td>${hasError && isNaN(r.monto) ? escHtml(r.rawMonto || '—') : formatAmount(r.monto)}</td>
      <td>${escHtml(r.moneda)}</td>
      <td>${escHtml(finalCat)}</td>
    </tr>`;
  }).join('');

  preview.hidden = false;
}

async function confirmImport() {
  const cardId = Number(document.getElementById('import-card').value);
  const valid = importParsedRows.filter((r) => r.errors.length === 0);
  if (!cardId || valid.length === 0) return;

  const btn = document.getElementById('btn-confirm-import');
  btn.disabled = true;
  document.getElementById('error-import').hidden = true;

  const rows = valid.map((r) => {
    const cat = categories.find((c) => c.name === r.categoria);
    return {
      fecha: r.fecha,
      descripcion: r.descripcion,
      monto: r.monto,
      moneda: r.moneda,
      categoria: cat ? r.categoria : 'Otros',
    };
  });

  try {
    const result = await api.transactions.import({ credit_card_id: cardId, rows });
    closeImportModal();
    const fresh = await api.transactions.getAll();
    transactions = fresh;
    currentPage = 1;
    renderList();
    updateSummary();
    const el = document.createElement('div');
    el.className = 'import-toast';
    el.textContent = `✓ ${result.imported} movimiento${result.imported !== 1 ? 's' : ''} importado${result.imported !== 1 ? 's' : ''}`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  } catch (err) {
    const errorEl = document.getElementById('error-import');
    errorEl.textContent = err.message;
    errorEl.hidden = false;
    btn.disabled = false;
  }
}

// ─── Pay card modal ───────────────────────────────

function openPayCardModal(cardId) {
  const cc = creditCards.find((c) => c.id === cardId);
  if (!cc) return;

  const pending = transactions.filter((t) => t.status === 'pending' && t.credit_card_id === cardId);
  const hasARS = pending.some((t) => t.currency === 'ARS');
  const hasUSD = pending.some((t) => t.currency === 'USD');
  const defaultCurrency = hasARS ? 'ARS' : 'USD';

  payCardTarget = { id: cardId, currency: defaultCurrency };

  document.getElementById('pay-card-name').value = cc.bank ? `${cc.name} — ${cc.bank}` : cc.name;
  document.getElementById('pay-card-id').value = cardId;
  document.getElementById('pay-card-currency').value = defaultCurrency;
  document.getElementById('error-pay-card').hidden = true;
  document.getElementById('pay-card-preview').textContent = '';

  // pre-fill amount with total pending for default currency
  const total = pending.filter((t) => t.currency === defaultCurrency).reduce((s, t) => s + t.amount, 0);
  document.getElementById('pay-card-amount').value = total > 0 ? total.toFixed(2) : '';

  // hide currency options that have no pending
  const sel = document.getElementById('pay-card-currency');
  sel.querySelectorAll('option').forEach((opt) => {
    opt.hidden = opt.value === 'ARS' ? !hasARS : !hasUSD;
  });

  document.getElementById('pay-card-modal').hidden = false;
  updatePayCardPreview();
}

function closePayCardModal() {
  document.getElementById('pay-card-modal').hidden = true;
  payCardTarget = { id: null, currency: 'ARS' };
}

function updatePayCardPreview() {
  const cardId = Number(document.getElementById('pay-card-id').value);
  const currency = document.getElementById('pay-card-currency').value;
  const amount = parseFloat(document.getElementById('pay-card-amount').value);
  const preview = document.getElementById('pay-card-preview');

  if (!cardId || isNaN(amount) || amount <= 0) {
    preview.textContent = '';
    return;
  }

  // simulate which transactions would be settled (oldest first)
  const pending = transactions
    .filter((t) => t.status === 'pending' && t.credit_card_id === cardId && t.currency === currency)
    .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

  let remaining = amount;
  let count = 0;
  let settledAmt = 0;
  for (const t of pending) {
    if (t.amount <= remaining + 0.001) {
      count++;
      settledAmt += t.amount;
      remaining -= t.amount;
    }
  }

  const totalPending = pending.reduce((s, t) => s + t.amount, 0);
  const locale = currency === 'ARS' ? 'es-AR' : 'en-US';
  const fmt = (n) => new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 2 }).format(n);

  if (count === 0) {
    preview.textContent = totalPending === 0
      ? 'Sin compras pendientes en esta moneda.'
      : `El monto ingresado no alcanza para liquidar ninguna compra (la más antigua es ${fmt(pending[0]?.amount ?? 0)}).`;
  } else {
    preview.textContent = `Se liquidarán ${count} compra${count !== 1 ? 's' : ''} por ${fmt(settledAmt)}${remaining > 0.01 ? ` · Saldo a favor no aplicado: ${fmt(remaining)}` : ''}.`;
  }
}

async function confirmPayCard() {
  const cardId = Number(document.getElementById('pay-card-id').value);
  const currency = document.getElementById('pay-card-currency').value;
  const amount = parseFloat(document.getElementById('pay-card-amount').value);
  const errorEl = document.getElementById('error-pay-card');

  if (!cardId || isNaN(amount) || amount <= 0) return;

  const btn = document.getElementById('btn-confirm-pay-card');
  btn.disabled = true;
  errorEl.hidden = true;

  try {
    const result = await api.transactions.payCard({ credit_card_id: cardId, amount, currency });
    closePayCardModal();
    const fresh = await api.transactions.getAll();
    transactions = fresh;
    currentPage = 1;
    renderList();
    updateSummary();
    if (result.settled_count > 0) {
      const el = document.createElement('div');
      el.className = 'import-toast';
      el.textContent = `✓ ${result.settled_count} compra${result.settled_count !== 1 ? 's' : ''} liquidada${result.settled_count !== 1 ? 's' : ''}`;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 3000);
    }
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  } finally {
    btn.disabled = false;
  }
}

// ─── Pagination ───────────────────────────────────

function renderPagination() {
  const container = document.getElementById('pagination');
  if (!container) return;
  const total = totalPages();
  const allCount = getSortedFiltered().length;

  if (allCount <= PAGE_SIZE) {
    container.innerHTML = '';
    return;
  }

  const start = (currentPage - 1) * PAGE_SIZE + 1;
  const end = Math.min(currentPage * PAGE_SIZE, allCount);

  const pages = [];
  const delta = 2;
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || (i >= currentPage - delta && i <= currentPage + delta)) {
      pages.push(i);
    }
  }
  const withEllipsis = [];
  let prev = null;
  for (const p of pages) {
    if (prev !== null && p - prev > 1) withEllipsis.push('…');
    withEllipsis.push(p);
    prev = p;
  }

  container.innerHTML = `
    <div class="pagination">
      <span class="pagination-info">${start}–${end} de ${allCount}</span>
      <div class="pagination-controls">
        <button class="btn-page" id="pg-prev" ${currentPage === 1 ? 'disabled' : ''}>‹</button>
        ${withEllipsis.map((p) =>
          p === '…'
            ? `<span class="pg-ellipsis">…</span>`
            : `<button class="btn-page${p === currentPage ? ' btn-page--active' : ''}" data-page="${p}">${p}</button>`
        ).join('')}
        <button class="btn-page" id="pg-next" ${currentPage === total ? 'disabled' : ''}>›</button>
      </div>
    </div>`;

  container.querySelector('#pg-prev')?.addEventListener('click', () => {
    if (currentPage > 1) { currentPage--; renderList(); }
  });
  container.querySelector('#pg-next')?.addEventListener('click', () => {
    if (currentPage < total) { currentPage++; renderList(); }
  });
  container.querySelectorAll('.btn-page[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentPage = Number(btn.dataset.page);
      renderList();
    });
  });
}

// ─── Helpers ──────────────────────────────────────

function paymentLabel(t) {
  if (t.credit_card_id) {
    const cc = creditCards.find((c) => c.id === t.credit_card_id);
    return cc ? (cc.bank ? `${cc.name} — ${cc.bank}` : cc.name) : 'TC';
  }
  return t.origin || 'Débito';
}

function categoryColor(name) {
  const cat = categories.find((c) => c.name === name);
  return cat ? cat.color : '#94a3b8';
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return String(dateStr).slice(0, 10).replace(/-/g, '/');
}

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
