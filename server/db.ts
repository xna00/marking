import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const DB_PATH = join(process.cwd(), "data", "marking.db");

let db: DatabaseSync | null = null;

function getDb(): DatabaseSync {
  if (!db) {
    mkdirSync(join(process.cwd(), "data"), { recursive: true });
    db = new DatabaseSync(DB_PATH);
    db.exec("PRAGMA journal_mode=WAL");
  }
  return db;
}

export function initDb(): void {
  const d = getDb();
  d.exec(`CREATE TABLE IF NOT EXISTS kfCursor (
    openKfId TEXT PRIMARY KEY,
    cursor TEXT NOT NULL
  )`);
  d.exec(`CREATE TABLE IF NOT EXISTS user (
    externalUserId TEXT PRIMARY KEY,
    username       TEXT NOT NULL UNIQUE,
    passwordHash   TEXT NOT NULL,
    email          TEXT,
    phone          TEXT,
    token          TEXT,
    createdAt      TEXT NOT NULL,
    updatedAt      TEXT NOT NULL
  )`);
  d.exec(`CREATE TABLE IF NOT EXISTS markRecord (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    userId          TEXT NOT NULL REFERENCES user(externalUserId),
    createdAt       TEXT NOT NULL,
    confirmedAt     TEXT
  )`);
  d.exec(`CREATE TABLE IF NOT EXISTS creditTransaction (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    userId          TEXT NOT NULL REFERENCES user(externalUserId),
    amountMoney     INTEGER NOT NULL,
    amountCredits   INTEGER NOT NULL,
    description     TEXT,
    createdAt       TEXT NOT NULL
  )`);
}

export function insertMarkRecord(userId: string): number {
  const stmt = getDb().prepare("INSERT INTO markRecord (userId, createdAt) VALUES (?, ?)");
  const result = stmt.run(userId, new Date().toISOString()) as { lastInsertRowid: number };
  return Number(result.lastInsertRowid);
}

export function countConfirmedRecords(userId: string): number {
  const stmt = getDb().prepare("SELECT COUNT(*) as count FROM markRecord WHERE userId = ? AND confirmedAt IS NOT NULL");
  return (stmt.get(userId) as { count: number }).count;
}

export function sumCredits(userId: string): number {
  const stmt = getDb().prepare(
    "SELECT COALESCE(SUM(amountCredits), 0) as total FROM creditTransaction WHERE userId = ?"
  );
  return (stmt.get(userId) as { total: number }).total;
}

export function getTransactions(userId: string): { id: number; amountMoney: number; amountCredits: number; description: string | null; createdAt: string }[] {
  const stmt = getDb().prepare(
    "SELECT id, amountMoney, amountCredits, description, createdAt FROM creditTransaction WHERE userId = ? ORDER BY createdAt DESC LIMIT 50"
  );
  return stmt.all(userId) as { id: number; amountMoney: number; amountCredits: number; description: string | null; createdAt: string }[];
}

export function getUsageHistory(userId: string): { id: number; createdAt: string; confirmedAt: string }[] {
  const stmt = getDb().prepare(
    "SELECT id, createdAt, confirmedAt FROM markRecord WHERE userId = ? AND confirmedAt IS NOT NULL ORDER BY createdAt DESC LIMIT 50"
  );
  return stmt.all(userId) as { id: number; createdAt: string; confirmedAt: string }[];
}

export function confirmMarkRecord(id: number, userId: string): boolean {
  const stmt = getDb().prepare("UPDATE markRecord SET confirmedAt = ? WHERE id = ? AND userId = ?");
  const result = stmt.run(new Date().toISOString(), id, userId) as { changes: number };
  return result.changes > 0;
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

// ── user ──

export type User = {
  externalUserId: string;
  username: string;
  passwordHash: string;
  email: string | null;
  phone: string | null;
  token: string | null;
  createdAt: string;
  updatedAt: string;
};

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const key = scryptSync(password, salt, 64).toString("hex");
  return `${salt}$${key}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, key] = stored.split("$");
  const derived = scryptSync(password, salt, 64);
  return timingSafeEqual(derived, Buffer.from(key, "hex"));
}

export function createUser(
  externalUserId: string,
  username: string,
  password: string,
  email?: string,
  phone?: string,
): User & { token: string } {
  const now = new Date().toISOString();
  const passwordHash = hashPassword(password);
  const token = randomBytes(32).toString("hex");
  const stmt = getDb().prepare(
    `INSERT INTO user (externalUserId, username, passwordHash, email, phone, token, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  stmt.run(externalUserId, username, passwordHash, email ?? null, phone ?? null, token, now, now);
  return {
    externalUserId,
    username,
    passwordHash,
    email: email ?? null,
    phone: phone ?? null,
    token,
    createdAt: now,
    updatedAt: now,
  };
}

export function findUserByExternalUserId(externalUserId: string): User | undefined {
  const stmt = getDb().prepare("SELECT * FROM user WHERE externalUserId = ?");
  return stmt.get(externalUserId) as User | undefined;
}

export function findUserByUsername(username: string): User | undefined {
  const stmt = getDb().prepare("SELECT * FROM user WHERE username = ?");
  return stmt.get(username) as User | undefined;
}

export function updateUserToken(externalUserId: string, token: string | null): void {
  const stmt = getDb().prepare("UPDATE user SET token = ?, updatedAt = ? WHERE externalUserId = ?");
  stmt.run(token, new Date().toISOString(), externalUserId);
}

export function findUserByToken(token: string): User | undefined {
  const stmt = getDb().prepare("SELECT * FROM user WHERE token = ?");
  return stmt.get(token) as User | undefined;
}
