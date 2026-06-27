const db = require('../config/db');

const VALID_CATEGORIES = [
  'Food', 'Transport', 'Housing', 'Entertainment',
  'Health', 'Shopping', 'Education', 'Travel', 'Other',
];

async function getAll(req, res) {
  try {
    const result = await db.execute({
      sql: 'SELECT * FROM expenses WHERE user_id = ? ORDER BY date DESC, created_at DESC',
      args: [req.user.id],
    });
    res.json(result.rows.map(normalizeRow));
  } catch (err) {
    console.error('getAll error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function create(req, res) {
  const { amount, description, category, date } = req.body;
  const validationError = validateExpense({ amount, description, category, date });
  if (validationError) return res.status(400).json({ error: validationError });

  try {
    const result = await db.execute({
      sql: 'INSERT INTO expenses (user_id, amount, description, category, date) VALUES (?, ?, ?, ?, ?)',
      args: [req.user.id, parseFloat(amount), description.trim(), category, date],
    });
    const row = await db.execute({
      sql: 'SELECT * FROM expenses WHERE id = ?',
      args: [result.lastInsertRowid],
    });
    res.status(201).json(normalizeRow(row.rows[0]));
  } catch (err) {
    console.error('create error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function update(req, res) {
  const { id } = req.params;
  const { amount, description, category, date } = req.body;
  const validationError = validateExpense({ amount, description, category, date });
  if (validationError) return res.status(400).json({ error: validationError });

  try {
    const existing = await db.execute({
      sql: 'SELECT id FROM expenses WHERE id = ? AND user_id = ?',
      args: [id, req.user.id],
    });
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    await db.execute({
      sql: 'UPDATE expenses SET amount = ?, description = ?, category = ?, date = ? WHERE id = ?',
      args: [parseFloat(amount), description.trim(), category, date, id],
    });
    const row = await db.execute({
      sql: 'SELECT * FROM expenses WHERE id = ?',
      args: [id],
    });
    res.json(normalizeRow(row.rows[0]));
  } catch (err) {
    console.error('update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function remove(req, res) {
  const { id } = req.params;
  try {
    const existing = await db.execute({
      sql: 'SELECT id FROM expenses WHERE id = ? AND user_id = ?',
      args: [id, req.user.id],
    });
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    await db.execute({
      sql: 'DELETE FROM expenses WHERE id = ?',
      args: [id],
    });
    res.status(204).end();
  } catch (err) {
    console.error('delete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

function validateExpense({ amount, description, category, date }) {
  if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
    return 'Amount must be a positive number';
  }
  if (!description || description.trim().length === 0) {
    return 'Description is required';
  }
  if (!category || !VALID_CATEGORIES.includes(category)) {
    return `Category must be one of: ${VALID_CATEGORIES.join(', ')}`;
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return 'Date must be in YYYY-MM-DD format';
  }
  return null;
}

function normalizeRow(row) {
  return {
    id: Number(row.id),
    user_id: Number(row.user_id),
    amount: Number(row.amount),
    description: row.description,
    category: row.category,
    date: row.date,
    created_at: row.created_at,
  };
}

module.exports = { getAll, create, update, remove };
