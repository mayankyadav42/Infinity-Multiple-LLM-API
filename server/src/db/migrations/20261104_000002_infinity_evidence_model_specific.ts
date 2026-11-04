// Add an explicit model-specific evidence flag to the Infinity registry.
// Existing rows default to false and therefore remain in Review until verified.
import type { Db } from '../types.js';

export function up(db: Db): void {
  const columns = db.prepare('PRAGMA table_info(infinity_model_evidence)').all() as Array<{ name: string }>;
  if (!columns.some(column => column.name === 'model_specific')) {
    db.exec('ALTER TABLE infinity_model_evidence ADD COLUMN model_specific INTEGER NOT NULL DEFAULT 0 CHECK (model_specific IN (0, 1))');
  }
}

export function down(db: Db): void {
  // SQLite column removal is not portable across the supported bundled SQLite
  // versions. Keep the column on rollback; it is additive and defaults safely.
}
