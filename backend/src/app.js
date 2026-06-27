require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDb } = require('./config/db');

const app = express();

let _ready = null;

app.use(cors());
app.use(express.json());

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
app.use('/api/transactions', require('./routes/transactions'));

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

module.exports = app;
