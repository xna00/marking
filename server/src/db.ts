import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const DB_PATH = join(process.cwd(), "data", "marking.db");

let db: DatabaseSync | null = null;

function getDb(): DatabaseSync {
  if (!db) {
    mkdirSync(join(process.cwd(), "data"), { recursive: true });
    db = new DatabaseSync(DB_PATH);
  }
  return db;
}

export function initDb(): void {
  const d = getDb();
  d.exec(`CREATE TABLE IF NOT EXISTS kfCursor (
    openKfId TEXT PRIMARY KEY,
    cursor TEXT NOT NULL
  )`);
}

export function loadCursor(openKfId: string): string | null {
  const stmt = getDb().prepare("SELECT cursor FROM kfCursor WHERE openKfId = ?");
  const row = stmt.get(openKfId) as { cursor: string } | undefined;
  return row?.cursor ?? null;
}

export function saveCursor(openKfId: string, cursor: string): void {
  const stmt = getDb().prepare("INSERT OR REPLACE INTO kfCursor (openKfId, cursor) VALUES (?, ?)");
  stmt.run(openKfId, cursor);
}
