const router = require('express').Router();
const { randomUUID } = require('crypto');
const { getDb } = require('../db/db');
const { protect } = require('../middleware/auth');
const { mapBoard, mapCard, mapList } = require('../utils/formatters');

router.use(protect);

async function loadBoard(db, boardId) {
  return db.get(
    `
      SELECT
        b.*,
        u.id AS owner_user_id,
        u.name AS owner_name,
        u.email AS owner_email
      FROM boards b
      JOIN users u ON u.id = b.owner_id
      WHERE b.id = ?
    `,
    [boardId]
  );
}

async function hasBoardAccess(db, board, user) {
  if (!board) return false;
  if (user.role === 'admin') return true;
  if (board.owner_id === user.id) return true;
  if (board.visibility === 'public') return true;

  const member = await db.get(
    'SELECT 1 FROM board_members WHERE board_id = ? AND user_id = ?',
    [board.id, user.id]
  );

  return Boolean(member);
}

function buildOwner(row) {
  return {
    _id: row.owner_user_id,
    id: row.owner_user_id,
    name: row.owner_name,
    email: row.owner_email,
  };
}

router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const rows = await db.all(
      `
        SELECT DISTINCT
          b.*,
          u.id AS owner_user_id,
          u.name AS owner_name,
          u.email AS owner_email
        FROM boards b
        JOIN users u ON u.id = b.owner_id
        LEFT JOIN board_members bm ON bm.board_id = b.id
        WHERE b.owner_id = ? OR bm.user_id = ?
        ORDER BY b.created_at DESC
      `,
      [req.user.id, req.user.id]
    );

    const boards = rows.map((row) => mapBoard(row, buildOwner(row), []));
    return res.json(boards);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { title, description = '', background = '#1a2744', visibility = 'private' } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({ message: 'Title is required' });
    }

    const db = getDb();
    const boardId = randomUUID();

    await db.run(
      `
        INSERT INTO boards (id, title, description, background, owner_id, starred, visibility)
        VALUES (?, ?, ?, ?, ?, 0, ?)
      `,
      [
        boardId,
        String(title).trim(),
        String(description || '').trim(),
        String(background || '#1a2744'),
        req.user.id,
        ['private', 'team', 'public'].includes(visibility) ? visibility : 'private',
      ]
    );

    const created = await loadBoard(db, boardId);
    return res.status(201).json(mapBoard(created, buildOwner(created), []));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const db = getDb();
    const board = await loadBoard(db, req.params.id);

    if (!board) {
      return res.status(404).json({ message: 'Board not found' });
    }

    const allowed = await hasBoardAccess(db, board, req.user);
    if (!allowed) {
      return res.status(403).json({ message: 'Not authorized for this board' });
    }

    const listRows = await db.all(
      'SELECT * FROM lists WHERE board_id = ? ORDER BY position ASC, created_at ASC',
      [board.id]
    );

    const cardRows = await db.all(
      'SELECT * FROM cards WHERE board_id = ? ORDER BY position ASC, created_at ASC',
      [board.id]
    );

    return res.json({
      board: mapBoard(board, buildOwner(board), []),
      lists: listRows.map(mapList),
      cards: cardRows.map(mapCard),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const db = getDb();
    const board = await loadBoard(db, req.params.id);

    if (!board) {
      return res.status(404).json({ message: 'Board not found' });
    }

    const canEdit = req.user.role === 'admin' || board.owner_id === req.user.id;
    if (!canEdit) {
      return res.status(403).json({ message: 'Not authorized to update this board' });
    }

    const fields = [];
    const values = [];

    if (req.body.title !== undefined) {
      fields.push('title = ?');
      values.push(String(req.body.title).trim() || board.title);
    }

    if (req.body.description !== undefined) {
      fields.push('description = ?');
      values.push(String(req.body.description || '').trim());
    }

    if (req.body.background !== undefined) {
      fields.push('background = ?');
      values.push(String(req.body.background || board.background));
    }

    if (req.body.visibility !== undefined) {
      const visibility = ['private', 'team', 'public'].includes(req.body.visibility)
        ? req.body.visibility
        : board.visibility;
      fields.push('visibility = ?');
      values.push(visibility);
    }

    if (req.body.starred !== undefined) {
      fields.push('starred = ?');
      values.push(req.body.starred ? 1 : 0);
    }

    if (fields.length === 0) {
      return res.json(mapBoard(board, buildOwner(board), []));
    }

    values.push(board.id);

    await db.run(`UPDATE boards SET ${fields.join(', ')} WHERE id = ?`, values);

    const updated = await loadBoard(db, board.id);
    return res.json(mapBoard(updated, buildOwner(updated), []));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const db = getDb();
    const board = await loadBoard(db, req.params.id);

    if (!board) {
      return res.status(404).json({ message: 'Board not found' });
    }

    const canDelete = req.user.role === 'admin' || board.owner_id === req.user.id;
    if (!canDelete) {
      return res.status(403).json({ message: 'Not authorized to delete this board' });
    }

    await db.run('DELETE FROM boards WHERE id = ?', [board.id]);

    return res.json({ message: 'Board deleted' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;
