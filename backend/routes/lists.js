const router = require('express').Router();
const { randomUUID } = require('crypto');
const { getDb } = require('../db/db');
const { protect } = require('../middleware/auth');
const { mapList } = require('../utils/formatters');

router.use(protect);

async function canAccessBoard(db, boardId, user) {
  const board = await db.get('SELECT id, owner_id, visibility FROM boards WHERE id = ?', [boardId]);
  if (!board) return { board: null, access: false, write: false };

  if (user.role === 'admin') return { board, access: true, write: true };
  if (board.owner_id === user.id) return { board, access: true, write: true };

  const member = await db.get(
    'SELECT 1 FROM board_members WHERE board_id = ? AND user_id = ?',
    [boardId, user.id]
  );

  const access = Boolean(member) || board.visibility === 'public';
  const write = Boolean(member);

  return { board, access, write };
}

router.post('/', async (req, res) => {
  try {
    const { title, board: boardId, position = 0 } = req.body;

    if (!title || !String(title).trim() || !boardId) {
      return res.status(400).json({ message: 'Title and board are required' });
    }

    const db = getDb();
    const perms = await canAccessBoard(db, boardId, req.user);

    if (!perms.board) return res.status(404).json({ message: 'Board not found' });
    if (!perms.access || (!perms.write && req.user.role !== 'admin' && perms.board.owner_id !== req.user.id)) {
      return res.status(403).json({ message: 'Not authorized to create list in this board' });
    }

    const listId = randomUUID();
    await db.run(
      'INSERT INTO lists (id, title, board_id, position) VALUES (?, ?, ?, ?)',
      [listId, String(title).trim(), boardId, Number(position) || 0]
    );

    const row = await db.get('SELECT * FROM lists WHERE id = ?', [listId]);
    return res.status(201).json(mapList(row));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const db = getDb();
    const list = await db.get('SELECT * FROM lists WHERE id = ?', [req.params.id]);

    if (!list) {
      return res.status(404).json({ message: 'List not found' });
    }

    const perms = await canAccessBoard(db, list.board_id, req.user);
    if (!perms.access || (!perms.write && req.user.role !== 'admin' && perms.board.owner_id !== req.user.id)) {
      return res.status(403).json({ message: 'Not authorized to update this list' });
    }

    const title = req.body.title !== undefined ? String(req.body.title).trim() || list.title : list.title;
    const position = req.body.position !== undefined ? Number(req.body.position) || 0 : list.position;

    await db.run('UPDATE lists SET title = ?, position = ? WHERE id = ?', [title, position, list.id]);

    const updated = await db.get('SELECT * FROM lists WHERE id = ?', [list.id]);
    return res.json(mapList(updated));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const db = getDb();
    const list = await db.get('SELECT * FROM lists WHERE id = ?', [req.params.id]);

    if (!list) {
      return res.status(404).json({ message: 'List not found' });
    }

    const perms = await canAccessBoard(db, list.board_id, req.user);
    if (!perms.access || (!perms.write && req.user.role !== 'admin' && perms.board.owner_id !== req.user.id)) {
      return res.status(403).json({ message: 'Not authorized to delete this list' });
    }

    await db.run('DELETE FROM lists WHERE id = ?', [list.id]);
    return res.json({ message: 'List deleted' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;
