PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('employee', 'director', 'accounts')),
  employee_id TEXT,
  department TEXT DEFAULT 'General'
);

CREATE TABLE IF NOT EXISTS vouchers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  voucher_no TEXT UNIQUE NOT NULL,
  employee_id INTEGER NOT NULL REFERENCES users(id),
  voucher_date TEXT NOT NULL,
  expense_date TEXT NOT NULL,
  department TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT DEFAULT '',
  amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft',
  employee_signature TEXT,
  director_signature TEXT,
  rejection_reason TEXT,
  approval_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workflow_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  voucher_id INTEGER NOT NULL REFERENCES vouchers(id),
  actor_id INTEGER NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  note TEXT DEFAULT '',
  created_at TEXT NOT NULL
);
