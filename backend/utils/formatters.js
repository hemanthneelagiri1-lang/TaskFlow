const { parseJson } = require('../db/db');

function mapUser(row) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    avatar: row.avatar,
    createdAt: row.created_at,
  };
}

function mapBoard(row, owner = null, members = []) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    title: row.title,
    description: row.description,
    background: row.background,
    owner: owner || (row.owner_id ? { _id: row.owner_id, id: row.owner_id } : null),
    members,
    starred: Boolean(row.starred),
    visibility: row.visibility,
    createdAt: row.created_at,
  };
}

function mapList(row) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    title: row.title,
    board: row.board_id,
    position: row.position,
    createdAt: row.created_at,
  };
}

function mapCard(row) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    title: row.title,
    description: row.description,
    list: row.list_id,
    board: row.board_id,
    position: row.position,
    assignees: parseJson(row.assignees, []),
    labels: parseJson(row.labels, []),
    dueDate: row.due_date,
    priority: row.priority,
    checklist: parseJson(row.checklist, []),
    comments: parseJson(row.comments, []),
    createdAt: row.created_at,
  };
}

module.exports = {
  mapUser,
  mapBoard,
  mapList,
  mapCard,
};
