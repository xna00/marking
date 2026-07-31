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

type _UserExtIdNotNull = AssertTrue<Equal<User['externalUserId'], string>>;
type _UserNameNotNull = AssertTrue<Equal<User['username'], string>>;
type _EmailNullable   = AssertTrue<Equal<User['email'], string | null>>;

type MarkRecord = Tables['markRecord'];

type _Mi = AssertTrue<'id' extends keyof MarkRecord ? true : false>;
type _Mu = AssertTrue<'userId' extends keyof MarkRecord ? true : false>;
type _Mc = AssertTrue<'costCredits' extends keyof MarkRecord ? true : false>;
type _Mcr = AssertTrue<'createdAt' extends keyof MarkRecord ? true : false>;
type _MCo = AssertTrue<'confirmedAt' extends keyof MarkRecord ? true : false>;

type _MrkConfirmedNull  = AssertTrue<Equal<MarkRecord['confirmedAt'], string | null>>;
type _MrkCreatedAtNull  = AssertTrue<Equal<MarkRecord['createdAt'], string>>;

type CreditTx = Tables['creditTransaction'];

type _Cd = AssertTrue<'description' extends keyof CreditTx ? true : false>;
type _Ca = AssertTrue<'amountMoney' extends keyof CreditTx ? true : false>;
type _Cc = AssertTrue<'amountCredits' extends keyof CreditTx ? true : false>;

type _CtDescNull = AssertTrue<Equal<CreditTx['description'], string | null>>;

// ── Tables shape ──

type _TblUser = AssertTrue<'user' extends keyof Tables ? true : false>;
type _TblMrk = AssertTrue<'markRecord' extends keyof Tables ? true : false>;
type _TblCt = AssertTrue<'creditTransaction' extends keyof Tables ? true : false>;
type _TblKf = AssertTrue<'kfCursor' extends keyof Tables ? true : false>;
type _TblConfirmedNull = AssertTrue<Equal<Tables['markRecord']['confirmedAt'], string | null>>;
type _TblDescNull = AssertTrue<Equal<Tables['creditTransaction']['description'], string | null>>;
type _TblCursorType = AssertTrue<Equal<Tables['kfCursor']['cursor'], string>>;

// ── SelectResult ──

type _SrUserKey = AssertTrue<'externalUserId' extends keyof SelectResult<'SELECT ALL * FROM user WHERE user.id = @id GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>[number] ? true : false>;
type _SrMrkKey = AssertTrue<  'userId' extends keyof SelectResult<'SELECT ALL * FROM markRecord WHERE 1=1 GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>[number] ? true : false>;
type _SrUserVal = AssertTrue<Equal<SelectResult<'SELECT ALL * FROM user WHERE user.id = @id GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>[number]['externalUserId'], string>>;
type _SrMrkNull = AssertTrue<Equal<SelectResult<'SELECT ALL * FROM markRecord WHERE 1=1 GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>[number]['confirmedAt'], string | null>>;

// ── SelectResult (LEFT JOIN) ──

type _SrLeftJoinKey1 = AssertTrue<
  'userId' extends keyof SelectResult<'SELECT ALL user.externalUserId AS userId, markRecord.id AS recordId FROM user LEFT JOIN markRecord ON user.externalUserId = markRecord.userId WHERE 1=1 GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>[number] ? true : false
>;
type _SrLeftJoinKey2 = AssertTrue<
  'recordId' extends keyof SelectResult<'SELECT ALL user.externalUserId AS userId, markRecord.id AS recordId FROM user LEFT JOIN markRecord ON user.externalUserId = markRecord.userId WHERE 1=1 GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>[number] ? true : false
>;

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
type _WpUserType = AssertTrue<Equal<
  Params<'SELECT ALL * FROM user WHERE user.externalUserId = @externalUserId GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>['externalUserId'], string
>>;
type _WpNoWhere = AssertTrue<Equal<
  Params<'SELECT ALL * FROM user WHERE 1=1 GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables>, {}
>>;
type _WpBoth = AssertTrue<
  'id' extends keyof Params<'SELECT ALL * FROM markRecord WHERE markRecord.id = @id AND markRecord.userId = @userId GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables> ? true : false
> & AssertTrue<
  'userId' extends keyof Params<'SELECT ALL * FROM markRecord WHERE markRecord.id = @id AND markRecord.userId = @userId GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables> ? true : false
>;

// ── WhereParams (INSERT) ──

type _IpUser = AssertTrue<
  'externalUserId' extends keyof RunParams<'INSERT INTO user (externalUserId, username, passwordHash, email, phone, token, createdAt, updatedAt) VALUES (@externalUserId, @username, @passwordHash, @email, @phone, @token, @createdAt, @updatedAt)', Tables> ? true : false
>;
type _IpUserType = AssertTrue<Equal<
  RunParams<'INSERT INTO user (externalUserId, username, passwordHash, email, phone, token, createdAt, updatedAt) VALUES (@externalUserId, @username, @passwordHash, @email, @phone, @token, @createdAt, @updatedAt)', Tables>['username'], string
>>;
type _IpUserEmail = AssertTrue<Equal<
  RunParams<'INSERT INTO user (externalUserId, username, passwordHash, email, phone, token, createdAt, updatedAt) VALUES (@externalUserId, @username, @passwordHash, @email, @phone, @token, @createdAt, @updatedAt)', Tables>['email'], string | null
>>;
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
type _UpTokenNullable = AssertTrue<Equal<
  RunParams<'UPDATE user SET token = @token WHERE user.externalUserId = @externalUserId', Tables>['token'], string | null
>>;

const _u: RunParams<'UPDATE user SET email = @email WHERE user.externalUserId = @externalUserId', Tables> = {
  'email': null,
  'externalUserId': 'abc',
};

// ── WhereParams (DELETE) ──

type _WpDelete = AssertTrue<
  'id' extends keyof RunParams<'DELETE FROM markRecord WHERE markRecord.id = @id', Tables> ? true : false
>;
type _WpDeleteType = AssertTrue<Equal<
  RunParams<'DELETE FROM markRecord WHERE markRecord.id = @id', Tables>['id'], number
>>;
 
// ── INSERT OR REPLACE ──

type _IorParams = AssertTrue<
  'openKfId' extends keyof RunParams<'INSERT OR REPLACE INTO kfCursor (openKfId, cursor) VALUES (@openKfId, @cursor)', Tables> ? true : false
> & AssertTrue<
  'cursor' extends keyof RunParams<'INSERT OR REPLACE INTO kfCursor (openKfId, cursor) VALUES (@openKfId, @cursor)', Tables> ? true : false
>;

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

const TEMP_TABLE_SQL = `CREATE TEMP TABLE tempLog (
id INTEGER,
msg TEXT
)` as const;
type TempTables = Schema<typeof TEMP_TABLE_SQL>;
type _TempTblName = AssertTrue<'tempLog' extends keyof TempTables ? true : false>;
type _TempTblId = AssertTrue<'id' extends keyof TempTables['tempLog'] ? true : false>;
type _TempTblMsgNull = AssertTrue<Equal<TempTables['tempLog']['msg'], string | null>>;

// ── IF NOT EXISTS ──

const IFNOTEXISTS_SQL = `CREATE TABLE IF NOT EXISTS config (
key TEXT PRIMARY KEY,
value TEXT
)` as const;
type ConfigTable = Schema<typeof IFNOTEXISTS_SQL>;
type _IfNeKey = AssertTrue<'key' extends keyof ConfigTable['config'] ? true : false>;
type _IfNeVal = AssertTrue<'value' extends keyof ConfigTable['config'] ? true : false>;
type _IfNeKeyNotNull = AssertTrue<Equal<ConfigTable['config']['key'], string>>;

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
type _WpIsNotNullThenParam = AssertTrue<
  'userId' extends keyof Params<'SELECT ALL * FROM markRecord WHERE markRecord.confirmedAt IS NOT NULL AND markRecord.userId = @userId GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0', Tables> ? true : false
>;

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
