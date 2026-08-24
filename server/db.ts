import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { TypedDb, type ResolveFks, type SchemaFks } from "./typed-sql/typed-sql.ts";

const KF_CURSOR_SQL = `CREATE TABLE IF NOT EXISTS kfCursor (
openKfId   TEXT PRIMARY KEY,
cursor     TEXT NOT NULL
)`;
const USER_SQL = `CREATE TABLE IF NOT EXISTS user (
externalUserId TEXT PRIMARY KEY,
username       TEXT NOT NULL UNIQUE,
passwordHash   TEXT NOT NULL,
email          TEXT,
phone          TEXT,
token          TEXT,
createdAt      TEXT NOT NULL,
updatedAt      TEXT NOT NULL
)`;

const MARK_RECORD_SQL = `CREATE TABLE IF NOT EXISTS markRecord (
id          INTEGER PRIMARY KEY AUTOINCREMENT,
userId      TEXT NOT NULL REFERENCES user(externalUserId),
costCredits REAL NOT NULL DEFAULT 1.0,
createdAt   TEXT NOT NULL,
confirmedAt TEXT
)`;
const CREDIT_TX_SQL = `CREATE TABLE IF NOT EXISTS creditTransaction (
id             INTEGER PRIMARY KEY AUTOINCREMENT,
userId         TEXT NOT NULL REFERENCES user(externalUserId),
amountMoney    INTEGER NOT NULL,
amountCredits  INTEGER NOT NULL,
description    TEXT,
orderNo        TEXT,
payMethod      TEXT,
createdAt      TEXT NOT NULL
)`;
const MARK_LOG_SQL = `CREATE TABLE IF NOT EXISTS markLog (
id             INTEGER PRIMARY KEY AUTOINCREMENT,
markRecordId   INTEGER NOT NULL,
userId         TEXT NOT NULL,
model          TEXT NOT NULL,
criteriaConfig TEXT NOT NULL,
imageFilename  TEXT NOT NULL,
result         TEXT NOT NULL,
createdAt      TEXT NOT NULL
)`;

type MarkingDb = ResolveFks<SchemaFks<typeof KF_CURSOR_SQL> & SchemaFks<typeof USER_SQL> & SchemaFks<typeof MARK_RECORD_SQL> & SchemaFks<typeof CREDIT_TX_SQL> & SchemaFks<typeof MARK_LOG_SQL>>;

const DB_PATH = join(process.cwd(), "data", "marking.db");

let rawDb: DatabaseSync | null = null;
let typedDb: TypedDb<MarkingDb> | null = null;

export function _useDb(db: DatabaseSync): void {
  rawDb = db;
  typedDb = new TypedDb<MarkingDb>(db);
}

function getRawDb(): DatabaseSync {
  if (!rawDb) {
    mkdirSync(join(process.cwd(), "data"), { recursive: true });
    rawDb = new DatabaseSync(DB_PATH);
  }
  return rawDb;
}

function td(): TypedDb<MarkingDb> {
  if (!typedDb) {
    typedDb = new TypedDb<MarkingDb>(getRawDb());
  }
  return typedDb;
}

export function initDb(): void {
  const d = getRawDb();
  d.exec(KF_CURSOR_SQL);
  d.exec(USER_SQL);
  d.exec(MARK_RECORD_SQL);
  d.exec(CREDIT_TX_SQL);
  d.exec(MARK_LOG_SQL);
}

export function insertMarkRecord(userId: string, costCredits: number): number {
  const stmt = td().prepare("INSERT OR ABORT INTO markRecord (userId, createdAt, costCredits) VALUES (@userId, @createdAt, @costCredits)");
  const result = stmt.run({ userId, createdAt: new Date().toISOString(), costCredits });
  return Number(result.lastInsertRowid);
}

export function insertMarkLog(userId: string, model: string, criteriaConfig: string, imageFilename: string, result: string, markRecordId: number): void {
  const stmt = td().prepare("INSERT OR ABORT INTO markLog (markRecordId, userId, model, criteriaConfig, imageFilename, result, createdAt) VALUES (@markRecordId, @userId, @model, @criteriaConfig, @imageFilename, @result, @createdAt)");
  stmt.run({ markRecordId, userId, model, criteriaConfig, imageFilename, result, createdAt: new Date().toISOString() });
}

export function getMarkLogs(limit = 50, offset = 0) {
  const stmt = td().prepare("SELECT ALL * FROM markLog WHERE 1=1 ORDER BY createdAt DESC, id DESC LIMIT @limit OFFSET @offset");
  return stmt.all({ limit, offset });
}

export function countConfirmedRecords(userId: string): number {
  const stmt = td().prepare("SELECT ALL COUNT(*) AS count FROM markRecord WHERE markRecord.userId = @userId AND markRecord.confirmedAt IS NOT NULL ORDER BY 1 LIMIT -1 OFFSET 0");
  return stmt.get({ userId })?.count ?? 0;
}

export function sumConsumedCredits(userId: string): number {
  const stmt = td().prepare(
    "SELECT ALL SUM(markRecord.costCredits) AS total FROM markRecord WHERE markRecord.userId = @userId AND markRecord.confirmedAt IS NOT NULL ORDER BY 1 LIMIT -1 OFFSET 0"
  );
  return stmt.get({ userId })?.total ?? 0;
}

export function sumCredits(userId: string): number {
  const stmt = td().prepare(
    "SELECT ALL SUM(creditTransaction.amountCredits) AS total FROM creditTransaction WHERE creditTransaction.userId = @userId ORDER BY 1 LIMIT -1 OFFSET 0"
  );
  return stmt.get({ userId })?.total ?? 0;
}

export function getTransactions(userId: string): { id: number; amountMoney: number; amountCredits: number; description: string | null; createdAt: string }[] {
  const stmt = td().prepare(
    "SELECT ALL creditTransaction.id AS id, creditTransaction.amountMoney AS amountMoney, creditTransaction.amountCredits AS amountCredits, creditTransaction.description AS description, creditTransaction.createdAt AS createdAt FROM creditTransaction WHERE creditTransaction.userId = @userId ORDER BY createdAt DESC, id DESC LIMIT 50 OFFSET 0"
  );
  return stmt.all({ userId });
}

export function getUsageHistory(userId: string): { id: number; createdAt: string; confirmedAt: string; costCredits: number }[] {
  const stmt = td().prepare(
    "SELECT ALL markRecord.id AS id, markRecord.createdAt AS createdAt, markRecord.confirmedAt AS confirmedAt, markRecord.costCredits AS costCredits FROM markRecord WHERE markRecord.userId = @userId AND markRecord.confirmedAt IS NOT NULL ORDER BY createdAt DESC, id DESC LIMIT 50 OFFSET 0"
  );
  return stmt.all({ userId });
}

export function confirmMarkRecord(id: number, userId: string): boolean {
  const stmt = td().prepare("UPDATE OR ABORT markRecord SET confirmedAt = @confirmedAt WHERE markRecord.id = @id AND markRecord.userId = @userId");
  const result = stmt.run({ confirmedAt: new Date().toISOString(), id, userId });
  return result.changes > 0;
}

export function loadCursor(openKfId: string): string | null {
  const stmt = td().prepare("SELECT ALL kfCursor.cursor AS cursor FROM kfCursor WHERE kfCursor.openKfId = @openKfId ORDER BY 1 LIMIT -1 OFFSET 0");
  const row = stmt.get({ openKfId });
  return row?.cursor ?? null;
}

export function saveCursor(openKfId: string, cursor: string): void {
  const stmt = td().prepare("INSERT OR REPLACE INTO kfCursor (openKfId, cursor) VALUES (@openKfId, @cursor)");
  stmt.run({ openKfId, cursor });
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
  const stmt = td().prepare(
    "INSERT OR ABORT INTO user (externalUserId, username, passwordHash, email, phone, token, createdAt, updatedAt) VALUES (@externalUserId, @username, @passwordHash, @email, @phone, @token, @createdAt, @updatedAt)"
  );
  stmt.run({
    externalUserId,
    username,
    passwordHash,
    email: email ?? null,
    phone: phone ?? null,
    token,
    createdAt: now,
    updatedAt: now,
  });
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
  const stmt = td().prepare("SELECT ALL * FROM user WHERE user.externalUserId = @externalUserId ORDER BY 1 LIMIT -1 OFFSET 0");
  return stmt.get({ externalUserId });
}

export function findUserByUsername(username: string): User | undefined {
  const stmt = td().prepare("SELECT ALL * FROM user WHERE user.username = @username ORDER BY 1 LIMIT -1 OFFSET 0");
  return stmt.get({ username });
}

export function insertCreditTransaction(
  userId: string,
  amountMoney: number,
  amountCredits: number,
  description?: string,
  orderNo?: string,
  payMethod?: string,
): void {
  const stmt = td().prepare(
    "INSERT OR ABORT INTO creditTransaction (userId, amountMoney, amountCredits, description, orderNo, payMethod, createdAt) VALUES (@userId, @amountMoney, @amountCredits, @description, @orderNo, @payMethod, @createdAt)"
  );
  stmt.run({ userId, amountMoney, amountCredits, description: description ?? null, orderNo: orderNo ?? null, payMethod: payMethod ?? null, createdAt: new Date().toISOString() });
}

export function updateUserToken(externalUserId: string, token: string | null): void {
  const stmt = td().prepare("UPDATE OR ABORT user SET token = @token, updatedAt = @updatedAt WHERE user.externalUserId = @externalUserId");
  stmt.run({ token, updatedAt: new Date().toISOString(), externalUserId });
}

export function findUserByToken(token: string): User | undefined {
  const stmt = td().prepare("SELECT ALL * FROM user WHERE user.token = @token ORDER BY 1 LIMIT -1 OFFSET 0");
  return stmt.get({ token });
}
