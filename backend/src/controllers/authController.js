const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../config/db');

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

async function register(req, res) {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Nombre, correo y contraseña son obligatorios' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }

  try {
    const existing = await db.execute({
      sql: 'SELECT id FROM users WHERE email = ?',
      args: [email.toLowerCase()],
    });
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'El correo ya está registrado' });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const result = await db.execute({
      sql: 'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      args: [name.trim(), email.toLowerCase(), password_hash],
    });

    const user = { id: Number(result.lastInsertRowid), name: name.trim(), email: email.toLowerCase() };
    res.status(201).json({ token: signToken(user), user });
  } catch (err) {
    console.error('register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Correo y contraseña son obligatorios' });
  }

  try {
    const result = await db.execute({
      sql: 'SELECT id, name, email, password_hash FROM users WHERE email = ?',
      args: [email.toLowerCase()],
    });
    const row = result.rows[0];
    if (!row) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const valid = await bcrypt.compare(password, row.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const user = { id: Number(row.id), name: row.name, email: row.email };
    res.json({ token: signToken(user), user });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { register, login };
