import {
  type O,
  type Schema,
  type SelectResult, type RunParams, type Params,
  type SqlAllResult, type SqlGetResult, type SqlRunResult,
  TypedDb,
} from './typed-sql.ts';
import { DatabaseSync } from 'node:sqlite';
import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ── Test helpers ──

type AssertTrue<T extends true> = T;
type AssertFalse<T extends false> = T;

// ── Table definitions ──

const USER_SQL = `CREATE TABLE user (
externalUserId TEXT PRIMARY KEY,
username TEXT NOT NULL UNIQUE,
passwordHash TEXT NOT NULL,
email TEXT,
phone TEXT,
token TEXT,
createdAt TEXT NOT NULL,
updatedAt TEXT NOT NULL
)` as const;
const MARK_RECORD_SQL = `CREATE TABLE markRecord (
id INTEGER PRIMARY KEY AUTOINCREMENT,
userId TEXT NOT NULL,
costCredits REAL NOT NULL DEFAULT 1.0,
createdAt TEXT NOT NULL,
confirmedAt TEXT
)` as const;
const CREDIT_TX_SQL = `CREATE TABLE creditTransaction (
id INTEGER PRIMARY KEY AUTOINCREMENT,
userId TEXT NOT NULL,
amountMoney INTEGER NOT NULL,
amountCredits INTEGER NOT NULL,
description TEXT,
createdAt TEXT NOT NULL
)` as const;
const KF_CURSOR_SQL = `CREATE TABLE kfCursor (
openKfId TEXT PRIMARY KEY,
cursor TEXT NOT NULL
)` as const;

type Tables =
  Schema<typeof USER_SQL>
  & Schema<typeof MARK_RECORD_SQL>
  & Schema<typeof CREDIT_TX_SQL>
  & Schema<typeof KF_CURSOR_SQL>;

// ── Schema tests ──

type User = Tables['user'];

type _Ue = AssertTrue<'externalUserId' extends keyof User ? true : false>;
type _Un = AssertTrue<'username' extends keyof User ? true : false>;
type _Up = AssertTrue<'passwordHash' extends keyof User ? true : false>;
type _Ue2 = AssertTrue<'email' extends keyof User ? true : false>;
type _Up2 = AssertTrue<'phone' extends keyof User ? true : false>;
type _Ut = AssertTrue<'token' extends keyof User ? true : false>;
type _Uc = AssertTrue<'createdAt' extends keyof User ? true : false>;
type _Uu = AssertTrue<'updatedAt' extends keyof User ? true : false>;

type _UserExtIdNotNull = AssertFalse<null extends User['externalUserId'] ? true : false>;
type _UserNameNotNull = AssertFalse<null extends User['username'] ? true : false>;
type _EmailNullable   = AssertTrue<null extends User['email'] ? true : false>;

type MarkRecord = Tables['markRecord'];

type _Mi = AssertTrue<'id' extends keyof MarkRecord ? true : false>;
type _Mu = AssertTrue<'userId' extends keyof MarkRecord ? true : false>;
type _Mc = AssertTrue<'costCredits' extends keyof MarkRecord ? true : false>;
type _Mcr = AssertTrue<'createdAt' extends keyof MarkRecord ? true : false>;
type _MCo = AssertTrue<'confirmedAt' extends keyof MarkRecord ? true : false>;

type _MrkConfirmedNull  = AssertTrue<null extends MarkRecord['confirmedAt'] ? true : false>;
type _MrkCreatedAtNull  = AssertFalse<null extends MarkRecord['createdAt'] ? true : false>;

type CreditTx = Tables['creditTransaction'];

type _Cd = AssertTrue<'description' extends keyof CreditTx ? true : false>;
type _Ca = AssertTrue<'amountMoney' extends keyof CreditTx ? true : false>;
type _Cc = AssertTrue<'amountCredits' extends keyof CreditTx ? true : false>;

type _CtDescNull = AssertTrue<null extends CreditTx['description'] ? true : false>;

// ── Tables shape ──

type _TblUser = AssertTrue<'user' extends keyof Tables ? true : false>;
type _TblMrk = AssertTrue<'markRecord' extends keyof Tables ? true : false>;
type _TblCt = AssertTrue<'creditTransaction' extends keyof Tables ? true : false>;
type _TblKf = AssertTrue<'kfCursor' extends keyof Tables ? true : false>;
type _TblConfirmedNull = AssertTrue<null extends Tables['markRecord']['confirmedAt'] ? true : false>;
type _TblDescNull = AssertTrue<null extends Tables['creditTransaction']['description'] ? true : false>;
type _TblCursorType = AssertFalse<null extends Tables['kfCursor']['cursor'] ? true : false>;

// ── SelectResult ──

type _SrUserKey = AssertTrue<'externalUserId' extends keyof SelectResult<'SELECT ALL * FROM user WHERE user.id = @id GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>[number] ? true : false>;
type _SrMrkKey = AssertTrue<  'userId' extends keyof SelectResult<'SELECT ALL * FROM markRecord WHERE 1=1 GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>[number] ? true : false>;
type _SrUserVal = AssertFalse<null extends SelectResult<'SELECT ALL * FROM user WHERE user.id = @id GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>[number]['externalUserId'] ? true : false>;
type _SrMrkNull = AssertTrue<  null extends SelectResult<'SELECT ALL * FROM markRecord WHERE 1=1 GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>[number]['confirmedAt'] ? true : false>;

// ── SelectResult (LEFT JOIN) ──

type _SrLeftJoinKey1 = AssertTrue<
  'userId' extends keyof SelectResult<'SELECT ALL user.externalUserId AS userId, markRecord.id AS recordId FROM user LEFT JOIN markRecord ON user.externalUserId = markRecord.userId WHERE 1=1 GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>[number] ? true : false
>;
type _SrLeftJoinKey2 = AssertTrue<
  'recordId' extends keyof SelectResult<'SELECT ALL user.externalUserId AS userId, markRecord.id AS recordId FROM user LEFT JOIN markRecord ON user.externalUserId = markRecord.userId WHERE 1=1 GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>[number] ? true : false
>;

// ── SelectResult (SELECT DISTINCT) ──

type _SrDistinct = AssertTrue<
  { username: string }[] extends SelectResult<'SELECT DISTINCT user.username AS username FROM user WHERE 1=1 GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables> ? true : false
>;

// ── SelectResult (mixed aggregate + non-aggregate) ──

type _SrMixedAgg = AssertTrue<
  { cnt: number; name: string }[] extends SelectResult<'SELECT ALL COUNT(*) AS cnt, user.username AS name FROM user WHERE 1=1 GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables> ? true : false
>;

// ── SelectResult (SELECT * with JOIN → intersection) ──

type _SrJoinStarKey1 = AssertTrue<
  'externalUserId' extends keyof SelectResult<'SELECT ALL * FROM user LEFT JOIN kfCursor ON user.externalUserId = kfCursor.openKfId WHERE 1=1 GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>[number] ? true : false
>;
type _SrJoinStarKey2 = AssertTrue<
  'openKfId' extends keyof SelectResult<'SELECT ALL * FROM user LEFT JOIN kfCursor ON user.externalUserId = kfCursor.openKfId WHERE 1=1 GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>[number] ? true : false
>;

// ── SelectResult (INNER JOIN) ──

type _SrInnerJoinKey1 = AssertTrue<
  'userId' extends keyof SelectResult<'SELECT ALL user.externalUserId AS userId, markRecord.id AS recordId FROM user INNER JOIN markRecord ON user.externalUserId = markRecord.userId WHERE 1=1 GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>[number] ? true : false
>;
type _SrInnerJoinKey2 = AssertTrue<
  'recordId' extends keyof SelectResult<'SELECT ALL user.externalUserId AS userId, markRecord.id AS recordId FROM user INNER JOIN markRecord ON user.externalUserId = markRecord.userId WHERE 1=1 GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>[number] ? true : false
>;

// ── WhereParams ──

type _WpUser = AssertTrue<
  'externalUserId' extends keyof Params<'SELECT ALL * FROM user WHERE user.externalUserId = @externalUserId GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables> ? true : false
>;
type _WpUserType = AssertFalse<
  null extends Params<'SELECT ALL * FROM user WHERE user.externalUserId = @externalUserId GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>['externalUserId'] ? true : false
>;
type _WpNoWhere = AssertTrue<
  keyof Params<'SELECT ALL * FROM user WHERE 1=1 GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables> extends never ? true : false
>;
type _WpBoth = AssertTrue<
  'id' extends keyof Params<'SELECT ALL * FROM markRecord WHERE markRecord.id = @id AND markRecord.userId = @userId GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables> ? true : false
> & AssertTrue<
  'userId' extends keyof Params<'SELECT ALL * FROM markRecord WHERE markRecord.id = @id AND markRecord.userId = @userId GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables> ? true : false
>;

// ── WhereParams (INSERT) ──

type _IpUser = AssertTrue<
  'externalUserId' extends keyof RunParams<'INSERT INTO user (externalUserId, username, passwordHash, email, phone, token, createdAt, updatedAt) VALUES (@externalUserId, @username, @passwordHash, @email, @phone, @token, @createdAt, @updatedAt)', Tables> ? true : false
>;
type _IpUserType = AssertFalse<
  null extends RunParams<'INSERT INTO user (externalUserId, username, passwordHash, email, phone, token, createdAt, updatedAt) VALUES (@externalUserId, @username, @passwordHash, @email, @phone, @token, @createdAt, @updatedAt)', Tables>['username'] ? true : false
>;
type _IpUserEmail = AssertTrue<
  null extends RunParams<'INSERT INTO user (externalUserId, username, passwordHash, email, phone, token, createdAt, updatedAt) VALUES (@externalUserId, @username, @passwordHash, @email, @phone, @token, @createdAt, @updatedAt)', Tables>['email'] ? true : false
>;
type _IpMrk = AssertTrue<
  'userId' extends keyof RunParams<'INSERT INTO markRecord (userId, createdAt, costCredits) VALUES (@userId, @createdAt, @costCredits)', Tables> ? true : false
>;
type _IpCt = AssertTrue<
  'amountMoney' extends keyof RunParams<'INSERT INTO creditTransaction (userId, amountMoney, amountCredits, description, createdAt) VALUES (@userId, @amountMoney, @amountCredits, @description, @createdAt)', Tables> ? true : false
>;

// ── WhereParams (UPDATE) ──

type _UpToken = AssertTrue<
  'token' extends keyof RunParams<'UPDATE user SET user.token = @token, user.updatedAt = @updatedAt WHERE user.externalUserId = @externalUserId', Tables> ? true : false
>;
type _UpUpdated = AssertTrue<
  'updatedAt' extends keyof RunParams<'UPDATE user SET user.token = @token, user.updatedAt = @updatedAt WHERE user.externalUserId = @externalUserId', Tables> ? true : false
>;
type _UpExtId = AssertTrue<
  'externalUserId' extends keyof RunParams<'UPDATE user SET user.token = @token, user.updatedAt = @updatedAt WHERE user.externalUserId = @externalUserId', Tables> ? true : false
>;
type _UpTokenNullable = AssertTrue<
  null extends RunParams<'UPDATE user SET token = @token WHERE user.externalUserId = @externalUserId', Tables>['token'] ? true : false
>;

const _u: RunParams<'UPDATE user SET email = @email WHERE user.externalUserId = @externalUserId', Tables> = {
  'email': null,
  'externalUserId': 'abc',
};

// ── WhereParams (DELETE) ──

type _WpDelete = AssertTrue<
  'id' extends keyof RunParams<'DELETE FROM user WHERE user.id = @id', Tables> ? true : false
>;
type _WpDeleteType = AssertFalse<
  null extends RunParams<'DELETE FROM user WHERE user.id = @id', Tables>['id'] ? true : false
>;
 
// ── INSERT OR REPLACE ──

type _IorParams = AssertTrue<
  'openKfId' extends keyof RunParams<'INSERT OR REPLACE INTO kfCursor (openKfId, cursor) VALUES (@openKfId, @cursor)', Tables> ? true : false
> & AssertTrue<
  'cursor' extends keyof RunParams<'INSERT OR REPLACE INTO kfCursor (openKfId, cursor) VALUES (@openKfId, @cursor)', Tables> ? true : false
>;

// ── SqlAllResult ──

type _SarStar = AssertTrue<
  Tables['user'][] extends SqlAllResult<'SELECT ALL * FROM user WHERE user.id = @id GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables> ? true : false
>;
type _SarCol = AssertTrue<
  { email: string | null; phone: string | null }[] extends SqlAllResult<'SELECT ALL user.email AS email, user.phone AS phone FROM user WHERE 1=1 GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables> ? true : false
>;
type _SarAggCount = AssertTrue<
  { count: number }[] extends SqlAllResult<'SELECT ALL COUNT(*) AS count FROM markRecord WHERE 1=1 GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables> ? true : false
>;
type _SarAggTotal = AssertTrue<
  { total: number }[] extends SqlAllResult<'SELECT ALL COALESCE(SUM(markRecord.costCredits), 0) AS total FROM markRecord WHERE markRecord.userId = @userId GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables> ? true : false
>;
type _SarDmlNever = AssertTrue<
  SqlAllResult<'INSERT INTO user (id) VALUES (@id)', Tables> extends never ? true : false
>;
type _SarUpdateNever = AssertTrue<
  SqlAllResult<'UPDATE user SET email = @email', Tables> extends never ? true : false
>;

// ── SqlGetResult ──

type _SgrStar = AssertTrue<
  Tables['user'] | undefined extends SqlGetResult<'SELECT ALL * FROM user WHERE user.id = @id GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables> ? true : false
>;
type _SgrCol = AssertTrue<
  { username: string } | undefined extends SqlGetResult<'SELECT ALL user.username AS username FROM user WHERE user.username = @username GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables> ? true : false
>;
type _SgrColMulti = AssertTrue<
  { email: string | null; phone: string | null } | undefined extends SqlGetResult<'SELECT ALL user.email AS email, user.phone AS phone FROM user WHERE 1=1 GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables> ? true : false
>;
type _SgrAggCount = AssertTrue<
  { count: number } | undefined extends SqlGetResult<'SELECT ALL COUNT(*) AS count FROM markRecord WHERE 1=1 GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables> ? true : false
>;

// ── SqlRunResult ──

type _SrrInsert = AssertTrue<
  { lastInsertRowid: number; changes: number } extends SqlRunResult<'INSERT INTO user (id) VALUES (@id)', Tables> ? true : false
>;
type _SrrUpdate = AssertTrue<
  { lastInsertRowid: number; changes: number } extends SqlRunResult<'UPDATE user SET user.email = @email WHERE user.id = @id', Tables> ? true : false
>;
type _SrrDelete = AssertTrue<
  { lastInsertRowid: number; changes: number } extends SqlRunResult<'DELETE FROM user WHERE user.id = @id', Tables> ? true : false
>;
type _SrrSelectNever = AssertTrue<
  SqlRunResult<'SELECT ALL * FROM user WHERE 1=1 GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables> extends never ? true : false
>;

// ── TEMP TABLE ──

const TEMP_TABLE_SQL = `CREATE TEMP TABLE tempLog (
id INTEGER,
msg TEXT
)` as const;
type TempTables = Schema<typeof TEMP_TABLE_SQL>;
type _TempTblName = AssertTrue<'tempLog' extends keyof TempTables ? true : false>;
type _TempTblId = AssertTrue<'id' extends keyof TempTables['tempLog'] ? true : false>;
type _TempTblMsgNull = AssertTrue<null extends TempTables['tempLog']['msg'] ? true : false>;

// ── IF NOT EXISTS ──

const IFNOTEXISTS_SQL = `CREATE TABLE IF NOT EXISTS config (
key TEXT PRIMARY KEY,
value TEXT
)` as const;
type ConfigTable = Schema<typeof IFNOTEXISTS_SQL>;
type _IfNeKey = AssertTrue<'key' extends keyof ConfigTable['config'] ? true : false>;
type _IfNeVal = AssertTrue<'value' extends keyof ConfigTable['config'] ? true : false>;
type _IfNeKeyNotNull = AssertFalse<null extends ConfigTable['config']['key'] ? true : false>;

// ── Negative tests: invalid SQL → never ──

type _NegSelectNoFrom = AssertTrue<
  SelectResult<'SELECT ALL * WHERE 1=1 GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables> extends never ? true : false
>;
type _NegDeleteNoWhere = AssertTrue<
  RunParams<'DELETE FROM user', Tables> extends never ? true : false
>;
type _NegInsertNoValues = AssertTrue<
  RunParams<'INSERT INTO user (x) VALUES', Tables> extends never ? true : false
>;
type _NegUpdateNoSet = AssertTrue<
  RunParams<'UPDATE user WHERE id = @id', Tables> extends never ? true : false
>;
type _NegInsertMultiline = AssertTrue<
  RunParams<'INSERT INTO user (externalUserId, username) VALUES\n(@externalUserId, @username)', Tables> extends never ? true : false
>;

// ── IN / NOT IN ──

type _WpIn = AssertTrue<
  { userId: string; anotherId: string } extends Params<'SELECT ALL * FROM markRecord WHERE markRecord.userId IN (@userId, @anotherId) GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables> ? true : false
>;
type _WpNotIn = AssertTrue<
  { id1: number; id2: number } extends Params<'SELECT ALL * FROM markRecord WHERE markRecord.id NOT IN (@id1, @id2) GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables> ? true : false
>;
type _WpInMixedAnd = AssertTrue<
  { userId: string; id1: number; id2: number } extends Params<'SELECT ALL * FROM markRecord WHERE markRecord.userId = @userId AND markRecord.id IN (@id1, @id2) GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables> ? true : false
>;

// ── BETWEEN ──

type _WpBetween = AssertTrue<
  { a: number; b: number } extends Params<'SELECT ALL * FROM markRecord WHERE markRecord.id BETWEEN @a and @b GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables> ? true : false
>;
type _WpBetweenStr = AssertTrue<
  { a: string; b: string } extends Params<'SELECT ALL * FROM user WHERE user.username BETWEEN @a and @b GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables> ? true : false
>;
type _WpBetweenMixedAnd = AssertTrue<
  { userId: string; a: number; b: number } extends Params<'SELECT ALL * FROM markRecord WHERE markRecord.userId = @userId AND markRecord.id BETWEEN @a and @b GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables> ? true : false
>;

// ── IS NULL / IS NOT NULL ──

type _WpIsNotNull = AssertTrue<
  keyof Params<'SELECT ALL * FROM markRecord WHERE markRecord.confirmedAt IS NOT NULL GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables> extends never ? true : false
>;
type _WpIsNull = AssertTrue<
  keyof Params<'SELECT ALL * FROM markRecord WHERE markRecord.confirmedAt IS NULL GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables> extends never ? true : false
>;
type _WpIsNotNullThenParam = AssertTrue<
  'userId' extends keyof Params<'SELECT ALL * FROM markRecord WHERE markRecord.confirmedAt IS NOT NULL AND markRecord.userId = @userId GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables> ? true : false
>;

type _WpMixedIsNotNull = AssertTrue<
  { userId: string } extends Params<'SELECT ALL * FROM markRecord WHERE markRecord.userId = @userId AND markRecord.confirmedAt IS NOT NULL GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables> ? true : false
>;
type _WpMixedIsNull = AssertTrue<
  { userId: string } extends Params<'SELECT ALL * FROM markRecord WHERE markRecord.userId = @userId AND markRecord.confirmedAt IS NULL GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables> ? true : false
>;

// ── Params (SELECT 参数推导) ──

type _PrNoParams = AssertTrue<
  {} extends Params<'SELECT ALL * FROM user WHERE 1=1 GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables> ? true : false
>;
type _PrWhereEq = AssertTrue<
  { id: number } extends Params<'SELECT ALL * FROM markRecord WHERE markRecord.id = @id GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables> ? true : false
>;
type _PrWhereAnd = AssertTrue<
  { id: number; userId: string } extends Params<'SELECT ALL * FROM markRecord WHERE markRecord.id = @id AND markRecord.userId = @userId GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables> ? true : false
>;
type _PrWhereMixed = AssertTrue<
  { externalUserId: string; limit: number; offset: number } extends Params<'SELECT ALL * FROM user WHERE user.externalUserId = @externalUserId GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT @limit OFFSET @offset', Tables> ? true : false
>;
type _PrWhereOr = AssertTrue<
  { externalUserId: string; username: string } extends Params<'SELECT ALL * FROM user WHERE user.externalUserId = @externalUserId OR user.username = @username GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables> ? true : false
>;
type _PrWhereGte = AssertTrue<
  { id: number } extends Params<'SELECT ALL * FROM markRecord WHERE markRecord.id >= @id GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables> ? true : false
>;
type _PrWhereLte = AssertTrue<
  { id: number } extends Params<'SELECT ALL * FROM markRecord WHERE markRecord.id <= @id GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables> ? true : false
>;
type _PrWhereGt = AssertTrue<
  { id: number } extends Params<'SELECT ALL * FROM markRecord WHERE markRecord.id > @id GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables> ? true : false
>;
type _PrWhereLt = AssertTrue<
  { id: number } extends Params<'SELECT ALL * FROM markRecord WHERE markRecord.id < @id GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables> ? true : false
>;
type _PrWhereNe = AssertTrue<
  { id: number } extends Params<'SELECT ALL * FROM markRecord WHERE markRecord.id != @id GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables> ? true : false
>;
type _PrWhereNe2 = AssertTrue<
  { id: number } extends Params<'SELECT ALL * FROM markRecord WHERE markRecord.id <> @id GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables> ? true : false
>;

// ── Runtime tests ──

const TEST_TBL_SQL = `CREATE TABLE testTbl (
id INTEGER PRIMARY KEY,
label TEXT NOT NULL,
val INTEGER
)` as const;
type TestTables = Schema<typeof TEST_TBL_SQL>;

describe('TypedDb', () => {
  let db: DatabaseSync;
  let typedDb: TypedDb<TestTables>;

  before(() => {
    db = new DatabaseSync(':memory:');
    db.exec(TEST_TBL_SQL);
    typedDb = new TypedDb<TestTables>(db);
  });

  describe('INSERT', () => {
    beforeEach(() => { db.exec("DELETE FROM testTbl"); });

    it('returns lastInsertRowid and changes', () => {
      const r = typedDb.prepare("INSERT INTO testTbl (label, val) VALUES (@label, @val)").run({ label: 'a', val: 1 });
      assert.equal(typeof r.lastInsertRowid, 'number');
      assert.equal(r.changes, 1);
    });

    it('INSERT OR REPLACE replaces existing row', () => {
      typedDb.prepare("INSERT INTO testTbl (id, label, val) VALUES (@id, @label, @val)").run({ id: 1, label: 'x', val: 10 });
      const r = typedDb.prepare("INSERT OR REPLACE INTO testTbl (id, label, val) VALUES (@id, @label, @val)").run({ id: 1, label: 'b', val: 2 });
      assert.equal(r.changes, 1);
    });
  });

  describe('UPDATE', () => {
    beforeEach(() => {
      db.exec("DELETE FROM testTbl");
      typedDb.prepare("INSERT INTO testTbl (id, label, val) VALUES (@id, @label, @val)").run({ id: 1, label: 'x', val: 10 });
    });

    it('returns changes', () => {
      const r = typedDb.prepare("UPDATE testTbl SET label = @label WHERE testTbl.id = @id").run({ label: 'c', id: 1 });
      assert.equal(r.changes, 1);
    });
  });

  describe('DELETE', () => {
    beforeEach(() => {
      db.exec("DELETE FROM testTbl");
      typedDb.prepare("INSERT INTO testTbl (id, label, val) VALUES (@id, @label, @val)").run({ id: 1, label: 'x', val: 10 });
    });

    it('returns changes', () => {
      const r = typedDb.prepare("DELETE FROM testTbl WHERE id = @id").run({ id: 1 });
      assert.equal(r.changes, 1);
    });
  });

  describe('SELECT', () => {
    before(() => {
      db.exec("DELETE FROM testTbl");
      typedDb.prepare("INSERT INTO testTbl (id, label, val) VALUES (@id, @label, @val)").run({ id: 1, label: 'hello', val: 42 });
    });

    it('all returns correct rows', () => {
      const rows = typedDb.prepare("SELECT ALL * FROM testTbl WHERE id = @id GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0").all({ id: 1 });
      assert.equal(rows.length, 1);
      assert.equal(rows[0].id, 1);
      assert.equal(rows[0].label, 'hello');
      assert.equal(rows[0].val, 42);
    });

    it('all returns empty for no match', () => {
      const rows = typedDb.prepare("SELECT ALL * FROM testTbl WHERE id = @id GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0").all({ id: 999 });
      assert.equal(rows.length, 0);
    });

    it('get returns single row', () => {
      const row = typedDb.prepare("SELECT ALL * FROM testTbl WHERE id = @id GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0").get({ id: 1 })!;
      assert.equal(row.id, 1);
      assert.equal(row.label, 'hello');
      assert.equal(row.val, 42);
    });

    it('get returns undefined for no match', () => {
      const row = typedDb.prepare("SELECT ALL * FROM testTbl WHERE id = @id GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0").get({ id: 999 });
      assert.equal(row, undefined);
    });

    it('all with column select returns subset', () => {
      const rows = typedDb.prepare("SELECT ALL label AS label, val AS val FROM testTbl WHERE 1=1 GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0").all({});
      assert.equal(rows.length, 1);
      assert.equal(rows[0].label, 'hello');
      assert.equal(rows[0].val, 42);
    });

    it('get with column select returns subset', () => {
      const row = typedDb.prepare("SELECT ALL label AS label FROM testTbl WHERE id = @id GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0").get({ id: 1 })!;
      assert.equal(row.label, 'hello');
    });
  });
});
