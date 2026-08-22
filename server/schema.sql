CREATE TABLE IF NOT EXISTS solves (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  device     TEXT NOT NULL,
  name       TEXT NOT NULL,
  mode       TEXT NOT NULL,
  seed       TEXT NOT NULL DEFAULT '',
  seconds    INTEGER NOT NULL,
  day        TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_daily  ON solves (mode, seed, seconds);
CREATE INDEX IF NOT EXISTS idx_device ON solves (device, day);
CREATE INDEX IF NOT EXISTS idx_recent ON solves (created_at);
