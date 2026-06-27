import { api } from './api.js';

const CATEGORIES = [
  'Food', 'Transport', 'Housing', 'Entertainment',
  'Health', 'Shopping', 'Education', 'Travel', 'Other',
];

const CATEGORY_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444',
  '#3b82f6', '#ec4899', '#8b5cf6', '#14b8a6', '#94a3b8',
];

let expenses = [];
let chart = null;
let editingId = null;

export async function initDashboard(user) {
  document.getElementById('user-name').textContent = user.name;
  document.getElementById('btn-logout').addEventListener('click', logout);

  populateCategorySelect();
  await loadExpenses();
  setupForm();
  document.getElementById('btn-add-expense').addEventListener('click', openAddForm);
  document.getElementById('btn-cancel').addEventListener('click', closeForm);
  document.getElementById('filter-category').addEventListener('change', renderList);
  document.getElementById('filter-month').addEventListener('change', renderChart);
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.reload();
}

function populateCategorySelect() {
  const selects = document.querySelectorAll('.category-select');
  const filterCat = document.getElementById('filter-category');
  CATEGORIES.forEach((cat) => {
    selects.forEach((sel) => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      sel.appendChild(opt);
    });
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    filterCat.appendChild(opt);
  });
}

async function loadExpenses() {
  try {
    expenses = await api.expenses.getAll();
    renderList();
    renderChart();
    updateSummary();
  } catch (err) {
    console.error('Failed to load expenses:', err);
  }
}

function getFilteredExpenses() {
  const cat = document.getElementById('filter-category').value;
  return cat ? expenses.filter((e) => e.category === cat) : expenses;
}

function renderList() {
  const list = document.getElementById('expense-list');
  const filtered = getFilteredExpenses();

  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M9 14l2 2 4-4M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0z"/>
        </svg>
        <p>No expenses yet. Add your first one!</p>
      </div>`;
    return;
  }

  list.innerHTML = filtered.map((exp) => `
    <div class="expense-item" data-id="${exp.id}">
      <div class="expense-left">
        <span class="expense-category-badge" style="background:${categoryColor(exp.category)}22;color:${categoryColor(exp.category)}">${exp.category}</span>
        <div>
          <p class="expense-description">${escHtml(exp.description)}</p>
          <p class="expense-date">${formatDate(exp.date)}</p>
        </div>
      </div>
      <div class="expense-right">
        <span class="expense-amount">$${Number(exp.amount).toFixed(2)}</span>
        <div class="expense-actions">
          <button class="btn-icon btn-edit" aria-label="Edit" data-id="${exp.id}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="btn-icon btn-delete" aria-label="Delete" data-id="${exp.id}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.btn-edit').forEach((btn) => {
    btn.addEventListener('click', () => openEditForm(Number(btn.dataset.id)));
  });
  list.querySelectorAll('.btn-delete').forEach((btn) => {
    btn.addEventListener('click', () => deleteExpense(Number(btn.dataset.id)));
  });
}

function renderChart() {
  const monthFilter = document.getElementById('filter-month').value;
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const targetMonth = monthFilter || currentMonth;

  const monthExpenses = expenses.filter((e) => e.date.startsWith(targetMonth));

  const totals = {};
  monthExpenses.forEach((e) => {
    totals[e.category] = (totals[e.category] || 0) + e.amount;
  });

  const labels = Object.keys(totals);
  const data = Object.values(totals);
  const colors = labels.map((l) => categoryColor(l));

  const canvas = document.getElementById('expense-chart');
  if (chart) chart.destroy();

  if (labels.length === 0) {
    canvas.parentElement.innerHTML = `
      <canvas id="expense-chart"></canvas>
      <p class="chart-empty">No data for ${targetMonth}</p>`;
    return;
  }

  chart = new Chart(document.getElementById('expense-chart'), {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: 'var(--color-surface)' }] },
    options: {
      plugins: {
        legend: { position: 'bottom', labels: { color: 'var(--color-text)', padding: 12, font: { size: 12 } } },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.label}: $${ctx.parsed.toFixed(2)}`,
          },
        },
      },
      cutout: '65%',
    },
  });
}

function updateSummary() {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthExpenses = expenses.filter((e) => e.date.startsWith(currentMonth));
  const total = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
  document.getElementById('total-month').textContent = `$${total.toFixed(2)}`;
  document.getElementById('count-month').textContent = monthExpenses.length;
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
      amount: form.amount.value,
      description: form.description.value,
      category: form.category.value,
      date: form.date.value,
    };

    try {
      if (editingId) {
        const updated = await api.expenses.update(editingId, body);
        expenses = expenses.map((e) => (e.id === editingId ? updated : e));
      } else {
        const created = await api.expenses.create(body);
        expenses.unshift(created);
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

  // Default date to today
  form.date.value = new Date().toISOString().slice(0, 10);
}

function openAddForm() {
  editingId = null;
  const form = document.getElementById('form-expense');
  form.reset();
  form.date.value = new Date().toISOString().slice(0, 10);
  document.getElementById('form-title').textContent = 'Add Expense';
  document.getElementById('error-expense').hidden = true;
  document.getElementById('expense-form-panel').hidden = false;
  form.description.focus();
}

function openEditForm(id) {
  const exp = expenses.find((e) => e.id === id);
  if (!exp) return;
  editingId = id;
  const form = document.getElementById('form-expense');
  form.description.value = exp.description;
  form.amount.value = exp.amount;
  form.category.value = exp.category;
  form.date.value = exp.date;
  document.getElementById('form-title').textContent = 'Edit Expense';
  document.getElementById('error-expense').hidden = true;
  document.getElementById('expense-form-panel').hidden = false;
  form.description.focus();
}

function closeForm() {
  document.getElementById('expense-form-panel').hidden = true;
  editingId = null;
}

async function deleteExpense(id) {
  if (!confirm('Delete this expense?')) return;
  try {
    await api.expenses.delete(id);
    expenses = expenses.filter((e) => e.id !== id);
    renderList();
    renderChart();
    updateSummary();
  } catch (err) {
    alert(err.message);
  }
}

function categoryColor(category) {
  const idx = CATEGORIES.indexOf(category);
  return CATEGORY_COLORS[idx >= 0 ? idx : CATEGORY_COLORS.length - 1];
}

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
