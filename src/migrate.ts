import type { ModuleDb } from '@mosaic/sdk'

export function migrate(db: ModuleDb): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS finance_categories (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name    TEXT    NOT NULL,
      type    TEXT    NOT NULL DEFAULT 'expense'
                CHECK(type IN ('income','expense')),
      color   TEXT    NOT NULL DEFAULT '#6366f1',
      emoji   TEXT    NOT NULL DEFAULT '',
      UNIQUE(user_id, name)
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS finance_transactions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount      REAL    NOT NULL CHECK(amount > 0),
      type        TEXT    NOT NULL CHECK(type IN ('income','expense')),
      category_id INTEGER REFERENCES finance_categories(id) ON DELETE SET NULL,
      date        TEXT    NOT NULL,
      notes       TEXT    NOT NULL DEFAULT '',
      source      TEXT    NOT NULL DEFAULT 'manual'
                    CHECK(source IN ('manual','inventory')),
      source_id   TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `)

  db.exec(`CREATE INDEX IF NOT EXISTS finance_tx_user_date ON finance_transactions(user_id, date)`)
  db.exec(`CREATE INDEX IF NOT EXISTS finance_cat_user     ON finance_categories(user_id, type)`)
}
