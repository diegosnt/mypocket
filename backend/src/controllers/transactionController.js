const { db } = require('../config/db');

const VALID_TYPES = ['expense', 'income'];

const VALID_CATEGORIES = [
  'Alimentación', 'Transporte', 'Vivienda', 'Entretenimiento',
  'Salud', 'Compras', 'Educación', 'Viajes', 'Inversiones', 'Otros',
];

async function getAll(req, res) {
  try {
    const result = await db.execute({
      sql: 'SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC, created_at DESC',
      args: [req.user.id],
    });
    res.json(result.rows.map(normalizeRow));
  } catch (err) {
    console.error('getAll error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function create(req, res) {
  const { type, amount, description, category, date } = req.body;
  const validationError = validate({ type, amount, description, category, date });
  if (validationError) return res.status(400).json({ error: validationError });

  try {
    const result = await db.execute({
      sql: 'INSERT INTO transactions (user_id, type, amount, description, category, date) VALUES (?, ?, ?, ?, ?, ?)',
      args: [req.user.id, type, parseFloat(amount), description.trim(), category, date],
    });
    const row = await db.execute({
      sql: 'SELECT * FROM transactions WHERE id = ?',
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
  const { type, amount, description, category, date } = req.body;
  const validationError = validate({ type, amount, description, category, date });
  if (validationError) return res.status(400).json({ error: validationError });

  try {
    const existing = await db.execute({
      sql: 'SELECT id FROM transactions WHERE id = ? AND user_id = ?',
      args: [id, req.user.id],
    });
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Movimiento no encontrado' });
    }

    await db.execute({
      sql: 'UPDATE transactions SET type = ?, amount = ?, description = ?, category = ?, date = ? WHERE id = ?',
      args: [type, parseFloat(amount), description.trim(), category, date, id],
    });
    const row = await db.execute({
      sql: 'SELECT * FROM transactions WHERE id = ?',
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
      sql: 'SELECT id FROM transactions WHERE id = ? AND user_id = ?',
      args: [id, req.user.id],
    });
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Movimiento no encontrado' });
    }

    await db.execute({
      sql: 'DELETE FROM transactions WHERE id = ?',
      args: [id],
    });
    res.status(204).end();
  } catch (err) {
    console.error('delete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

function validate({ type, amount, description, category, date }) {
  if (!type || !VALID_TYPES.includes(type)) {
    return 'El tipo debe ser egreso o ingreso';
  }
  if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
    return 'El monto debe ser un número positivo';
  }
  if (!description || description.trim().length === 0) {
    return 'La descripción es obligatoria';
  }
  if (!category || !VALID_CATEGORIES.includes(category)) {
    return `La categoría no es válida`;
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return 'La fecha debe tener formato YYYY-MM-DD';
  }
  return null;
}

function normalizeRow(row) {
  return {
    id: Number(row.id),
    user_id: Number(row.user_id),
    type: row.type,
    amount: Number(row.amount),
    description: row.description,
    category: row.category,
    date: row.date,
    created_at: row.created_at,
  };
}

module.exports = { getAll, create, update, remove };
