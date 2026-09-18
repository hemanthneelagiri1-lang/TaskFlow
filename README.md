# TaskFlow  (Trello-Clone)

This project recreates the TaskFlow Kanban UI in the current `task` folder using:

- Frontend: **HTML + CSS + Vanilla JavaScript**
- Backend: **Node.js + Express**
- Database: **MySQL (SQL)**
- Auth: **JWT + bcryptjs**

## Stack Change

Original version used MongoDB + React (MERN-style frontend/backend split).
This version keeps a similar UI/flow but is rebuilt without MERN.

## Features

- Register / login (user/admin)
- Dashboard with board search, create, star, delete
- Board page with lists and drag/drop cards
- Card detail modal with:
  - title / description
  - due date / priority
  - checklist progress
  - labels
- Admin dashboard:
  - stats
  - user list + delete
  - all boards view

## Project Structure

```text
task/
├── backend/
│   ├── db/
│   │   ├── db.js
│   │   └── schema.sql
│   ├── middleware/
│   │   └── auth.js
│   ├── routes/
│   │   ├── admin.js
│   │   ├── auth.js
│   │   ├── boards.js
│   │   ├── cards.js
│   │   └── lists.js
│   ├── utils/
│   │   └── formatters.js
│   └── server.js
├── frontend/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## Setup

1. Install dependencies

```bash
npm install
```

2. Create env file

```bash
copy .env.example .env
```

3. Configure MySQL credentials in `.env`

```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=taskflow
```

4. Run development server

```bash
npm run dev
```

Or production mode:

```bash
npm start
```

Open: `http://localhost:5000`

## API Endpoints

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/boards`
- `POST /api/boards`
- `GET /api/boards/:id`
- `PUT /api/boards/:id`
- `DELETE /api/boards/:id`
- `POST /api/lists`
- `PUT /api/lists/:id`
- `DELETE /api/lists/:id`
- `POST /api/cards`
- `PUT /api/cards/:id`
- `DELETE /api/cards/:id`
- `POST /api/cards/:id/comments`
- `GET /api/admin/stats`
- `GET /api/admin/users`
- `PUT /api/admin/users/:id`
- `DELETE /api/admin/users/:id`
- `GET /api/admin/boards`

## Notes

- The app connects to your MySQL account and creates tables automatically in `MYSQL_DATABASE`.
- JWT secret defaults to `secret123` if `.env` is missing (set your own for real usage).
