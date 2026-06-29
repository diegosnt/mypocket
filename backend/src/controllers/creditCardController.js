const { db } = require('../config/db');

async function getAll(req, res) {
  try {
    const result = await db.execute({
      sql: 'SELECT * FROM credit_cards WHERE user_id = ? ORDER BY name ASC',
      args: [req.user.id],
    });
    res.json(result.rows.map(normalizeRow));
  } catch (err) {
    console.error('credit_cards getAll error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
}

async function create(req, res) {
  const { name, bank } = req.body;
  if (!name || name.trim().length === 0) {
    return res.status(400).json({ error: 'El nombre es obligatorio' });
  }
  if (name.trim().length > 100) {
    return res.status(400).json({ error: 'El nombre no puede superar los 100 caracteres' });
  }
  if (bank && bank.trim().length > 100) {
    return res.status(400).json({ error: 'El banco no puede superar los 100 caracteres' });
  }
  try {
    const result = await db.execute({
      sql: 'INSERT INTO credit_cards (user_id, name, bank) VALUES (?, ?, ?)',
      args: [req.user.id, name.trim(), bank ? bank.trim() : ''],
    });
    const row = await db.execute({
      sql: 'SELECT * FROM credit_cards WHERE id = ?',
      args: [result.lastInsertRowid],
    });
    res.status(201).json(normalizeRow(row.rows[0]));
  } catch (err) {
    console.error('credit_cards create error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
}

async function update(req, res) {
  const { id } = req.params;
  const { name, bank } = req.body;
  if (!name || name.trim().length === 0) {
    return res.status(400).json({ error: 'El nombre es obligatorio' });
  }
  if (name.trim().length > 100) {
    return res.status(400).json({ error: 'El nombre no puede superar los 100 caracteres' });
  }
  if (bank && bank.trim().length > 100) {
    return res.status(400).json({ error: 'El banco no puede superar los 100 caracteres' });
  }
  try {
    const existing = await db.execute({
      sql: 'SELECT id FROM credit_cards WHERE id = ? AND user_id = ?',
      args: [id, req.user.id],
    });
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Tarjeta no encontrada' });
    }
    await db.execute({
      sql: 'UPDATE credit_cards SET name = ?, bank = ? WHERE id = ?',
      args: [name.trim(), bank ? bank.trim() : '', id],
    });
    const row = await db.execute({
      sql: 'SELECT * FROM credit_cards WHERE id = ?',
      args: [id],
    });
    res.json(normalizeRow(row.rows[0]));
  } catch (err) {
    console.error('credit_cards update error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
}

async function remove(req, res) {
  const { id } = req.params;
  try {
    const existing = await db.execute({
      sql: 'SELECT id FROM credit_cards WHERE id = ? AND user_id = ?',
      args: [id, req.user.id],
    });
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Tarjeta no encontrada' });
    }
    await db.execute({ sql: 'DELETE FROM credit_cards WHERE id = ?', args: [id] });
    res.status(204).end();
  } catch (err) {
    console.error('credit_cards delete error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
}

function normalizeRow(row) {
  return {
    id: Number(row.id),
    name: row.name,
    bank: row.bank || '',
  };
}

module.exports = { getAll, create, update, remove };
