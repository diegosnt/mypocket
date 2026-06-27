const { db } = require('../config/db');

async function getAll(_req, res) {
  try {
    const result = await db.execute('SELECT * FROM categories ORDER BY name ASC');
    res.json(result.rows.map(normalizeRow));
  } catch (err) {
    console.error('categories getAll error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
}

async function create(req, res) {
  const { name, color } = req.body;
  if (!name || name.trim().length === 0) {
    return res.status(400).json({ error: 'El nombre es obligatorio' });
  }
  try {
    const result = await db.execute({
      sql: 'INSERT INTO categories (name, color) VALUES (?, ?)',
      args: [name.trim(), color || '#94a3b8'],
    });
    const row = await db.execute({
      sql: 'SELECT * FROM categories WHERE id = ?',
      args: [result.lastInsertRowid],
    });
    res.status(201).json(normalizeRow(row.rows[0]));
  } catch (err) {
    if (err.message?.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Ya existe una categoría con ese nombre' });
    }
    console.error('categories create error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
}

async function update(req, res) {
  const { id } = req.params;
  const { name, color } = req.body;
  if (!name || name.trim().length === 0) {
    return res.status(400).json({ error: 'El nombre es obligatorio' });
  }
  try {
    const existing = await db.execute({
      sql: 'SELECT name FROM categories WHERE id = ?',
      args: [id],
    });
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }
    const oldName = existing.rows[0].name;
    await db.batch([
      { sql: 'UPDATE categories SET name = ?, color = ? WHERE id = ?', args: [name.trim(), color || '#94a3b8', id] },
      { sql: 'UPDATE transactions SET category = ? WHERE category = ?', args: [name.trim(), oldName] },
    ]);
    const row = await db.execute({
      sql: 'SELECT * FROM categories WHERE id = ?',
      args: [id],
    });
    res.json(normalizeRow(row.rows[0]));
  } catch (err) {
    if (err.message?.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Ya existe una categoría con ese nombre' });
    }
    console.error('categories update error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
}

async function remove(req, res) {
  const { id } = req.params;
  try {
    const existing = await db.execute({
      sql: 'SELECT name FROM categories WHERE id = ?',
      args: [id],
    });
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }
    const name = existing.rows[0].name;
    const inUse = await db.execute({
      sql: 'SELECT COUNT(*) as count FROM transactions WHERE category = ?',
      args: [name],
    });
    if (Number(inUse.rows[0].count) > 0) {
      return res.status(409).json({
        error: `No se puede eliminar: hay ${inUse.rows[0].count} movimiento(s) con esta categoría`,
      });
    }
    await db.execute({ sql: 'DELETE FROM categories WHERE id = ?', args: [id] });
    res.status(204).end();
  } catch (err) {
    console.error('categories delete error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
}

function normalizeRow(row) {
  return { id: Number(row.id), name: row.name, color: row.color };
}

module.exports = { getAll, create, update, remove };
