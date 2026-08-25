const path = require('path');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { initDb } = require('./db/db');

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/boards', require('./routes/boards'));
app.use('/api/lists', require('./routes/lists'));
app.use('/api/cards', require('./routes/cards'));
app.use('/api/admin', require('./routes/admin'));

app.get('/api/health', (req, res) => {
  res.json({ message: 'TaskFlow SQL API running' });
});

const frontendDir = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendDir));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ message: 'API route not found' });
  }
  return res.sendFile(path.join(frontendDir, 'index.html'));
});

const PORT = process.env.PORT || 5000;

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`TaskFlow SQL server running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  });
