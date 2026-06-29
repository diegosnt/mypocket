const { db } = require('../config/db');

const VALID_TYPES      = ['expense', 'income'];
const VALID_CURRENCIES = ['ARS', 'USD'];

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
  const { type, amount, description, category, date, currency, origin, credit_card_id } = req.body;
  const validationError = await validate({ type, amount, description, category, date, currency, origin, credit_card_id }, req.user.id);
  if (validationError) return res.status(400).json({ error: validationError });

  const status = credit_card_id ? 'pending' : 'settled';
  const actualOrigin = credit_card_id ? '' : origin;
  const actualCreditCardId = credit_card_id ? Number(credit_card_id) : null;

  try {
    const result = await db.execute({
      sql: 'INSERT INTO transactions (user_id, type, amount, description, category, date, currency, origin, credit_card_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: [req.user.id, type, parseFloat(amount), description.trim(), category, date, currency, actualOrigin, actualCreditCardId, status],
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
  const { type, amount, description, category, date, currency, origin, credit_card_id } = req.body;
  const validationError = await validate({ type, amount, description, category, date, currency, origin, credit_card_id }, req.user.id);
  if (validationError) return res.status(400).json({ error: validationError });

  const status = credit_card_id ? 'pending' : 'settled';
  const actualOrigin = credit_card_id ? '' : origin;
  const actualCreditCardId = credit_card_id ? Number(credit_card_id) : null;

  try {
    const existing = await db.execute({
      sql: 'SELECT id FROM transactions WHERE id = ? AND user_id = ?',
      args: [id, req.user.id],
    });
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Movimiento no encontrado' });
    }

    await db.execute({
      sql: 'UPDATE transactions SET type = ?, amount = ?, description = ?, category = ?, date = ?, currency = ?, origin = ?, credit_card_id = ?, status = ? WHERE id = ?',
      args: [type, parseFloat(amount), description.trim(), category, date, currency, actualOrigin, actualCreditCardId, status, id],
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

async function validate({ type, amount, description, category, date, currency, origin, credit_card_id }, userId) {
  if (!type || !VALID_TYPES.includes(type)) {
    return 'El tipo debe ser egreso o ingreso';
  }
  if (!currency || !VALID_CURRENCIES.includes(currency)) {
    return 'La moneda debe ser ARS o USD';
  }
  if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
    return 'El monto debe ser un número positivo';
  }
  if (!description || description.trim().length === 0) {
    return 'La descripción es obligatoria';
  }
  if (description.trim().length > 200) {
    return 'La descripción no puede superar los 200 caracteres';
  }
  if (!category) {
    return 'La categoría es obligatoria';
  }
  const cat = await db.execute({
    sql: 'SELECT id FROM categories WHERE name = ?',
    args: [category],
  });
  if (cat.rows.length === 0) {
    return 'La categoría no es válida';
  }
  if (credit_card_id && origin) {
    return 'No se puede indicar origen y tarjeta de crédito al mismo tiempo';
  }
  if (!credit_card_id && !origin) {
    return 'Debe indicar un origen o una tarjeta de crédito';
  }
  if (credit_card_id) {
    const cc = await db.execute({
      sql: 'SELECT id FROM credit_cards WHERE id = ? AND user_id = ?',
      args: [Number(credit_card_id), userId],
    });
    if (cc.rows.length === 0) {
      return 'La tarjeta de crédito no es válida';
    }
  } else {
    if (!origin || origin.trim().length === 0) {
      return 'El origen es obligatorio';
    }
    const orig = await db.execute({
      sql: 'SELECT id FROM origins WHERE name = ?',
      args: [origin],
    });
    if (orig.rows.length === 0) {
      return 'El origen no es válido';
    }
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return 'La fecha debe tener formato YYYY-MM-DD';
  }
  return null;
}

async function importRows(req, res) {
  const { credit_card_id, rows } = req.body;
  if (!credit_card_id || !Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'Datos inválidos' });
  }

  const cc = await db.execute({
    sql: 'SELECT id FROM credit_cards WHERE id = ? AND user_id = ?',
    args: [Number(credit_card_id), req.user.id],
  });
  if (cc.rows.length === 0) return res.status(400).json({ error: 'Tarjeta no válida' });

  let imported = 0;
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const { fecha, descripcion, monto, moneda = 'ARS', categoria = 'Otros' } = rows[i];
    if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      errors.push({ row: i + 1, message: 'Fecha inválida' }); continue;
    }
    const amt = parseFloat(monto);
    if (isNaN(amt) || amt <= 0) {
      errors.push({ row: i + 1, message: 'Monto inválido' }); continue;
    }
    if (!descripcion || String(descripcion).trim().length === 0) {
      errors.push({ row: i + 1, message: 'Descripción vacía' }); continue;
    }
    if (!['ARS', 'USD'].includes(moneda)) {
      errors.push({ row: i + 1, message: 'Moneda inválida (ARS o USD)' }); continue;
    }
    const cat = await db.execute({ sql: 'SELECT id FROM categories WHERE name = ?', args: [categoria] });
    const finalCategory = cat.rows.length > 0 ? categoria : 'Otros';

    try {
      await db.execute({
        sql: 'INSERT INTO transactions (user_id, type, amount, description, category, date, currency, origin, credit_card_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        args: [req.user.id, 'expense', amt, String(descripcion).trim().slice(0, 200), finalCategory, fecha, moneda, '', Number(credit_card_id), 'pending'],
      });
      imported++;
    } catch (err) {
      errors.push({ row: i + 1, message: 'Error al insertar' });
    }
  }

  res.json({ imported, errors });
}

async function payCard(req, res) {
  const { credit_card_id, amount, currency } = req.body;

  if (!credit_card_id || !amount || !currency) {
    return res.status(400).json({ error: 'Datos inválidos' });
  }
  if (!['ARS', 'USD'].includes(currency)) {
    return res.status(400).json({ error: 'Moneda inválida' });
  }
  const amt = parseFloat(amount);
  if (isNaN(amt) || amt <= 0) {
    return res.status(400).json({ error: 'Monto inválido' });
  }

  try {
    // validate card belongs to user
    const cc = await db.execute({
      sql: 'SELECT id FROM credit_cards WHERE id = ? AND user_id = ?',
      args: [Number(credit_card_id), req.user.id],
    });
    if (cc.rows.length === 0) return res.status(400).json({ error: 'Tarjeta no válida' });

    // get pending transactions for this card+currency, oldest first
    const pending = await db.execute({
      sql: `SELECT id, amount FROM transactions
            WHERE user_id = ? AND credit_card_id = ? AND currency = ? AND status = 'pending'
            ORDER BY date ASC, created_at ASC`,
      args: [req.user.id, Number(credit_card_id), currency],
    });

    let remaining = amt;
    const toSettle = [];
    for (const row of pending.rows) {
      const rowAmt = Number(row.amount);
      if (rowAmt <= remaining + 0.001) {
        toSettle.push(Number(row.id));
        remaining -= rowAmt;
      }
    }

    if (toSettle.length === 0) {
      return res.json({
        settled_count: 0,
        settled_amount: 0,
        remaining_pending: pending.rows.reduce((s, r) => s + Number(r.amount), 0),
      });
    }

    // batch update
    await db.batch(
      toSettle.map((id) => ({
        sql: `UPDATE transactions SET status = 'settled' WHERE id = ?`,
        args: [id],
      }))
    );

    const settledAmount = amt - remaining;
    const remainingPending = pending.rows
      .filter((r) => !toSettle.includes(Number(r.id)))
      .reduce((s, r) => s + Number(r.amount), 0);

    res.json({ settled_count: toSettle.length, settled_amount: settledAmount, remaining_pending: remainingPending });
  } catch (err) {
    console.error('payCard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

function normalizeRow(row) {
  return {
    id: Number(row.id),
    type: row.type,
    currency: row.currency || 'ARS',
    origin: row.origin || null,
    credit_card_id: row.credit_card_id ? Number(row.credit_card_id) : null,
    status: row.status || 'settled',
    amount: Number(row.amount),
    description: row.description,
    category: row.category,
    date: row.date,
    created_at: row.created_at,
  };
}

module.exports = { getAll, create, update, remove, importRows, payCard };
