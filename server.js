// ════════════════════════════════════════
//  server.js — Spendora Backend API
//  Node.js + Express + MySQL
// ════════════════════════════════════════

const express    = require('express');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const path       = require('path');
const db         = require('./db');
async function initDB() {
  try {
    await db.query(`CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL, username VARCHAR(50) NOT NULL UNIQUE, password VARCHAR(255) NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    await db.query(`CREATE TABLE IF NOT EXISTS expenses (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, title VARCHAR(150) NOT NULL, amount DECIMAL(10,2) NOT NULL, category VARCHAR(80) NOT NULL, date DATE NOT NULL, note VARCHAR(255) DEFAULT '', payment VARCHAR(50) DEFAULT 'Cash', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)`);
    await db.query(`CREATE TABLE IF NOT EXISTS budgets (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, category VARCHAR(80) NOT NULL, monthly_limit DECIMAL(10,2) NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY unique_user_category (user_id, category), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)`);
    console.log('✅ Database tables ready');
  } catch (err) {
    console.error('❌ Table creation failed:', err.message);
  }
}
initDB();

const app  = express();
const PORT = 3000;

// ── Change this to any long random string ──
const JWT_SECRET = process.env.JWT_SECRET || 'spendora_secret_key_change_me_in_production';
// ────────────────────────────────────────
// MIDDLEWARE
// ────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// JWT auth middleware — protects private routes
function auth(req, res, next) {
  const header = req.headers['authorization'];
  const token  = header && header.split(' ')[1]; // "Bearer <token>"
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }
}

// ════════════════════════════════════════
//  AUTH ROUTES
// ════════════════════════════════════════

// POST /api/register
app.post('/api/register', async (req, res) => {
  const { name, username, password } = req.body;

  if (!name?.trim() || !username?.trim() || !password)
    return res.status(400).json({ error: 'All fields are required.' });

  if (username.trim().length < 3)
    return res.status(400).json({ error: 'Username must be at least 3 characters.' });

  if (password.length < 4)
    return res.status(400).json({ error: 'Password must be at least 4 characters.' });

  try {
    // Check username taken
    const [existing] = await db.query('SELECT id FROM users WHERE username = ?', [username.trim().toLowerCase()]);
    if (existing.length > 0)
      return res.status(409).json({ error: 'That username is already taken.' });

    // Hash password & insert
    const hashed = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (name, username, password) VALUES (?, ?, ?)',
      [name.trim(), username.trim().toLowerCase(), hashed]
    );

    // Issue token
    const user  = { id: result.insertId, name: name.trim(), username: username.trim().toLowerCase() };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '30d' });

    res.status(201).json({ token, user });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// POST /api/login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username?.trim() || !password)
    return res.status(400).json({ error: 'Please fill in all fields.' });

  try {
    const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username.trim().toLowerCase()]);
    if (rows.length === 0)
      return res.status(401).json({ error: 'No account found with that username.' });

    const dbUser = rows[0];
    const match  = await bcrypt.compare(password, dbUser.password);
    if (!match)
      return res.status(401).json({ error: 'Incorrect password.' });

    const user  = { id: dbUser.id, name: dbUser.name, username: dbUser.username };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '30d' });

    res.json({ token, user });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// GET /api/me — verify token & return user info
app.get('/api/me', auth, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, name, username, created_at FROM users WHERE id = ?', [req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'User not found.' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// ════════════════════════════════════════
//  EXPENSES ROUTES  (all protected)
// ════════════════════════════════════════

// GET /api/expenses — get all expenses for logged-in user
app.get('/api/expenses', auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM expenses WHERE user_id = ? ORDER BY date DESC, created_at DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('Get expenses error:', err);
    res.status(500).json({ error: 'Failed to load expenses.' });
  }
});

// POST /api/expenses — add a new expense
app.post('/api/expenses', auth, async (req, res) => {
  const { title, amount, category, date, note, payment } = req.body;

  if (!title?.trim() || !amount || !category || !date)
    return res.status(400).json({ error: 'Title, amount, category, and date are required.' });

  if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0)
    return res.status(400).json({ error: 'Amount must be a positive number.' });

  try {
    const [result] = await db.query(
      'INSERT INTO expenses (user_id, title, amount, category, date, note, payment) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, title.trim(), parseFloat(amount), category, date, note?.trim() || '', payment || 'Cash']
    );

    const [newRow] = await db.query('SELECT * FROM expenses WHERE id = ?', [result.insertId]);
    res.status(201).json(newRow[0]);
  } catch (err) {
    console.error('Add expense error:', err);
    res.status(500).json({ error: 'Failed to save expense.' });
  }
});

// DELETE /api/expenses/:id — delete one expense
app.delete('/api/expenses/:id', auth, async (req, res) => {
  try {
    // Make sure expense belongs to this user
    const [rows] = await db.query('SELECT id FROM expenses WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'Expense not found.' });

    await db.query('DELETE FROM expenses WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete expense error:', err);
    res.status(500).json({ error: 'Failed to delete expense.' });
  }
});

// ════════════════════════════════════════
//  BUDGETS ROUTES  (all protected)
// ════════════════════════════════════════

// GET /api/budgets
app.get('/api/budgets', auth, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM budgets WHERE user_id = ? ORDER BY category', [req.user.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load budgets.' });
  }
});

// POST /api/budgets — create or update budget for a category
app.post('/api/budgets', auth, async (req, res) => {
  const { category, monthly_limit } = req.body;

  if (!category || !monthly_limit || parseFloat(monthly_limit) <= 0)
    return res.status(400).json({ error: 'Category and a valid limit are required.' });

  try {
    // UPSERT — update if category already exists for this user
    await db.query(
      `INSERT INTO budgets (user_id, category, monthly_limit)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE monthly_limit = VALUES(monthly_limit)`,
      [req.user.id, category, parseFloat(monthly_limit)]
    );

    const [rows] = await db.query('SELECT * FROM budgets WHERE user_id = ? AND category = ?', [req.user.id, category]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Save budget error:', err);
    res.status(500).json({ error: 'Failed to save budget.' });
  }
});

// DELETE /api/budgets/:id
app.delete('/api/budgets/:id', auth, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id FROM budgets WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'Budget not found.' });

    await db.query('DELETE FROM budgets WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete budget.' });
  }
});

// ════════════════════════════════════════
//  CATCH-ALL — serve frontend
// ════════════════════════════════════════
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ────────────────────────────────────────
// START SERVER
// ────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Spendora running at http://localhost:${PORT}`);
  console.log(`   Open that URL in your browser\n`);
});
