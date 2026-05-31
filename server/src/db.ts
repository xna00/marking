import { DatabaseSync } from "node:sqlite";
import { randomBytes, scryptSync, randomUUID } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, "..", "marking.db");

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode=WAL");
db.exec(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  passwordHash TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  token TEXT UNIQUE NOT NULL,
  quota INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL
)`);
db.exec(`CREATE TABLE IF NOT EXISTS usageLogs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  createdAt TEXT NOT NULL
)`);
db.exec(`CREATE TABLE IF NOT EXISTS rechargeLogs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  amount REAL NOT NULL,
  quota INTEGER NOT NULL,
  createdAt TEXT NOT NULL
)`);

const FREE_QUOTA = 0;

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  return scryptSync(password, salt, 64).toString("hex") === hash;
}

export type User = {
  id: number;
  username: string;
  email: string | null;
  phone: string | null;
  token: string;
  quota: number;
  createdAt: string;
};

export type UserUsage = {
  remainingQuota: number;
  totalUsed: number;
  todayUsed: number;
};

export function createUser(
  username: string,
  password: string,
  email?: string,
  phone?: string,
): User {
  const existing = db
    .prepare("SELECT id FROM users WHERE username = ?")
    .get(username);
  if (existing) {
    throw new Error("用户名已存在");
  }

  const token = randomUUID();
  const passwordHash = hashPassword(password);
  const now = new Date().toISOString();
  const stmt = db.prepare(
    "INSERT INTO users (username, passwordHash, email, phone, token, quota, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  stmt.run(username, passwordHash, email ?? null, phone ?? null, token, FREE_QUOTA, now);

  return db
    .prepare("SELECT id, username, email, phone, token, quota, createdAt FROM users WHERE username = ?")
    .get(username) as User;
}

export function findUserByUsername(username: string): User | undefined {
  return db
    .prepare("SELECT id, username, email, phone, token, quota, createdAt FROM users WHERE username = ?")
    .get(username) as User | undefined;
}

export function findUserByToken(token: string): User | undefined {
  return db
    .prepare("SELECT id, username, email, phone, token, quota, createdAt FROM users WHERE token = ?")
    .get(token) as User | undefined;
}

export function verifyLogin(
  username: string,
  password: string,
): User | null {
  const row = db
    .prepare("SELECT id, username, passwordHash, email, phone, token, quota, createdAt FROM users WHERE username = ? OR email = ?")
    .get(username, username) as (User & { passwordHash: string }) | undefined;
  if (!row) return null;
  if (!verifyPassword(password, row.passwordHash)) return null;
  const { passwordHash: _, ...user } = row;
  return user;
}

export function checkAndDeductQuota(userId: number): boolean {
  const user = db
    .prepare("SELECT quota FROM users WHERE id = ?")
    .get(userId) as { quota: number } | undefined;
  if (!user || user.quota <= 0) return false;
  db.prepare("UPDATE users SET quota = quota - 1 WHERE id = ?").run(userId);
  const now = new Date().toISOString();
  db.prepare("INSERT INTO usageLogs (userId, createdAt) VALUES (?, ?)").run(userId, now);
  return true;
}

export function rechargeQuota(userId: number, amount: number, quota: number): void {
  const now = new Date().toISOString();
  db.prepare("UPDATE users SET quota = quota + ? WHERE id = ?").run(quota, userId);
  db.prepare("INSERT INTO rechargeLogs (userId, amount, quota, createdAt) VALUES (?, ?, ?, ?)")
    .run(userId, amount, quota, now);
}

export function getUserUsage(userId: number): UserUsage {
  const user = db
    .prepare("SELECT quota FROM users WHERE id = ?")
    .get(userId) as { quota: number } | undefined;
  const totalRow = db
    .prepare("SELECT COUNT(*) as count FROM usageLogs WHERE userId = ?")
    .get(userId) as { count: number };
  const todayRow = db
    .prepare(
      "SELECT COUNT(*) as count FROM usageLogs WHERE userId = ? AND date(createdAt) = date('now')",
    )
    .get(userId) as { count: number };
  return {
    remainingQuota: user?.quota ?? 0,
    totalUsed: totalRow.count,
    todayUsed: todayRow.count,
  };
}
