# Spendora — Setup Guide
## Node.js + Express + MySQL

---

## What you need installed
- **Node.js** → https://nodejs.org  (download the LTS version)
- **MySQL** → https://dev.mysql.com/downloads/mysql/  (or XAMPP which includes MySQL)

---

## Step-by-step setup

### 1. Set up the database

Open **MySQL Workbench** (or any MySQL tool) and run the file `setup.sql`.
This creates the `spendora` database and all tables automatically.

If you prefer the command line:
```
mysql -u root -p < setup.sql
```

---

### 2. Edit your database credentials

Open `db.js` and update these lines to match your MySQL setup:

```js
const pool = mysql.createPool({
  host:     'localhost',
  user:     'root',        // ← your MySQL username
  password: '',            // ← your MySQL password
  database: 'spendora',
});
```

---

### 3. Install dependencies

Open a terminal in this folder and run:

```
npm install
```

This installs Express, MySQL driver, bcrypt, and JWT — takes about 30 seconds.

---

### 4. Start the server

```
npm start
```

You should see:
```
✅ MySQL connected successfully
🚀 Spendora running at http://localhost:3000
```

---

### 5. Open the app

Go to **http://localhost:3000** in your browser.

Register a new account and start tracking!

---

## File structure

```
spendora-mysql/
├── server.js        ← Backend API (all routes)
├── db.js            ← MySQL connection config
├── setup.sql        ← Run once to create the database
├── package.json     ← Node dependencies
├── README.md        ← This file
└── public/
    ├── index.html   ← Frontend (unchanged)
    ├── style.css    ← Styles (unchanged)
    └── app.js       ← Frontend logic (now uses API)
```

---

## How the database is structured

| Table      | What it stores                          |
|------------|-----------------------------------------|
| `users`    | Accounts (name, username, hashed password) |
| `expenses` | All expense entries, linked to a user   |
| `budgets`  | Monthly budget limits per category      |

Each user's data is completely separate — user A cannot see user B's expenses.

---

## Common issues

**"MySQL connection failed"**
→ Check your username/password in `db.js`
→ Make sure MySQL is running

**"npm install" fails**
→ Make sure Node.js is installed: run `node -v` to check

**Page not loading**
→ Make sure the server is running (`npm start`)
→ Go to http://localhost:3000 (not just opening index.html directly)

---

## Stopping the server

Press `Ctrl + C` in the terminal.
