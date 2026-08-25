
const appEl = document.getElementById('app');
const modalRoot = document.getElementById('modal-root');

const BKGS = [
  '#1a2744',
  '#1e3a2f',
  '#2d1b3d',
  '#3a1e1e',
  '#1a2e3a',
  'linear-gradient(135deg,#5b6af0,#818cf8)',
  'linear-gradient(135deg,#f472b6,#fb923c)',
  'linear-gradient(135deg,#34d399,#059669)',
  'linear-gradient(135deg,#fbbf24,#f59e0b)',
  'linear-gradient(135deg,#60a5fa,#3b82f6)',
];

const PRIORITY_COLOR = {
  low: '#34d399',
  medium: '#fbbf24',
  high: '#f97316',
  urgent: '#f87171',
};

const LABEL_COLORS = ['#5b6af0', '#f472b6', '#34d399', '#fbbf24', '#60a5fa', '#f87171', '#a78bfa', '#fb923c'];

const state = {
  user: readJson('tf_user'),
  token: localStorage.getItem('tf_token') || '',
  page: 'loading',
  boardId: null,
  authMode: 'login',
  authLoading: false,
  authError: '',
  boards: [],
  dashboardLoading: false,
  dashboardSearch: '',
  boardLoading: false,
  board: null,
  lists: [],
  cards: [],
  dragCardId: null,
  addCardListId: null,
  addCardText: '',
  addListOpen: false,
  addListTitle: '',
  cardModalId: null,
  cardTab: 'details',
  cardChecklistInput: '',
  cardLabelText: '',
  cardLabelColor: LABEL_COLORS[0],
  adminLoading: false,
  adminStats: null,
  adminUsers: [],
  adminBoards: [],
  adminTab: 'users',
};

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDate(value) {
  if (!value) return '';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString();
}

function setAuth(user, token) {
  state.user = user;
  state.token = token;
  localStorage.setItem('tf_token', token);
  localStorage.setItem('tf_user', JSON.stringify(user));
}

function logout(triggerRender = true) {
  localStorage.removeItem('tf_token');
  localStorage.removeItem('tf_user');
  state.user = null;
  state.token = '';
  state.page = 'auth';
  state.boardId = null;
  state.board = null;
  state.cardModalId = null;
  closeModal();
  if (triggerRender) render();
}

async function api(path, method = 'GET', body = null) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const response = await fetch(`/api${path}`, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      logout(false);
      state.page = 'auth';
      render();
    }
    throw new Error(data.message || 'Something went wrong');
  }

  return data;
}

function toastError(message) {
  window.alert(message);
}

function closeModal() {
  modalRoot.innerHTML = '';
}

function mountModal({ title = '', width = 480, bodyHtml = '', onSetup = null, onClose = null }) {
  modalRoot.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal fade-in" style="max-width:${width}px">
        <div class="modal-head">
          <h3>${escapeHtml(title)}</h3>
          <button class="modal-close" data-modal-close>x</button>
        </div>
        <div class="modal-body">${bodyHtml}</div>
      </div>
    </div>
  `;

  const backdrop = modalRoot.querySelector('.modal-backdrop');
  const modal = modalRoot.querySelector('.modal');
  const close = () => {
    closeModal();
    if (typeof onClose === 'function') onClose();
  };

  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) close();
  });

  modal.querySelector('[data-modal-close]').addEventListener('click', close);

  if (typeof onSetup === 'function') {
    onSetup(modal, close);
  }
}

function cardsOf(listId) {
  return state.cards
    .filter((card) => card.list === listId)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
}

function renderSpinner() {
  return '<div class="spinner-wrap"><div class="spinner"></div></div>';
}

function renderNavbar(boardTitle = '') {
  const user = state.user;
  const roleClass = user?.role === 'admin' ? 'role-admin' : 'role-user';

  return `
    <nav class="navbar">
      <div class="nav-left">
        <span class="brand" data-nav-dashboard>
          <span class="brand-logo">TF</span>
          <span class="brand-title">TaskFlow</span>
        </span>
        ${boardTitle ? `<span style="color:var(--border2);font-size:18px">/</span><span style="font-size:14px;color:var(--text2);font-weight:500">${escapeHtml(boardTitle)}</span>` : ''}
      </div>
      <div class="nav-right">
        ${user?.role === 'admin' ? '<button class="btn btn-sm btn-ghost" data-nav-admin>Admin</button>' : ''}
        <div class="user-chip">
          <div class="avatar-dot">${escapeHtml(user?.name?.[0]?.toUpperCase() || 'U')}</div>
          <span style="font-size:13px;font-weight:500">${escapeHtml(user?.name || '')}</span>
          <span class="role-pill ${roleClass}">${escapeHtml(user?.role || 'user')}</span>
        </div>
        <button class="btn btn-sm btn-danger" data-signout>Sign out</button>
      </div>
    </nav>
  `;
}

function bindNavbar() {
  const dash = appEl.querySelector('[data-nav-dashboard]');
  const admin = appEl.querySelector('[data-nav-admin]');
  const signout = appEl.querySelector('[data-signout]');

  if (dash) dash.addEventListener('click', () => navigate('dashboard'));
  if (admin) admin.addEventListener('click', () => navigate('admin'));
  if (signout) signout.addEventListener('click', () => logout(true));
}

function renderAuthPage() {
  appEl.innerHTML = `
    <div class="auth-page page">
      <div class="auth-blob" style="top:8%;left:5%;background:radial-gradient(circle, rgba(91,106,240,0.15), transparent 68%)"></div>
      <div class="auth-blob" style="top:65%;right:6%;background:radial-gradient(circle, rgba(244,114,182,0.15), transparent 68%)"></div>
      <div class="auth-blob" style="top:45%;left:45%;background:radial-gradient(circle, rgba(52,211,153,0.15), transparent 68%)"></div>

      <div class="auth-card fade-in">
        <div class="auth-header">
          <div class="auth-icon">TF</div>
          <h1 class="auth-title">TaskFlow</h1>
          <p class="auth-subtitle">
            ${state.authMode === 'login' ? 'Welcome back - sign in to continue' : 'Create your account to get started'}
          </p>
        </div>

        <div class="auth-tabs">
          <button class="auth-tab ${state.authMode === 'login' ? 'active' : ''}" data-auth-mode="login">Sign In</button>
          <button class="auth-tab ${state.authMode === 'register' ? 'active' : ''}" data-auth-mode="register">Register</button>
        </div>

        ${state.authError ? `<div class="alert-error">${escapeHtml(state.authError)}</div>` : ''}

        <form class="auth-form" id="auth-form">
          ${
            state.authMode === 'register'
              ? `
            <div class="field">
              <label>Full Name</label>
              <input required name="name" placeholder="Jane Smith" />
            </div>
            <div class="field">
              <label>Account Type</label>
              <select name="role">
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          `
              : ''
          }

          <div class="field">
            <label>Email</label>
            <input required type="email" name="email" placeholder="you@example.com" />
          </div>

          <div class="field">
            <label>Password</label>
            <input required type="password" name="password" placeholder="password" />
          </div>

          <button class="auth-submit" type="submit" ${state.authLoading ? 'disabled' : ''}>
            ${state.authLoading ? 'Please wait...' : state.authMode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  `;

  appEl.querySelectorAll('[data-auth-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.authMode = btn.dataset.authMode;
      state.authError = '';
      render();
    });
  });

  const form = appEl.querySelector('#auth-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    state.authLoading = true;
    state.authError = '';
    render();

    const formData = new FormData(form);
    const payload = {
      email: String(formData.get('email') || '').trim(),
      password: String(formData.get('password') || ''),
    };

    if (state.authMode === 'register') {
      payload.name = String(formData.get('name') || '').trim();
      payload.role = formData.get('role') === 'admin' ? 'admin' : 'user';
    }

    try {
      const endpoint = state.authMode === 'login' ? '/auth/login' : '/auth/register';
      const data = await api(endpoint, 'POST', payload);
      setAuth(data.user, data.token);
      state.authLoading = false;
      await navigate('dashboard');
    } catch (error) {
      state.authLoading = false;
      state.authError = error.message;
      render();
    }
  });
}
function boardCardHtml(board) {
  return `
    <div class="board-card fade-in" style="background:${escapeHtml(board.background)}" data-board-open="${board._id}">
      <div class="board-overlay"></div>
      <div class="board-content">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">
          <h3 class="board-title">${escapeHtml(board.title)}</h3>
          <div class="board-actions">
            <button class="icon-btn icon-btn-star" data-board-star="${board._id}">${board.starred ? '*' : '+'}</button>
            <button class="icon-btn icon-btn-danger" data-board-delete="${board._id}">x</button>
          </div>
        </div>
        <div>
          ${board.description ? `<p style="color:rgba(255,255,255,0.75);font-size:12px;margin-bottom:8px;line-height:1.4">${escapeHtml(board.description)}</p>` : ''}
          <div style="display:flex;gap:7px;align-items:center">
            <span class="badge badge-light">${escapeHtml(board.visibility)}</span>
            <span style="color:rgba(255,255,255,0.5);font-size:11px">${escapeHtml(formatDate(board.createdAt))}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderDashboardPage() {
  const filtered = state.boards.filter((board) => board.title.toLowerCase().includes(state.dashboardSearch.toLowerCase()));
  const starred = filtered.filter((board) => board.starred);
  const rest = filtered.filter((board) => !board.starred);

  appEl.innerHTML = `
    <div class="page">
      ${renderNavbar('')}
      <div class="container">
        <div class="page-head">
          <div>
            <h2 class="page-title">Good day, ${escapeHtml(state.user?.name?.split(' ')[0] || 'there')}</h2>
            <p class="page-subtitle">Organise your work. Stay in flow.</p>
          </div>
          <div class="inline-tools">
            <input class="search-input" id="board-search" placeholder="Search boards..." value="${escapeHtml(state.dashboardSearch)}" />
            <button class="btn btn-md btn-primary" id="new-board-btn">+ New Board</button>
          </div>
        </div>

        ${
          state.dashboardLoading
            ? renderSpinner()
            : `
            ${
              starred.length > 0
                ? `
              <section style="margin-bottom:40px">
                <div class="section-head">
                  <span style="font-size:18px">*</span>
                  <h3 style="font-size:16px;font-weight:700">Starred</h3>
                  <span class="section-count">${starred.length}</span>
                </div>
                <div class="board-grid">${starred.map(boardCardHtml).join('')}</div>
              </section>
            `
                : ''
            }

            <section>
              <div class="section-head">
                <span style="font-size:18px">[]</span>
                <h3 style="font-size:16px;font-weight:700">All Boards</h3>
                <span class="section-count">${rest.length}</span>
              </div>

              ${
                rest.length === 0 && starred.length === 0
                  ? `
                <div class="empty-state">
                  <div style="font-size:58px;margin-bottom:14px">[]</div>
                  <h3>No boards yet</h3>
                  <p>Create your first board to start managing projects</p>
                  <button class="btn btn-lg btn-primary" id="first-board-btn">+ Create First Board</button>
                </div>
              `
                  : `<div class="board-grid">${rest.map(boardCardHtml).join('')}</div>`
              }
            </section>
          `
        }
      </div>
    </div>
  `;

  bindNavbar();

  const search = appEl.querySelector('#board-search');
  const newBoardBtn = appEl.querySelector('#new-board-btn');
  const firstBoardBtn = appEl.querySelector('#first-board-btn');

  if (search) {
    search.addEventListener('input', (event) => {
      state.dashboardSearch = event.target.value;
      render();
    });
  }

  if (newBoardBtn) newBoardBtn.addEventListener('click', showCreateBoardModal);
  if (firstBoardBtn) firstBoardBtn.addEventListener('click', showCreateBoardModal);

  appEl.querySelectorAll('[data-board-open]').forEach((node) => {
    node.addEventListener('click', (event) => {
      const block = event.target.closest('[data-board-delete],[data-board-star]');
      if (block) return;
      navigate('board', node.dataset.boardOpen);
    });
  });

  appEl.querySelectorAll('[data-board-delete]').forEach((node) => {
    node.addEventListener('click', async (event) => {
      event.stopPropagation();
      const id = node.dataset.boardDelete;
      const ok = window.confirm('Delete this board and all its data?');
      if (!ok) return;

      try {
        await api(`/boards/${id}`, 'DELETE');
        state.boards = state.boards.filter((board) => board._id !== id);
        render();
      } catch (error) {
        toastError(error.message);
      }
    });
  });

  appEl.querySelectorAll('[data-board-star]').forEach((node) => {
    node.addEventListener('click', async (event) => {
      event.stopPropagation();
      const id = node.dataset.boardStar;
      const board = state.boards.find((item) => item._id === id);
      if (!board) return;

      try {
        await api(`/boards/${id}`, 'PUT', { starred: !board.starred });
        board.starred = !board.starred;
        render();
      } catch (error) {
        toastError(error.message);
      }
    });
  });
}

function showCreateBoardModal() {
  mountModal({
    title: 'Create New Board',
    width: 520,
    bodyHtml: `
      <form id="create-board-form" style="display:flex;flex-direction:column;gap:16px">
        <div class="field">
          <label>Title</label>
          <input required name="title" placeholder="My awesome project" />
        </div>

        <div>
          <label style="font-size:12px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:0.06em;display:block;margin-bottom:8px">Background</label>
          <div class="bg-palette">
            ${BKGS.map((bg, index) => `<div class="bg-swatch ${index === 0 ? 'active' : ''}" data-bg="${escapeHtml(bg)}" style="background:${escapeHtml(bg)}"></div>`).join('')}
          </div>
        </div>

        <div class="field">
          <label>Description (optional)</label>
          <input name="description" placeholder="What is this board for?" />
        </div>

        <div class="field">
          <label>Visibility</label>
          <select name="visibility">
            <option value="private">Private</option>
            <option value="team">Team</option>
            <option value="public">Public</option>
          </select>
        </div>

        <div style="display:flex;gap:10px;margin-top:4px">
          <button class="btn btn-md btn-ghost" type="button" data-modal-cancel style="flex:1">Cancel</button>
          <button class="btn btn-md btn-primary" type="submit" style="flex:2">Create Board</button>
        </div>
      </form>
    `,
    onSetup: (modal, close) => {
      let selectedBackground = BKGS[0];
      const form = modal.querySelector('#create-board-form');

      modal.querySelectorAll('[data-bg]').forEach((node) => {
        node.addEventListener('click', () => {
          selectedBackground = node.dataset.bg;
          modal.querySelectorAll('[data-bg]').forEach((x) => x.classList.remove('active'));
          node.classList.add('active');
        });
      });

      modal.querySelector('[data-modal-cancel]').addEventListener('click', close);

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const fd = new FormData(form);

        const payload = {
          title: String(fd.get('title') || '').trim(),
          description: String(fd.get('description') || '').trim(),
          background: selectedBackground,
          visibility: String(fd.get('visibility') || 'private'),
        };

        if (!payload.title) return;

        try {
          const created = await api('/boards', 'POST', payload);
          state.boards = [created, ...state.boards];
          close();
          render();
        } catch (error) {
          toastError(error.message);
        }
      });
    },
  });
}

function renderBoardPage() {
  const board = state.board;

  appEl.innerHTML = `
    <div class="page" style="display:flex;flex-direction:column;min-height:100vh">
      ${renderNavbar(board ? board.title : '')}
      ${
        state.boardLoading
          ? renderSpinner()
          : board
            ? `
            <div class="board-header">
              <button class="btn btn-sm btn-ghost" id="boards-back">Back</button>
              <h2 style="font-size:16px;font-weight:700">${escapeHtml(board.title)}</h2>
              <span style="font-size:11px;font-weight:700;padding:2px 9px;border-radius:6px;background:rgba(91,106,240,0.15);color:#818cf8;text-transform:uppercase">${escapeHtml(board.visibility)}</span>
            </div>

            <div class="board-viewport" style="background:linear-gradient(rgba(7,11,20,0.4),rgba(7,11,20,0.4)), ${escapeHtml(board.background)};background-size:cover;">
              ${state.lists.map(renderListColumn).join('')}
              ${renderAddListColumn()}
            </div>
          `
            : `<div class="container"><p style="color:var(--text2)">Board not found.</p></div>`
      }
    </div>
  `;

  bindNavbar();

  if (state.boardLoading || !board) {
    closeModal();
    return;
  }

  const back = appEl.querySelector('#boards-back');
  if (back) back.addEventListener('click', () => navigate('dashboard'));    
  appEl.querySelectorAll('[data-list-delete]').forEach((node) => {
    node.addEventListener('click', async () => {
      const listId = node.dataset.listDelete;
      const ok = window.confirm('Delete list and all its cards?');
      if (!ok) return;

      try {
        await api(`/lists/${listId}`, 'DELETE');
        state.lists = state.lists.filter((list) => list._id !== listId);
        state.cards = state.cards.filter((card) => card.list !== listId);
        render();
      } catch (error) {
        toastError(error.message);
      }
    });
  });

  appEl.querySelectorAll('[data-list-rename]').forEach((node) => {
    node.addEventListener('click', async () => {
      const listId = node.dataset.listRename;
      const list = state.lists.find((item) => item._id === listId);
      if (!list) return;

      const title = window.prompt('Rename list', list.title);
      if (title == null) return;
      const trimmed = title.trim();
      if (!trimmed) return;

      try {
        const updated = await api(`/lists/${listId}`, 'PUT', { title: trimmed });
        state.lists = state.lists.map((item) => (item._id === listId ? updated : item));
        render();
      } catch (error) {
        toastError(error.message);
      }
    });
  });

  appEl.querySelectorAll('[data-add-card]').forEach((node) => {
    node.addEventListener('click', () => {
      const listId = node.dataset.addCard;
      state.addCardListId = listId;
      state.addCardText = '';
      render();
    });
  });

  appEl.querySelectorAll('[data-add-card-cancel]').forEach((node) => {
    node.addEventListener('click', () => {
      state.addCardListId = null;
      state.addCardText = '';
      render();
    });
  });

  appEl.querySelectorAll('[data-add-card-form]').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const listId = form.dataset.addCardForm;
      const titleInput = form.querySelector('textarea[name="title"]');
      const title = String(titleInput.value || '').trim();
      if (!title) return;

      try {
        const created = await api('/cards', 'POST', {
          title,
          list: listId,
          board: state.boardId,
          position: cardsOf(listId).length,
        });
        state.cards = [...state.cards, created];
        state.addCardListId = null;
        state.addCardText = '';
        render();
      } catch (error) {
        toastError(error.message);
      }
    });
  });

  appEl.querySelectorAll('[data-add-list-trigger]').forEach((node) => {
    node.addEventListener('click', () => {
      state.addListOpen = true;
      state.addListTitle = '';
      render();
    });
  });

  const addListCancel = appEl.querySelector('[data-add-list-cancel]');
  if (addListCancel) {
    addListCancel.addEventListener('click', () => {
      state.addListOpen = false;
      state.addListTitle = '';
      render();
    });
  }

  const addListForm = appEl.querySelector('[data-add-list-form]');
  if (addListForm) {
    addListForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const input = addListForm.querySelector('input[name="title"]');
      const title = String(input.value || '').trim();
      if (!title) return;

      try {
        const created = await api('/lists', 'POST', {
          title,
          board: state.boardId,
          position: state.lists.length,
        });

        state.lists = [...state.lists, created];
        state.addListOpen = false;
        state.addListTitle = '';
        render();
      } catch (error) {
        toastError(error.message);
      }
    });
  }

  appEl.querySelectorAll('[data-card-open]').forEach((node) => {
    node.addEventListener('click', () => {
      state.cardModalId = node.dataset.cardOpen;
      state.cardTab = 'details';
      state.cardChecklistInput = '';
      state.cardLabelText = '';
      state.cardLabelColor = LABEL_COLORS[0];
      renderCardModal();
    });
  });

  appEl.querySelectorAll('[data-card-drag]').forEach((node) => {
    node.addEventListener('dragstart', () => {
      state.dragCardId = node.dataset.cardDrag;
      node.classList.add('dragging');
    });

    node.addEventListener('dragend', () => {
      state.dragCardId = null;
      node.classList.remove('dragging');
      appEl.querySelectorAll('.list-col').forEach((list) => list.classList.remove('drag-over'));
    });
  });

  appEl.querySelectorAll('[data-list-drop]').forEach((node) => {
    node.addEventListener('dragover', (event) => {
      event.preventDefault();
      node.classList.add('drag-over');
    });

    node.addEventListener('dragleave', () => {
      node.classList.remove('drag-over');
    });

    node.addEventListener('drop', async (event) => {
      event.preventDefault();
      node.classList.remove('drag-over');

      const targetListId = node.dataset.listDrop;
      const cardId = state.dragCardId;
      state.dragCardId = null;

      if (!cardId) return;
      const card = state.cards.find((item) => item._id === cardId);
      if (!card || card.list === targetListId) return;

      try {
        const updated = await api(`/cards/${cardId}`, 'PUT', {
          list: targetListId,
          board: state.boardId,
          position: cardsOf(targetListId).length,
        });

        state.cards = state.cards.map((item) => (item._id === cardId ? updated : item));
        render();
      } catch (error) {
        toastError(error.message);
      }
    });
  });

  if (state.cardModalId) {
    renderCardModal();
  } else {
    closeModal();
  }
}
function renderListColumn(list) {
  const cards = cardsOf(list._id);
  const addCardOpen = state.addCardListId === list._id;

  return `
    <div class="list-col" data-list-drop="${list._id}">
      <div class="list-head">
        <span class="list-count">${cards.length}</span>
        <span class="list-title" data-list-rename="${list._id}">${escapeHtml(list.title)}</span>
        <button class="list-delete" data-list-delete="${list._id}">x</button>
      </div>

      <div class="list-cards">
        ${cards.map(renderCardChip).join('')}
      </div>

      <div class="list-foot">
        ${
          addCardOpen
            ? `
            <form data-add-card-form="${list._id}">
              <textarea rows="2" name="title" placeholder="Card title..." style="width:100%;padding:8px 10px;border-radius:9px;background:var(--surface3);resize:none;margin-bottom:8px"></textarea>
              <div style="display:flex;gap:7px">
                <button class="btn btn-sm btn-primary" type="submit" style="flex:1">Add Card</button>
                <button class="btn btn-sm btn-ghost" type="button" data-add-card-cancel="${list._id}">x</button>
              </div>
            </form>
          `
            : `<button class="btn btn-sm btn-ghost" data-add-card="${list._id}" style="width:100%;text-align:left">+ Add card</button>`
        }
      </div>
    </div>
  `;
}

function renderCardChip(card) {
  const done = Array.isArray(card.checklist) ? card.checklist.filter((item) => item.completed).length : 0;
  const total = Array.isArray(card.checklist) ? card.checklist.length : 0;
  const overdue = card.dueDate && new Date(card.dueDate) < new Date();

  return `
    <div class="card-chip" draggable="true" data-card-drag="${card._id}" data-card-open="${card._id}">
      ${
        card.labels?.length
          ? `<div class="card-labels">${card.labels.map((label) => `<span class="card-label" style="background:${escapeHtml(label.color)}">${escapeHtml(label.text)}</span>`).join('')}</div>`
          : ''
      }

      <div class="card-title">${escapeHtml(card.title)}</div>

      <div class="card-meta">
        <div class="card-meta-left">
          ${
            card.priority
              ? `<span class="priority-pill" style="background:${PRIORITY_COLOR[card.priority]}22;color:${PRIORITY_COLOR[card.priority]}">${escapeHtml(card.priority)}</span>`
              : ''
          }
          ${card.dueDate ? `<span style="font-size:11px;color:${overdue ? '#f87171' : 'var(--text2)'}">due ${escapeHtml(formatDate(card.dueDate))}</span>` : ''}
        </div>
        <div class="card-meta-right">
          ${card.comments?.length ? `<span style="font-size:11px;color:var(--text2)">comments ${card.comments.length}</span>` : ''}
          ${total ? `<span style="font-size:11px;color:${done === total ? 'var(--green)' : 'var(--text2)'}">check ${done}/${total}</span>` : ''}
        </div>
      </div>

      ${total ? `<div class="progress-wrap"><div class="progress-bar" style="width:${(done / total) * 100}%"></div></div>` : ''}
    </div>
  `;
}

function renderAddListColumn() {
  return `
    <div class="add-list-btn">
      ${
        state.addListOpen
          ? `
          <form class="add-list-form" data-add-list-form>
            <input name="title" placeholder="List title..." style="width:100%;padding:9px 12px;margin-bottom:10px" />
            <div style="display:flex;gap:8px">
              <button class="btn btn-sm btn-primary" type="submit" style="flex:1">Add List</button>
              <button class="btn btn-sm btn-ghost" type="button" data-add-list-cancel>x</button>
            </div>
          </form>
        `
          : '<button class="add-list-action" data-add-list-trigger>+ Add List</button>'
      }
    </div>
  `;
}
function renderCardModal() {
  const card = state.cards.find((item) => item._id === state.cardModalId);

  if (!card) {
    state.cardModalId = null;
    closeModal();
    return;
  }

  const done = card.checklist?.filter((item) => item.completed).length || 0;
  const total = card.checklist?.length || 0;

  mountModal({
    title: '',
    width: 620,
    bodyHtml: `
      <div style="margin-bottom:18px">
        <textarea id="card-title" rows="2" style="width:100%;background:transparent;border:none;color:var(--text);font-size:20px;font-weight:700;font-family:Syne;resize:none;line-height:1.3">${escapeHtml(card.title)}</textarea>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px">
          <button class="btn btn-sm btn-danger" id="card-delete">Delete card</button>
        </div>
      </div>

      <div class="tab-row">
        ${['details', 'checklist', 'labels'].map((tab) => `<button class="tab-btn ${state.cardTab === tab ? 'active' : ''}" data-card-tab="${tab}">${tab}</button>`).join('')}
      </div>

      <div id="card-tab-content">
        ${renderCardTabContent(card, done, total)}
      </div>
    `,
    onSetup: (modal, close) => {
      modal.querySelector('#card-title').addEventListener('blur', async (event) => {
        const title = String(event.target.value || '').trim();
        if (!title || title === card.title) return;
        await patchCard(card._id, { title });
      });

      modal.querySelector('#card-delete').addEventListener('click', async () => {
        const ok = window.confirm('Delete this card?');
        if (!ok) return;

        try {
          await api(`/cards/${card._id}`, 'DELETE');
          state.cards = state.cards.filter((item) => item._id !== card._id);
          state.cardModalId = null;
          close();
          render();
        } catch (error) {
          toastError(error.message);
        }
      });

      modal.querySelectorAll('[data-card-tab]').forEach((btn) => {
        btn.addEventListener('click', () => {
          state.cardTab = btn.dataset.cardTab;
          renderCardModal();
        });
      });

      bindCardTabActions(modal, card);

      const closeButton = modal.querySelector('[data-modal-close]');
      closeButton.addEventListener('click', () => {
        state.cardModalId = null;
        state.cardTab = 'details';
      });
    },
    onClose: () => {
      state.cardModalId = null;
      state.cardTab = 'details';
      state.cardChecklistInput = '';
      state.cardLabelText = '';
    },
  });
}

function renderCardTabContent(card, done, total) {
  if (state.cardTab === 'details') {
    return `
      <div style="display:flex;flex-direction:column;gap:18px">
        <div>
          <label style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:0.07em;display:block;margin-bottom:7px">Description</label>
          <textarea id="card-desc" rows="4" placeholder="Add a detailed description..." style="width:100%;padding:11px">${escapeHtml(card.description || '')}</textarea>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div>
            <label style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:0.07em;display:block;margin-bottom:7px">Due Date</label>
            <input id="card-due" type="date" style="width:100%;padding:10px 12px" value="${escapeHtml(card.dueDate ? card.dueDate.slice(0, 10) : '')}" />
          </div>
          <div>
            <label style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:0.07em;display:block;margin-bottom:7px">Priority</label>
            <div style="display:flex;gap:5px">
              ${['low', 'medium', 'high', 'urgent'].map((priority) => {
                const active = (card.priority || 'medium') === priority;
                return `<button class="priority-choice" data-priority="${priority}" style="flex:1;padding:8px 4px;border-radius:8px;font-size:10px;font-weight:700;background:${active ? `${PRIORITY_COLOR[priority]}25` : 'var(--surface2)'};color:${active ? PRIORITY_COLOR[priority] : 'var(--text3)'};border:${active ? `1px solid ${PRIORITY_COLOR[priority]}55` : '1px solid transparent'};text-transform:capitalize">${priority}</button>`;
              }).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  if (state.cardTab === 'checklist') {
    return `
      <div>
        ${
          total > 0
            ? `
          <div style="margin-bottom:16px">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:13px">
              <span style="color:var(--text2)">${done}/${total} complete</span>
              <span style="color:var(--green);font-weight:700">${Math.round((done / total) * 100)}%</span>
            </div>
            <div style="height:6px;background:var(--surface3);border-radius:4px;overflow:hidden">
              <div style="height:100%;background:var(--green);border-radius:4px;width:${(done / total) * 100}%"></div>
            </div>
          </div>
        `
            : ''
        }

        ${
          (card.checklist || [])
            .map(
              (item, index) => `
          <div style="display:flex;align-items:center;gap:11px;padding:10px 11px;border-radius:9px;margin-bottom:6px;background:var(--surface2);border:1px solid var(--border)">
            <button data-check-toggle="${index}" style="width:19px;height:19px;border-radius:5px;flex-shrink:0;border:2px solid ${item.completed ? 'var(--green)' : 'var(--border2)'};background:${item.completed ? 'var(--green)' : 'transparent'};color:#fff;font-size:11px;font-weight:800">${item.completed ? 'v' : ''}</button>
            <span style="flex:1;font-size:13px;color:${item.completed ? 'var(--text3)' : 'var(--text)'};text-decoration:${item.completed ? 'line-through' : 'none'}">${escapeHtml(item.text)}</span>
            <button data-check-remove="${index}" style="background:transparent;color:var(--text3);font-size:14px;padding:2px 5px">x</button>
          </div>
        `
            )
            .join('')
        }

        <div style="display:flex;gap:8px;margin-top:12px">
          <input id="check-item-input" placeholder="Add task item..." style="flex:1;padding:10px 12px" value="${escapeHtml(state.cardChecklistInput)}" />
          <button class="btn btn-sm btn-primary" id="add-check-item">Add</button>
        </div>
      </div>
    `;
  }

  return `
    <div>
      ${
        (card.labels || []).length > 0
          ? `
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px">
          ${card.labels
            .map(
              (label, index) => `
            <div style="display:flex;align-items:center;gap:7px;background:${escapeHtml(label.color)};border-radius:8px;padding:5px 12px">
              <span style="color:#fff;font-weight:700;font-size:13px">${escapeHtml(label.text)}</span>
              <button data-label-remove="${index}" style="background:transparent;color:rgba(255,255,255,0.8);font-size:14px">x</button>
            </div>
          `
            )
            .join('')}
        </div>
      `
          : ''
      }

      <div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:14px">
        ${LABEL_COLORS.map((color) => `<div data-label-color="${color}" style="width:32px;height:24px;border-radius:7px;background:${color};cursor:pointer;border:${state.cardLabelColor === color ? '3px solid #fff' : '3px solid transparent'};box-shadow:${state.cardLabelColor === color ? `0 0 0 2px ${color}` : 'none'}"></div>`).join('')}
      </div>

      <div style="display:flex;gap:8px">
        <input id="label-text-input" placeholder="Label name..." style="flex:1;padding:10px 12px" value="${escapeHtml(state.cardLabelText)}" />
        <button class="btn btn-sm btn-primary" id="add-label">Add</button>
      </div>
    </div>
  `;
}
function bindCardTabActions(modal, card) {
  if (state.cardTab === 'details') {
    const desc = modal.querySelector('#card-desc');
    const due = modal.querySelector('#card-due');

    if (desc) {
      desc.addEventListener('blur', async (event) => {
        const description = String(event.target.value || '');
        if (description === (card.description || '')) return;
        await patchCard(card._id, { description });
      });
    }

    if (due) {
      due.addEventListener('change', async (event) => {
        const dueDate = event.target.value || null;
        await patchCard(card._id, { dueDate });
      });
    }

    modal.querySelectorAll('[data-priority]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await patchCard(card._id, { priority: btn.dataset.priority });
      });
    });
  }

  if (state.cardTab === 'checklist') {
    const input = modal.querySelector('#check-item-input');
    const addBtn = modal.querySelector('#add-check-item');

    if (input) {
      input.addEventListener('input', (event) => {
        state.cardChecklistInput = event.target.value;
      });

      input.addEventListener('keydown', async (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        await addChecklistItem(card);
      });
    }

    if (addBtn) {
      addBtn.addEventListener('click', async () => {
        await addChecklistItem(card);
      });
    }

    modal.querySelectorAll('[data-check-toggle]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const index = Number(btn.dataset.checkToggle);
        const checklist = [...(card.checklist || [])];
        checklist[index] = { ...checklist[index], completed: !checklist[index].completed };
        await patchCard(card._id, { checklist });
      });
    });

    modal.querySelectorAll('[data-check-remove]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const index = Number(btn.dataset.checkRemove);
        const checklist = (card.checklist || []).filter((_, idx) => idx !== index);
        await patchCard(card._id, { checklist });
      });
    });
  }

  if (state.cardTab === 'labels') {
    const textInput = modal.querySelector('#label-text-input');
    const addBtn = modal.querySelector('#add-label');

    if (textInput) {
      textInput.addEventListener('input', (event) => {
        state.cardLabelText = event.target.value;
      });

      textInput.addEventListener('keydown', async (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        await addCardLabel(card);
      });
    }

    if (addBtn) {
      addBtn.addEventListener('click', async () => {
        await addCardLabel(card);
      });
    }

    modal.querySelectorAll('[data-label-color]').forEach((node) => {
      node.addEventListener('click', () => {
        state.cardLabelColor = node.dataset.labelColor;
        renderCardModal();
      });
    });

    modal.querySelectorAll('[data-label-remove]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const index = Number(btn.dataset.labelRemove);
        const labels = (card.labels || []).filter((_, idx) => idx !== index);
        await patchCard(card._id, { labels });
      });
    });
  }
}

async function addChecklistItem(card) {
  const text = String(state.cardChecklistInput || '').trim();
  if (!text) return;

  const checklist = [...(card.checklist || []), { text, completed: false }];
  state.cardChecklistInput = '';
  await patchCard(card._id, { checklist });
}

async function addCardLabel(card) {
  const text = String(state.cardLabelText || '').trim();
  if (!text) return;

  const labels = [...(card.labels || []), { color: state.cardLabelColor, text }];
  state.cardLabelText = '';
  await patchCard(card._id, { labels });
}

async function patchCard(cardId, payload) {
  try {
    const updated = await api(`/cards/${cardId}`, 'PUT', payload);
    state.cards = state.cards.map((item) => (item._id === cardId ? updated : item));
    renderCardModal();
    renderBoardPage();
  } catch (error) {
    toastError(error.message);
  }
}

function renderAdminPage() {
  appEl.innerHTML = `
    <div class="page">
      ${renderNavbar('')}
      <div class="container" style="max-width:1100px">
        <div class="page-head" style="margin-bottom:36px">
          <div>
            <h2 class="page-title">Admin Dashboard</h2>
            <p class="page-subtitle">Manage users, boards and platform data</p>
          </div>
          <button class="btn btn-md btn-ghost" id="admin-back">Back to App</button>
        </div>

        ${
          state.adminLoading
            ? renderSpinner()
            : `
            <div class="admin-stats">
              ${[
                { key: 'users', label: 'Total Users', value: state.adminStats?.users ?? '-', color: '#5b6af0', bg: 'rgba(91,106,240,0.12)' },
                { key: 'boards', label: 'Total Boards', value: state.adminStats?.boards ?? '-', color: '#f472b6', bg: 'rgba(244,114,182,0.12)' },
                { key: 'cards', label: 'Total Cards', value: state.adminStats?.cards ?? '-', color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
              ]
                .map(
                  (item) => `
                <div class="stat-card" style="background:${item.bg};border:1px solid ${item.color}30">
                  <span style="font-size:36px">#</span>
                  <div>
                    <div class="stat-value" style="color:${item.color}">${item.value}</div>
                    <div style="color:var(--text2);font-size:13px;margin-top:2px">${item.label}</div>
                  </div>
                </div>
              `
                )
                .join('')}
            </div>

            <div class="admin-tabs">
              <button class="admin-tab ${state.adminTab === 'users' ? 'active' : ''}" data-admin-tab="users">users</button>
              <button class="admin-tab ${state.adminTab === 'boards' ? 'active' : ''}" data-admin-tab="boards">boards</button>
            </div>

            ${state.adminTab === 'users' ? renderAdminUsersTable() : renderAdminBoardsGrid()}
          `
        }
      </div>
    </div>
  `;

  bindNavbar();

  const back = appEl.querySelector('#admin-back');
  if (back) back.addEventListener('click', () => navigate('dashboard'));

  appEl.querySelectorAll('[data-admin-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.adminTab = btn.dataset.adminTab;
      render();
    });
  });

  appEl.querySelectorAll('[data-user-delete]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const userId = btn.dataset.userDelete;
      const ok = window.confirm('Permanently delete this user?');
      if (!ok) return;

      try {
        await api(`/admin/users/${userId}`, 'DELETE');
        state.adminUsers = state.adminUsers.filter((user) => user._id !== userId);
        render();
      } catch (error) {
        toastError(error.message);
      }
    });
  });
}

function renderAdminUsersTable() {
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Joined</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${
            state.adminUsers.length
              ? state.adminUsers
                  .map(
                    (user) => `
                <tr>
                  <td style="font-weight:600;font-size:14px">${escapeHtml(user.name)}</td>
                  <td style="color:var(--text2);font-size:13px">${escapeHtml(user.email)}</td>
                  <td>
                    <span class="role-pill ${user.role === 'admin' ? 'role-admin' : 'role-user'}">${escapeHtml(user.role)}</span>
                  </td>
                  <td style="color:var(--text2);font-size:12px">${escapeHtml(formatDate(user.createdAt))}</td>
                  <td><button class="btn btn-sm btn-danger" data-user-delete="${user._id}">Delete</button></td>
                </tr>
              `
                  )
                  .join('')
              : '<tr><td colspan="5" style="text-align:center;color:var(--text2);padding:40px">No users found</td></tr>'
          }
        </tbody>
      </table>
    </div>
  `;
}

function renderAdminBoardsGrid() {
  return `
    <div class="admin-board-grid">
      ${
        state.adminBoards.length
          ? state.adminBoards
              .map(
                (board) => `
            <div class="board-card" style="background:${escapeHtml(board.background)};min-height:100px;cursor:default">
              <div class="board-overlay"></div>
              <div class="board-content" style="padding:16px">
                <div>
                  <h3 style="color:#fff;font-weight:700;font-size:15px;margin-bottom:4px">${escapeHtml(board.title)}</h3>
                  <p style="color:rgba(255,255,255,0.65);font-size:12px">owner ${escapeHtml(board.owner?.name || 'Unknown')}</p>
                  <p style="color:rgba(255,255,255,0.45);font-size:11px;margin-top:3px">${escapeHtml(formatDate(board.createdAt))}</p>
                </div>
              </div>
            </div>
          `
              )
              .join('')
          : '<div style="color:var(--text2);padding:20px">No boards found</div>'
      }
    </div>
  `;
}
function render() {
  if (!state.user) {
    state.page = 'auth';
  }

  if (state.page === 'loading') {
    appEl.innerHTML = `<div class="page">${renderSpinner()}</div>`;
    return;
  }

  if (state.page === 'auth') {
    closeModal();
    renderAuthPage();
    return;
  }

  if (state.page === 'board') {
    renderBoardPage();
    return;
  }

  if (state.page === 'admin') {
    if (state.user?.role !== 'admin') {
      state.page = 'dashboard';
      renderDashboardPage();
      return;
    }
    closeModal();
    renderAdminPage();
    return;
  }

  closeModal();
  renderDashboardPage();
}

async function loadBoards() {
  state.dashboardLoading = true;
  render();

  try {
    state.boards = await api('/boards');
  } catch (error) {
    toastError(error.message);
  } finally {
    state.dashboardLoading = false;
    render();
  }
}

async function loadBoard(boardId) {
  state.boardLoading = true;
  state.board = null;
  state.lists = [];
  state.cards = [];
  state.cardModalId = null;
  render();

  try {
    const data = await api(`/boards/${boardId}`);
    state.board = data.board;
    state.lists = data.lists || [];
    state.cards = data.cards || [];
  } catch (error) {
    toastError(error.message);
    state.page = 'dashboard';
  } finally {
    state.boardLoading = false;
    render();
  }
}

async function loadAdmin() {
  state.adminLoading = true;
  render();

  try {
    const [stats, users, boards] = await Promise.all([api('/admin/stats'), api('/admin/users'), api('/admin/boards')]);
    state.adminStats = stats;
    state.adminUsers = users;
    state.adminBoards = boards;
  } catch (error) {
    toastError(error.message);
    state.page = 'dashboard';
  } finally {
    state.adminLoading = false;
    render();
  }
}

async function navigate(page, boardId = null) {
  state.page = page;
  state.boardId = boardId;

  if (page === 'dashboard') {
    await loadBoards();
    return;
  }

  if (page === 'board' && boardId) {
    await loadBoard(boardId);
    return;
  }

  if (page === 'admin') {
    await loadAdmin();
    return;
  }

  render();
}

async function bootstrap() {
  if (state.token && state.user) {
    try {
      const me = await api('/auth/me');
      setAuth(me, state.token);
      state.page = 'dashboard';
      await loadBoards();
      return;
    } catch {
      logout(false);
    }
  }

  state.page = 'auth';
  render();
}

bootstrap();
