const router = require('express').Router();
const { randomUUID } = require('crypto');
const { getDb, parseJson } = require('../db/db');
const { protect } = require('../middleware/auth');
const { mapCard } = require('../utils/formatters');

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

function normalizeArray(value, fallback = []) {
  if (Array.isArray(value)) return value;
  return fallback;
}

router.post('/', async (req, res) => {
  try {
    const {
      title,
      description = '',
      list: listId,
      board: boardId,
      position = 0,
      assignees = [],
      labels = [],
      dueDate = null,
      priority = 'medium',
      checklist = [],
      comments = [],
    } = req.body;

    if (!title || !String(title).trim() || !listId || !boardId) {
      return res.status(400).json({ message: 'Title, list and board are required' });
    }

    const db = getDb();

    const list = await db.get('SELECT id, board_id FROM lists WHERE id = ?', [listId]);
    if (!list || list.board_id !== boardId) {
      return res.status(400).json({ message: 'List does not belong to board' });
    }

    const perms = await canAccessBoard(db, boardId, req.user);
    if (!perms.access || (!perms.write && req.user.role !== 'admin' && perms.board.owner_id !== req.user.id)) {
      return res.status(403).json({ message: 'Not authorized to create card in this board' });
    }

    const cardId = randomUUID();
    const safePriority = ['low', 'medium', 'high', 'urgent'].includes(priority) ? priority : 'medium';

    await db.run(
      `
        INSERT INTO cards (
          id, title, description, list_id, board_id, position,
          assignees, labels, due_date, priority, checklist, comments
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        cardId,
        String(title).trim(),
        String(description || ''),
        listId,
        boardId,
        Number(position) || 0,
        JSON.stringify(normalizeArray(assignees)),
        JSON.stringify(normalizeArray(labels)),
        dueDate || null,
        safePriority,
        JSON.stringify(normalizeArray(checklist)),
        JSON.stringify(normalizeArray(comments)),
      ]
    );

    const row = await db.get('SELECT * FROM cards WHERE id = ?', [cardId]);
    return res.status(201).json(mapCard(row));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const db = getDb();
    const card = await db.get('SELECT * FROM cards WHERE id = ?', [req.params.id]);

    if (!card) {
      return res.status(404).json({ message: 'Card not found' });
    }

    const perms = await canAccessBoard(db, card.board_id, req.user);
    if (!perms.access || (!perms.write && req.user.role !== 'admin' && perms.board.owner_id !== req.user.id)) {
      return res.status(403).json({ message: 'Not authorized to update this card' });
    }

    const nextBoardId = req.body.board !== undefined ? req.body.board : card.board_id;
    const nextListId = req.body.list !== undefined ? req.body.list : card.list_id;

    if (req.body.list !== undefined || req.body.board !== undefined) {
      const nextList = await db.get('SELECT id, board_id FROM lists WHERE id = ?', [nextListId]);
      if (!nextList || nextList.board_id !== nextBoardId) {
        return res.status(400).json({ message: 'Target list does not belong to target board' });
      }
    }

    const title = req.body.title !== undefined ? String(req.body.title).trim() || card.title : card.title;
    const description = req.body.description !== undefined ? String(req.body.description || '') : card.description;
    const position = req.body.position !== undefined ? Number(req.body.position) || 0 : card.position;
    const assignees = req.body.assignees !== undefined ? normalizeArray(req.body.assignees) : parseJson(card.assignees, []);
    const labels = req.body.labels !== undefined ? normalizeArray(req.body.labels) : parseJson(card.labels, []);
    const dueDate = req.body.dueDate !== undefined ? req.body.dueDate : card.due_date;
    const priority = req.body.priority !== undefined && ['low', 'medium', 'high', 'urgent'].includes(req.body.priority)
      ? req.body.priority
      : card.priority;
    const checklist = req.body.checklist !== undefined ? normalizeArray(req.body.checklist) : parseJson(card.checklist, []);
    const comments = req.body.comments !== undefined ? normalizeArray(req.body.comments) : parseJson(card.comments, []);

    await db.run(
      `
        UPDATE cards
        SET
          title = ?,
          description = ?,
          list_id = ?,
          board_id = ?,
          position = ?,
          assignees = ?,
          labels = ?,
          due_date = ?,
          priority = ?,
          checklist = ?,
          comments = ?
        WHERE id = ?
      `,
      [
        title,
        description,
        nextListId,
        nextBoardId,
        position,
        JSON.stringify(assignees),
        JSON.stringify(labels),
        dueDate || null,
        priority,
        JSON.stringify(checklist),
        JSON.stringify(comments),
        card.id,
      ]
    );

    const updated = await db.get('SELECT * FROM cards WHERE id = ?', [card.id]);
    return res.json(mapCard(updated));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const db = getDb();
    const card = await db.get('SELECT id, board_id FROM cards WHERE id = ?', [req.params.id]);

    if (!card) {
      return res.status(404).json({ message: 'Card not found' });
    }

    const perms = await canAccessBoard(db, card.board_id, req.user);
    if (!perms.access || (!perms.write && req.user.role !== 'admin' && perms.board.owner_id !== req.user.id)) {
      return res.status(403).json({ message: 'Not authorized to delete this card' });
    }

    await db.run('DELETE FROM cards WHERE id = ?', [card.id]);
    return res.json({ message: 'Card deleted' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post('/:id/comments', async (req, res) => {
  try {
    const db = getDb();
    const card = await db.get('SELECT * FROM cards WHERE id = ?', [req.params.id]);

    if (!card) {
      return res.status(404).json({ message: 'Card not found' });
    }

    const perms = await canAccessBoard(db, card.board_id, req.user);
    if (!perms.access) {
      return res.status(403).json({ message: 'Not authorized to comment on this card' });
    }

    const text = String(req.body.text || '').trim();
    if (!text) {
      return res.status(400).json({ message: 'Comment text is required' });
    }

    const comments = parseJson(card.comments, []);
    comments.push({
      id: randomUUID(),
      user: {
        _id: req.user.id,
        id: req.user.id,
        name: req.user.name,
      },
      text,
      createdAt: new Date().toISOString(),
    });

    await db.run('UPDATE cards SET comments = ? WHERE id = ?', [JSON.stringify(comments), card.id]);

    const updated = await db.get('SELECT * FROM cards WHERE id = ?', [card.id]);
    return res.json(mapCard(updated));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;
