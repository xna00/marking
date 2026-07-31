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

// 双向可赋值版 Equal：严格函数版会误判 & 交集类型（{a} & {b} ≠ {a; b}）
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

// ── Table definitions ──

const USER_SQL = `CREATE TABLE IF NOT EXISTS user (
externalUserId TEXT PRIMARY KEY,
username TEXT NOT NULL UNIQUE,
passwordHash TEXT NOT NULL,
email TEXT,
phone TEXT,
token TEXT,
createdAt TEXT NOT NULL,
updatedAt TEXT NOT NULL
)`;
const MARK_RECORD_SQL = `CREATE TABLE IF NOT EXISTS markRecord (
id INTEGER PRIMARY KEY AUTOINCREMENT,
userId TEXT NOT NULL,
costCredits REAL NOT NULL DEFAULT 1.0,
createdAt TEXT NOT NULL,
confirmedAt TEXT
)`;
const CREDIT_TX_SQL = `CREATE TABLE IF NOT EXISTS creditTransaction (
id INTEGER PRIMARY KEY AUTOINCREMENT,
userId TEXT NOT NULL,
amountMoney INTEGER NOT NULL,
amountCredits INTEGER NOT NULL,
description TEXT,
createdAt TEXT NOT NULL
)`;
const KF_CURSOR_SQL = `CREATE TABLE IF NOT EXISTS kfCursor (
openKfId TEXT PRIMARY KEY,
cursor TEXT NOT NULL
)`;

type Tables =
  Schema<typeof USER_SQL>
  & Schema<typeof MARK_RECORD_SQL>
  & Schema<typeof CREDIT_TX_SQL>
  & Schema<typeof KF_CURSOR_SQL>;

// ── Schema tests（完整形状断言）──

type _UserShape = AssertTrue<Equal<Tables['user'], {
  externalUserId: string;
  username: string;
  passwordHash: string;
  email: string | null;
  phone: string | null;
  token: string | null;
  createdAt: string;
  updatedAt: string;
}>>;
type _MarkRecordShape = AssertTrue<Equal<Tables['markRecord'], {
  id: number;
  userId: string;
  costCredits: number;
  createdAt: string;
  confirmedAt: string | null;
}>>;
type _CreditTxShape = AssertTrue<Equal<Tables['creditTransaction'], {
  id: number;
  userId: string;
  amountMoney: number;
  amountCredits: number;
  description: string | null;
  createdAt: string;
}>>;
type _KfCursorShape = AssertTrue<Equal<Tables['kfCursor'], {
  openKfId: string;
  cursor: string;
}>>;

// ── SelectResult ──

type _SrMrkStar = AssertTrue<Equal<
  SelectResult<'SELECT ALL * FROM markRecord WHERE 1=1 GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>,
  Tables['markRecord'][]
>>;

// ── SelectResult (LEFT JOIN) ──

type _SrLeftJoin = AssertTrue<Equal<
  SelectResult<'SELECT ALL user.externalUserId AS userId, markRecord.id AS recordId FROM user LEFT JOIN markRecord ON user.externalUserId = markRecord.userId WHERE 1=1 GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>,
  { userId: string; recordId: number }[]
>>;

// ── SelectResult (SELECT DISTINCT) ──

type _SrDistinct = AssertTrue<Equal<
  SelectResult<'SELECT DISTINCT user.username AS username FROM user WHERE 1=1 GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>,
  { username: string }[]
>>;

// ── SelectResult (mixed aggregate + non-aggregate) ──

type _SrMixedAgg = AssertTrue<Equal<
  SelectResult<'SELECT ALL COUNT(*) AS cnt, user.username AS name FROM user WHERE 1=1 GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>,
  { cnt: number; name: string }[]
>>;

// ── SelectResult (SELECT * with JOIN → intersection) ──

type _SrJoinStar = AssertTrue<Equal<
  SelectResult<'SELECT ALL * FROM user LEFT JOIN kfCursor ON user.externalUserId = kfCursor.openKfId WHERE 1=1 GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>,
  (Tables['user'] & Tables['kfCursor'])[]
>>;

// ── SelectResult (INNER JOIN) ──

type _SrInnerJoin = AssertTrue<Equal<
  SelectResult<'SELECT ALL user.externalUserId AS userId, markRecord.id AS recordId FROM user INNER JOIN markRecord ON user.externalUserId = markRecord.userId WHERE 1=1 GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>,
  { userId: string; recordId: number }[]
>>;

// ── WhereParams ──

type _WpUser = AssertTrue<Equal<
  Params<'SELECT ALL * FROM user WHERE user.externalUserId = @externalUserId GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>,
  { externalUserId: string }
>>;
type _WpNoWhere = AssertTrue<Equal<
  Params<'SELECT ALL * FROM user WHERE 1=1 GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>, {}
>>;
type _WpBoth = AssertTrue<Equal<
  Params<'SELECT ALL * FROM markRecord WHERE markRecord.id = @id AND markRecord.userId = @userId GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>,
  { id: number; userId: string }
>>;

// ── WhereParams (INSERT) ──

type _IpUser = AssertTrue<Equal<
  RunParams<'INSERT INTO user (externalUserId, username, passwordHash, email, phone, token, createdAt, updatedAt) VALUES (@externalUserId, @username, @passwordHash, @email, @phone, @token, @createdAt, @updatedAt)', Tables>,
  {
    externalUserId: string;
    username: string;
    passwordHash: string;
    email: string | null;
    phone: string | null;
    token: string | null;
    createdAt: string;
    updatedAt: string;
  }
>>;
type _IpMrk = AssertTrue<Equal<
  RunParams<'INSERT INTO markRecord (userId, createdAt, costCredits) VALUES (@userId, @createdAt, @costCredits)', Tables>,
  { userId: string; createdAt: string; costCredits: number }
>>;
type _IpCt = AssertTrue<Equal<
  RunParams<'INSERT INTO creditTransaction (userId, amountMoney, amountCredits, description, createdAt) VALUES (@userId, @amountMoney, @amountCredits, @description, @createdAt)', Tables>,
  { userId: string; amountMoney: number; amountCredits: number; description: string | null; createdAt: string }
>>;

// ── WhereParams (UPDATE) ──

type _UpFull = AssertTrue<Equal<
  RunParams<'UPDATE user SET token = @token, updatedAt = @updatedAt WHERE user.externalUserId = @externalUserId', Tables>,
  { token: string | null; updatedAt: string; externalUserId: string }
>>;

// ── WhereParams (DELETE) ──

type _WpDelete = AssertTrue<Equal<
  RunParams<'DELETE FROM markRecord WHERE markRecord.id = @id', Tables>,
  { id: number }
>>;
 
// ── INSERT OR REPLACE ──

type _IorParams = AssertTrue<Equal<
  RunParams<'INSERT OR REPLACE INTO kfCursor (openKfId, cursor) VALUES (@openKfId, @cursor)', Tables>,
  { openKfId: string; cursor: string }
>>;

// ── SqlAllResult ──

type _SarStar = AssertTrue<Equal<
  SqlAllResult<'SELECT ALL * FROM user WHERE user.id = @id GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>,
  Tables['user'][]
>>;
type _SarCol = AssertTrue<Equal<
  SqlAllResult<'SELECT ALL user.email AS email, user.phone AS phone FROM user WHERE 1=1 GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>,
  { email: string | null; phone: string | null }[]
>>;
type _SarAggCount = AssertTrue<Equal<
  SqlAllResult<'SELECT ALL COUNT(*) AS count FROM markRecord WHERE 1=1 GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>,
  { count: number }[]
>>;
type _SarAggTotal = AssertTrue<Equal<
  SqlAllResult<'SELECT ALL SUM(markRecord.costCredits) AS total FROM markRecord WHERE markRecord.userId = @userId GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>,
  { total: number | null }[]
>>;
type _SarDmlNever = AssertTrue<Equal<
  SqlAllResult<'INSERT INTO user (id) VALUES (@id)', Tables>, never
>>;
type _SarUpdateNever = AssertTrue<Equal<
  SqlAllResult<'UPDATE user SET email = @email', Tables>, never
>>;

// ── SqlGetResult ──

type _SgrStar = AssertTrue<Equal<
  SqlGetResult<'SELECT ALL * FROM user WHERE user.id = @id GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>,
  Tables['user'] | undefined
>>;
type _SgrCol = AssertTrue<Equal<
  SqlGetResult<'SELECT ALL user.username AS username FROM user WHERE user.username = @username GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>,
  { username: string } | undefined
>>;
type _SgrColMulti = AssertTrue<Equal<
  SqlGetResult<'SELECT ALL user.email AS email, user.phone AS phone FROM user WHERE 1=1 GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>,
  { email: string | null; phone: string | null } | undefined
>>;
type _SgrAggCount = AssertTrue<Equal<
  SqlGetResult<'SELECT ALL COUNT(*) AS count FROM markRecord WHERE 1=1 GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>,
  { count: number } | undefined
>>;

// ── SqlRunResult ──

type _SrrInsert = AssertTrue<Equal<
  SqlRunResult<'INSERT INTO user (id) VALUES (@id)', Tables>,
  { lastInsertRowid: number; changes: number }
>>;
type _SrrUpdate = AssertTrue<Equal<
  SqlRunResult<'UPDATE user SET user.email = @email WHERE user.id = @id', Tables>,
  { lastInsertRowid: number; changes: number }
>>;
type _SrrDelete = AssertTrue<Equal<
  SqlRunResult<'DELETE FROM user WHERE user.id = @id', Tables>,
  { lastInsertRowid: number; changes: number }
>>;
type _SrrSelectNever = AssertTrue<Equal<
  SqlRunResult<'SELECT ALL * FROM user WHERE 1=1 GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>, never
>>;

// ── TEMP TABLE ──

const TEMP_TABLE_SQL = `CREATE TEMP TABLE IF NOT EXISTS tempLog (
id INTEGER,
msg TEXT
)`;
type TempTables = Schema<typeof TEMP_TABLE_SQL>;
type _TempShape = AssertTrue<Equal<TempTables, { tempLog: { id: number | null; msg: string | null } }>>;

// ── IF NOT EXISTS ──

const IFNOTEXISTS_SQL = `CREATE TABLE IF NOT EXISTS config (
key TEXT PRIMARY KEY,
value TEXT
)`;
type ConfigTable = Schema<typeof IFNOTEXISTS_SQL>;
type _ConfigShape = AssertTrue<Equal<ConfigTable, { config: { key: string; value: string | null } }>>;
type _NegSchemaPlainTable = AssertTrue<Equal<
  Schema<"CREATE TABLE plainTbl (\nid INTEGER\n)">, {}
>>;

// ── Negative tests: invalid SQL → never ──

type _NegSelectNoFrom = AssertTrue<Equal<
  SelectResult<'SELECT ALL * WHERE 1=1 GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>, never
>>;
type _NegDeleteNoWhere = AssertTrue<Equal<RunParams<'DELETE FROM user', Tables>, never>>;
type _NegInsertNoValues = AssertTrue<Equal<RunParams<'INSERT INTO user (x) VALUES', Tables>, never>>;
type _NegUpdateNoSet = AssertTrue<Equal<RunParams<'UPDATE user WHERE id = @id', Tables>, never>>;
type _NegInsertMultiline = AssertTrue<Equal<
  RunParams<'INSERT INTO user (externalUserId, username) VALUES\n(@externalUserId, @username)', Tables>, never
>>;
type _NegInsertNonColParam = AssertTrue<Equal<
  RunParams<'INSERT INTO user (username) VALUES (@foo)', Tables>, {}
>>;
type _NegUpdateSetPrefixed = AssertTrue<Equal<
  RunParams<'UPDATE user SET user.token = @token WHERE user.externalUserId = @externalUserId', Tables>,
  { token: never; externalUserId: string }
>>;
type _PosUpdateArbitraryName = AssertTrue<Equal<
  RunParams<'UPDATE user SET token = @tok WHERE user.externalUserId = @uid', Tables>,
  { tok: string | null; uid: string }
>>;

// ── IN / NOT IN ──

type _WpIn = AssertTrue<Equal<
  Params<'SELECT ALL * FROM markRecord WHERE markRecord.userId IN (@userId, @anotherId) GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>,
  { userId: string; anotherId: string }
>>;
type _WpNotIn = AssertTrue<Equal<
  Params<'SELECT ALL * FROM markRecord WHERE markRecord.id NOT IN (@id1, @id2) GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>,
  { id1: number; id2: number }
>>;
type _WpInMixedAnd = AssertTrue<Equal<
  Params<'SELECT ALL * FROM markRecord WHERE markRecord.userId = @userId AND markRecord.id IN (@id1, @id2) GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>,
  { userId: string; id1: number; id2: number }
>>;

// ── BETWEEN ──

type _WpBetween = AssertTrue<Equal<
  Params<'SELECT ALL * FROM markRecord WHERE markRecord.id BETWEEN @a and @b GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>,
  { a: number; b: number }
>>;
type _WpBetweenStr = AssertTrue<Equal<
  Params<'SELECT ALL * FROM user WHERE user.username BETWEEN @a and @b GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>,
  { a: string; b: string }
>>;
type _WpBetweenMixedAnd = AssertTrue<Equal<
  Params<'SELECT ALL * FROM markRecord WHERE markRecord.userId = @userId AND markRecord.id BETWEEN @a and @b GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>,
  { userId: string; a: number; b: number }
>>;

// ── IS NULL / IS NOT NULL ──

type _WpIsNotNull = AssertTrue<Equal<
  Params<'SELECT ALL * FROM markRecord WHERE markRecord.confirmedAt IS NOT NULL GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>, {}
>>;
type _WpIsNull = AssertTrue<Equal<
  Params<'SELECT ALL * FROM markRecord WHERE markRecord.confirmedAt IS NULL GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>, {}
>>;
type _WpMixedIsNotNull = AssertTrue<Equal<
  Params<'SELECT ALL * FROM markRecord WHERE markRecord.userId = @userId AND markRecord.confirmedAt IS NOT NULL GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>,
  { userId: string }
>>;
type _WpMixedIsNull = AssertTrue<Equal<
  Params<'SELECT ALL * FROM markRecord WHERE markRecord.userId = @userId AND markRecord.confirmedAt IS NULL GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>,
  { userId: string }
>>;

// ── SelectResult（WHERE IS NULL / IS NOT NULL 收窄）──

type _SrStarIsNotNull = AssertTrue<Equal<
  SelectResult<'SELECT ALL * FROM markRecord WHERE markRecord.confirmedAt IS NOT NULL GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>[number]['confirmedAt'], string
>>;
type _SrStarIsNull = AssertTrue<Equal<
  SelectResult<'SELECT ALL * FROM markRecord WHERE markRecord.confirmedAt IS NULL GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>[number]['confirmedAt'], null
>>;
type _SrColIsNotNull = AssertTrue<Equal<
  SelectResult<'SELECT ALL markRecord.confirmedAt AS confirmedAt FROM markRecord WHERE markRecord.confirmedAt IS NOT NULL GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>[number]['confirmedAt'], string
>>;
type _SrColIsNull = AssertTrue<Equal<
  SelectResult<'SELECT ALL markRecord.confirmedAt AS confirmedAt FROM markRecord WHERE markRecord.confirmedAt IS NULL GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>[number]['confirmedAt'], null
>>;
type _SrColOtherRefined = AssertTrue<Equal<
  SelectResult<'SELECT ALL markRecord.id AS id, markRecord.confirmedAt AS confirmedAt FROM markRecord WHERE markRecord.userId = @userId AND markRecord.confirmedAt IS NOT NULL GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>[number]['confirmedAt'], string
>>;

// ── Params (SELECT 参数推导) ──

type _PrNoParams = AssertTrue<Equal<
  Params<'SELECT ALL * FROM user WHERE 1=1 GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>, {}
>>;
type _PrWhereEq = AssertTrue<Equal<
  Params<'SELECT ALL * FROM markRecord WHERE markRecord.id = @id GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>,
  { id: number }
>>;
type _PrWhereAnd = AssertTrue<Equal<
  Params<'SELECT ALL * FROM markRecord WHERE markRecord.id = @id AND markRecord.userId = @userId GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>,
  { id: number; userId: string }
>>;
type _PrWhereMixed = AssertTrue<Equal<
  Params<'SELECT ALL * FROM user WHERE user.externalUserId = @externalUserId GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT @limit OFFSET @offset', Tables>,
  { externalUserId: string; limit: number; offset: number }
>>;
type _PrWhereOr = AssertTrue<Equal<
  Params<'SELECT ALL * FROM user WHERE user.externalUserId = @externalUserId OR user.username = @username GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>,
  { externalUserId: string; username: string }
>>;
type _PrWhereGte = AssertTrue<Equal<
  Params<'SELECT ALL * FROM markRecord WHERE markRecord.id >= @id GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>,
  { id: number }
>>;
type _PrWhereLte = AssertTrue<Equal<
  Params<'SELECT ALL * FROM markRecord WHERE markRecord.id <= @id GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>,
  { id: number }
>>;
type _PrWhereGt = AssertTrue<Equal<
  Params<'SELECT ALL * FROM markRecord WHERE markRecord.id > @id GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>,
  { id: number }
>>;
type _PrWhereLt = AssertTrue<Equal<
  Params<'SELECT ALL * FROM markRecord WHERE markRecord.id < @id GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>,
  { id: number }
>>;
type _PrWhereNe = AssertTrue<Equal<
  Params<'SELECT ALL * FROM markRecord WHERE markRecord.id != @id GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>,
  { id: number }
>>;
type _PrWhereNe2 = AssertTrue<Equal<
  Params<'SELECT ALL * FROM markRecord WHERE markRecord.id <> @id GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>,
  { id: number }
>>;
type _PrLike = AssertTrue<Equal<
  Params<'SELECT ALL * FROM user WHERE user.username LIKE @pattern GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>,
  { pattern: string }
>>;
type _PrNotLike = AssertTrue<Equal<
  Params<'SELECT ALL * FROM user WHERE user.username NOT LIKE @pattern GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>,
  { pattern: string }
>>;
type _PrLikeAnd = AssertTrue<Equal<
  Params<'SELECT ALL * FROM user WHERE user.externalUserId = @externalUserId AND user.username LIKE @pattern GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>,
  { externalUserId: string; pattern: string }
>>;

// ── 短形式（无 GROUP BY/HAVING）──

type _SfStar = AssertTrue<Equal<
  SelectResult<'SELECT ALL * FROM user WHERE user.externalUserId = @externalUserId ORDER BY 1 LIMIT -1 OFFSET 0', Tables>,
  Tables['user'][]
>>;
type _SfStarParams = AssertTrue<Equal<
  Params<'SELECT ALL * FROM user WHERE user.externalUserId = @externalUserId ORDER BY 1 LIMIT -1 OFFSET 0', Tables>,
  { externalUserId: string }
>>;
type _SfAggCount = AssertTrue<Equal<
  SelectResult<'SELECT ALL COUNT(*) AS count FROM markRecord WHERE 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>,
  { count: number }[]
>>;
type _SfIsNotNull = AssertTrue<Equal<
  SelectResult<'SELECT ALL * FROM markRecord WHERE markRecord.confirmedAt IS NOT NULL ORDER BY 1 LIMIT -1 OFFSET 0', Tables>[number]['confirmedAt'],
  string
>>;
type _SfLimitOffset = AssertTrue<Equal<
  Params<'SELECT ALL * FROM user WHERE user.externalUserId = @externalUserId ORDER BY 1 LIMIT @limit OFFSET @offset', Tables>,
  { externalUserId: string; limit: number; offset: number }
>>;

// ── Runtime tests ──

const TEST_TBL_SQL = `CREATE TABLE IF NOT EXISTS testTbl (
id INTEGER PRIMARY KEY,
label TEXT NOT NULL,
val INTEGER
)`;
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
