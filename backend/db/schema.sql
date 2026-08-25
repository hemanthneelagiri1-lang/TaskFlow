CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  avatar VARCHAR(500) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS boards (
  id CHAR(36) PRIMARY KEY,
  title VARCHAR(190) NOT NULL,
  description TEXT NOT NULL,
  background VARCHAR(255) NOT NULL DEFAULT '#1e3a5f',
  owner_id CHAR(36) NOT NULL,
  starred TINYINT(1) NOT NULL DEFAULT 0,
  visibility ENUM('private', 'team', 'public') NOT NULL DEFAULT 'private',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_boards_owner (owner_id),
  CONSTRAINT fk_boards_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS board_members (
  board_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  PRIMARY KEY (board_id, user_id),
  INDEX idx_board_members_user (user_id),
  CONSTRAINT fk_board_members_board FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
  CONSTRAINT fk_board_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lists (
  id CHAR(36) PRIMARY KEY,
  title VARCHAR(190) NOT NULL,
  board_id CHAR(36) NOT NULL,
  position INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_lists_board_position (board_id, position),
  CONSTRAINT fk_lists_board FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cards (
  id CHAR(36) PRIMARY KEY,
  title VARCHAR(190) NOT NULL,
  description TEXT NOT NULL,
  list_id CHAR(36) NOT NULL,
  board_id CHAR(36) NOT NULL,
  position INT NOT NULL DEFAULT 0,
  assignees LONGTEXT NOT NULL,
  labels LONGTEXT NOT NULL,
  due_date DATETIME NULL,
  priority ENUM('low', 'medium', 'high', 'urgent') NOT NULL DEFAULT 'medium',
  checklist LONGTEXT NOT NULL,
  comments LONGTEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cards_board_position (board_id, position),
  INDEX idx_cards_list_position (list_id, position),
  CONSTRAINT fk_cards_list FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE,
  CONSTRAINT fk_cards_board FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
