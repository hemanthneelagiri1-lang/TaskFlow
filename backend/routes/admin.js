const router = require('express').Router();
const { getDb } = require('../db/db');
const { protect, adminOnly } = require('../middleware/auth');
const { mapBoard, mapUser } = require('../utils/formatters');

router.use(protect, adminOnly);

router.get('/stats', async (req, res) => {
  try {
    const db = getDb();

    const [usersRow, boardsRow, cardsRow] = await Promise.all([
      db.get('SELECT COUNT(*) AS count FROM users'),
      db.get('SELECT COUNT(*) AS count FROM boards'),
      db.get('SELECT COUNT(*) AS count FROM cards'),
    ]);

    return res.json({
      users: usersRow.count,
      boards: boardsRow.count,
      cards: cardsRow.count,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get('/users', async (req, res) => {
  try {
    const db = getDb();
    const rows = await db.all(
      'SELECT id, name, email, role, avatar, created_at FROM users ORDER BY created_at DESC'
    );

    return res.json(rows.map(mapUser));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.put('/users/:id', async (req, res) => {
  try {
    const db = getDb();
    const user = await db.get('SELECT id, name, email, role, avatar, created_at FROM users WHERE id = ?', [req.params.id]);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const name = req.body.name !== undefined ? String(req.body.name).trim() || user.name : user.name;
    const email = req.body.email !== undefined ? String(req.body.email).trim().toLowerCase() || user.email : user.email;
    const role = req.body.role !== undefined && ['user', 'admin'].includes(req.body.role) ? req.body.role : user.role;

    await db.run('UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?', [name, email, role, user.id]);

    const updated = await db.get('SELECT id, name, email, role, avatar, created_at FROM users WHERE id = ?', [user.id]);
    return res.json(mapUser(updated));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }

    const db = getDb();
    const user = await db.get('SELECT id FROM users WHERE id = ?', [req.params.id]);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await db.run('DELETE FROM users WHERE id = ?', [user.id]);
    return res.json({ message: 'User deleted' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get('/boards', async (req, res) => {
  try {
    const db = getDb();

    const rows = await db.all(
      `
        SELECT
          b.*,
          u.id AS owner_user_id,
          u.name AS owner_name,
          u.email AS owner_email
        FROM boards b
        LEFT JOIN users u ON u.id = b.owner_id
        ORDER BY b.created_at DESC
      `
    );

    const boards = rows.map((row) => {
      const owner = row.owner_user_id
        ? {
            _id: row.owner_user_id,
            id: row.owner_user_id,
            name: row.owner_name,
            email: row.owner_email,
          }
        : null;

      return mapBoard(row, owner, []);
    });

    return res.json(boards);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;
