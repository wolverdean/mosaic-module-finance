import type { Database } from 'better-sqlite3'

export interface Category {
  id:      number
  user_id: number
  name:    string
  type:    'income' | 'expense'
  color:   string
  emoji:   string
}

export interface CreateCategoryInput {
  name:   string
  type:   'income' | 'expense'
  color?: string
  emoji?: string
}

export function createCategory(db: Database, userId: number, input: CreateCategoryInput): Category {
  const result = db.prepare(`
    INSERT INTO finance_categories (user_id, name, type, color, emoji)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, input.name.trim(), input.type, input.color ?? '#6366f1', input.emoji ?? '')
  return db.prepare('SELECT * FROM finance_categories WHERE id = ?').get(result.lastInsertRowid) as Category
}

export function listCategories(db: Database, userId: number, type?: 'income' | 'expense'): Category[] {
  if (type) {
    return db.prepare('SELECT * FROM finance_categories WHERE user_id = ? AND type = ? ORDER BY name').all(userId, type) as Category[]
  }
  return db.prepare('SELECT * FROM finance_categories WHERE user_id = ? ORDER BY type, name').all(userId) as Category[]
}

export function getCategory(db: Database, userId: number, id: number): Category | undefined {
  return db.prepare('SELECT * FROM finance_categories WHERE id = ? AND user_id = ?').get(id, userId) as Category | undefined
}

export function updateCategory(
  db: Database, userId: number, id: number,
  input: Partial<Pick<Category, 'name' | 'color' | 'emoji'>>,
): Category | undefined {
  if (!getCategory(db, userId, id)) return undefined
  db.prepare(`
    UPDATE finance_categories SET
      name  = COALESCE(?, name),
      color = COALESCE(?, color),
      emoji = COALESCE(?, emoji)
    WHERE id = ? AND user_id = ?
  `).run(
    input.name  !== undefined ? input.name.trim() : null,
    input.color !== undefined ? input.color : null,
    input.emoji !== undefined ? input.emoji : null,
    id, userId,
  )
  return getCategory(db, userId, id)
}

export function deleteCategory(db: Database, userId: number, id: number): void {
  db.prepare('DELETE FROM finance_categories WHERE id = ? AND user_id = ?').run(id, userId)
}
