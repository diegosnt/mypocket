require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { initDb } = require('./config/db');

const ALLOWED_ORIGIN = process.env.FRONTEND_URL || 'http://localhost:5500';

const app = express();

let _ready = null;

app.use(helmet());
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json({ limit: '20kb' }));

app.use(async (_req, res, next) => {
  try {
    if (!_ready) _ready = initDb();
    await _ready;
    next();
  } catch (err) {
    console.error('DB init error:', err);
    _ready = null;
    res.status(503).json({ error: 'Base de datos no disponible' });
  }
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/transactions', require('./routes/transactions'));

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

module.exports = app;
