-- ════════════════════════════════════════
--  SPENDORA — MySQL Database Setup
--  Run this file once to create everything
-- ════════════════════════════════════════

-- 1. Create the database
CREATE DATABASE IF NOT EXISTS spendora CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE spendora;

-- 2. Users table
CREATE TABLE IF NOT EXISTS users (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100)  NOT NULL,
  username   VARCHAR(50)   NOT NULL UNIQUE,
  password   VARCHAR(255)  NOT NULL,       -- bcrypt hash
  created_at DATETIME      DEFAULT CURRENT_TIMESTAMP
);

-- 3. Expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT           NOT NULL,
  title      VARCHAR(150)  NOT NULL,
  amount     DECIMAL(10,2) NOT NULL,
  category   VARCHAR(80)   NOT NULL,
  date       DATE          NOT NULL,
  note       VARCHAR(255)  DEFAULT '',
  payment    VARCHAR(50)   DEFAULT 'Cash',
  created_at DATETIME      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 4. Budgets table
CREATE TABLE IF NOT EXISTS budgets (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT           NOT NULL,
  category   VARCHAR(80)   NOT NULL,
  monthly_limit DECIMAL(10,2) NOT NULL,
  created_at DATETIME      DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_category (user_id, category),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Done! Your database is ready.
SELECT 'Spendora database setup complete!' AS status;
