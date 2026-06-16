import {
  type O,
  type Schema,
  type ParseTableName, type SelectResult, type WhereParams,
  type SqlAllResult, type SqlGetResult, type SqlRunResult,
  TypedDb,
} from './types-sql.ts';

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

// ── ParseTableName ──

type _PtnUser = AssertTrue<
  'user' extends ParseTableName<'SELECT * FROM user AS u WHERE u.id = @id'> ? true : false
>;
type _PtnMarkRecord = AssertTrue<
  'markRecord' extends ParseTableName<'SELECT * FROM markRecord AS mr WHERE mr.userId = @userId'> ? true : false
>;
type _PtnNoWhere = AssertTrue<
  'creditTransaction' extends ParseTableName<'SELECT * FROM creditTransaction AS ct WHERE 1=1 '> ? true : false
>;

// ── SelectResult ──

type _SrUserKey = AssertTrue<'externalUserId' extends keyof SelectResult<'SELECT * FROM user AS u WHERE u.id = @id', Tables>[number] ? true : false>;
type _SrMrkKey = AssertTrue<  'userId' extends keyof SelectResult<'SELECT * FROM markRecord AS mr WHERE 1=1 ', Tables>[number] ? true : false>;
type _SrUserVal = AssertFalse<null extends SelectResult<'SELECT * FROM user AS u WHERE u.id = @id', Tables>[number]['externalUserId'] ? true : false>;
type _SrMrkNull = AssertTrue<  null extends SelectResult<'SELECT * FROM markRecord AS mr WHERE 1=1 ', Tables>[number]['confirmedAt'] ? true : false>;

// ── SelectResult (LEFT JOIN) ──

type _SrLeftJoinKey1 = AssertTrue<
  'userId' extends keyof SelectResult<'SELECT u.externalUserId AS userId, mr.id AS recordId FROM user AS u LEFT JOIN markRecord AS mr ON u.externalUserId = mr.userId WHERE 1=1', Tables>[number] ? true : false
>;
type _SrLeftJoinKey2 = AssertTrue<
  'recordId' extends keyof SelectResult<'SELECT u.externalUserId AS userId, mr.id AS recordId FROM user AS u LEFT JOIN markRecord AS mr ON u.externalUserId = mr.userId WHERE 1=1', Tables>[number] ? true : false
>;

// ── SelectResult (SELECT DISTINCT) ──

type _SrDistinct = AssertTrue<
  { username: string }[] extends SelectResult<'SELECT DISTINCT u.username AS username FROM user AS u WHERE 1=1 ', Tables> ? true : false
>;

// ── SelectResult (mixed aggregate + non-aggregate) ──

type _SrMixedAgg = AssertTrue<
  { cnt: number; name: string }[] extends SelectResult<'SELECT COUNT(*) AS cnt, u.username AS name FROM user AS u WHERE 1=1 ', Tables> ? true : false
>;

// ── SelectResult (SELECT * with JOIN → intersection) ──

type _SrJoinStarKey1 = AssertTrue<
  'externalUserId' extends keyof SelectResult<'SELECT * FROM user AS u LEFT JOIN kfCursor AS k ON u.externalUserId = k.openKfId WHERE 1=1 ', Tables>[number] ? true : false
>;
type _SrJoinStarKey2 = AssertTrue<
  'openKfId' extends keyof SelectResult<'SELECT * FROM user AS u LEFT JOIN kfCursor AS k ON u.externalUserId = k.openKfId WHERE 1=1 ', Tables>[number] ? true : false
>;

// ── WhereParams ──

type _WpUser = AssertTrue<
  'externalUserId' extends keyof WhereParams<'SELECT * FROM user AS u WHERE u.externalUserId = @externalUserId', Tables> ? true : false
>;
type _WpUserType = AssertFalse<
  null extends WhereParams<'SELECT * FROM user AS u WHERE u.externalUserId = @externalUserId', Tables>['externalUserId'] ? true : false
>;
type _WpNoWhere = AssertTrue<
  keyof WhereParams<'SELECT * FROM user AS u WHERE 1=1 ', Tables> extends never ? true : false
>;
type _WpMulti = AssertTrue<
  'id' extends keyof WhereParams<'SELECT * FROM markRecord AS mr WHERE mr.id = @id AND mr.userId = @userId', Tables> ? true : false
>;
type _WpBoth = AssertTrue<
  'id' extends keyof WhereParams<'SELECT * FROM markRecord AS mr WHERE mr.id = @id AND mr.userId = @userId', Tables> ? true : false
> & AssertTrue<
  'userId' extends keyof WhereParams<'SELECT * FROM markRecord AS mr WHERE mr.id = @id AND mr.userId = @userId', Tables> ? true : false
>;

// ── WhereParams (INSERT) ──

type _IpUser = AssertTrue<
  'externalUserId' extends keyof WhereParams<'INSERT INTO user (externalUserId, username, passwordHash, email, phone, token, createdAt, updatedAt) VALUES (@externalUserId, @username, @passwordHash, @email, @phone, @token, @createdAt, @updatedAt)', Tables> ? true : false
>;
type _IpUserType = AssertFalse<
  null extends WhereParams<'INSERT INTO user (externalUserId, username, passwordHash, email, phone, token, createdAt, updatedAt) VALUES (@externalUserId, @username, @passwordHash, @email, @phone, @token, @createdAt, @updatedAt)', Tables>['username'] ? true : false
>;
type _IpUserEmail = AssertTrue<
  null extends WhereParams<'INSERT INTO user (externalUserId, username, passwordHash, email, phone, token, createdAt, updatedAt) VALUES (@externalUserId, @username, @passwordHash, @email, @phone, @token, @createdAt, @updatedAt)', Tables>['email'] ? true : false
>;
type _IpMrk = AssertTrue<
  'userId' extends keyof WhereParams<'INSERT INTO markRecord (userId, createdAt, costCredits) VALUES (@userId, @createdAt, @costCredits)', Tables> ? true : false
>;
type _IpReplace = AssertTrue<
  'openKfId' extends keyof WhereParams<'INSERT OR REPLACE INTO kfCursor (openKfId, cursor) VALUES (@openKfId, @cursor)', Tables> ? true : false
>;
type _IpCt = AssertTrue<
  'amountMoney' extends keyof WhereParams<'INSERT INTO creditTransaction (userId, amountMoney, amountCredits, description, createdAt) VALUES (@userId, @amountMoney, @amountCredits, @description, @createdAt)', Tables> ? true : false
>;

// ── Runtime tests ──

const _d: Tables['user']['externalUserId'] = 'abc';
const _e: Tables['markRecord']['confirmedAt'] = null;
const _f: Tables['markRecord']['costCredits'] = 1.5;

// SELECT * FROM user AS u WHERE u.externalUserId = @externalUserId
type _FindUserParams = WhereParams<'SELECT * FROM user AS u WHERE u.externalUserId = @externalUserId', Tables>;
const _g: _FindUserParams = { 'externalUserId': 'abc' };

type _FindUserResult = SelectResult<'SELECT * FROM user AS u WHERE u.externalUserId = @externalUserId', Tables>;
const _h: _FindUserResult = [{
  externalUserId: 'abc',
  username: 'test',
  passwordHash: 'hash',
  email: null,
  phone: null,
  token: null,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
}];


// SELECT * FROM user AS u WHERE u.username = @username AND u.token = @token
const _i: WhereParams<'SELECT * FROM user AS u WHERE u.username = @username AND u.token = @token', Tables> = {
  'username': 'test',
  'token': null,
};

// INSERT INTO markRecord (userId, createdAt, costCredits) VALUES (@userId, @createdAt, @costCredits)
const _m: WhereParams<'INSERT INTO markRecord (userId, createdAt, costCredits) VALUES (@userId, @createdAt, @costCredits)', Tables> = {
  userId: 'abc',
  createdAt: '2024-01-01',
  costCredits: 1.5,
};

// INSERT INTO user (...) VALUES (@externalUserId, @username, ...)
const _n: WhereParams<'INSERT INTO user (externalUserId, username, passwordHash, email, phone, token, createdAt, updatedAt) VALUES (@externalUserId, @username, @passwordHash, @email, @phone, @token, @createdAt, @updatedAt)', Tables> = {
  externalUserId: 'abc',
  username: 'test',
  passwordHash: 'hash',
  email: null,
  phone: null,
  token: null,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
};

// INSERT INTO creditTransaction (...) VALUES (@userId, @amountMoney, @amountCredits, @description, @createdAt)
const _o: WhereParams<'INSERT INTO creditTransaction (userId, amountMoney, amountCredits, description, createdAt) VALUES (@userId, @amountMoney, @amountCredits, @description, @createdAt)', Tables> = {
  userId: 'abc',
  amountMoney: 1000,
  amountCredits: 100,
  description: null,
  createdAt: '2024-01-01',
};

// INSERT OR REPLACE INTO kfCursor (openKfId, cursor) VALUES (@openKfId, @cursor)
const _p: WhereParams<'INSERT OR REPLACE INTO kfCursor (openKfId, cursor) VALUES (@openKfId, @cursor)', Tables> = {
  openKfId: 'kf_abc',
  cursor: 'some_cursor',
};

// SELECT column + AS, AS

// SELECT u.username AS username FROM user AS u → { username: string }[]
type _SelectSingleColResult = SelectResult<'SELECT u.username AS username FROM user AS u WHERE u.username = @username', Tables>;
const _q: _SelectSingleColResult = [{ username: 'test' }];

// SELECT u.email AS email, u.phone AS phone FROM user AS u → { email: string | null; phone: string | null }[]
type _SelectMultiColResult = SelectResult<'SELECT u.email AS email, u.phone AS phone FROM user AS u WHERE 1=1 ', Tables>;
const _r: _SelectMultiColResult = [{ email: null, phone: '123' }];

// ParseTableName still works with column selection
const _t: ParseTableName<'SELECT u.username AS username FROM user AS u WHERE u.username = @username'> = 'user';

// WhereParams still works with column selection
const _s: WhereParams<'SELECT u.username AS username FROM user AS u WHERE u.username = @username', Tables> = { 'username': 'test' };

// ── ParseTableName (UPDATE / DELETE) ──

type _PtnUpdate = AssertTrue<
  'user' extends ParseTableName<'UPDATE user AS u SET u.email = @email WHERE u.externalUserId = @externalUserId'> ? true : false
>;
type _PtnUpdateMrk = AssertTrue<
  'markRecord' extends ParseTableName<'UPDATE markRecord AS mr SET mr.confirmedAt = @confirmedAt WHERE mr.id = @id'> ? true : false
>;
type _PtnDelete = AssertTrue<
  'user' extends ParseTableName<'DELETE FROM user AS u WHERE u.id = @id'> ? true : false
>;
type _PtnInsertRep = AssertTrue<
  'kfCursor' extends ParseTableName<'INSERT OR REPLACE INTO kfCursor (openKfId, cursor) VALUES (@openKfId, @cursor)'> ? true : false
>;

// ── WhereParams (UPDATE) ──

type _UpToken = AssertTrue<
  'token' extends keyof WhereParams<'UPDATE user AS u SET u.token = @token, u.updatedAt = @updatedAt WHERE u.externalUserId = @externalUserId', Tables> ? true : false
>;
type _UpUpdated = AssertTrue<
  'updatedAt' extends keyof WhereParams<'UPDATE user AS u SET u.token = @token, u.updatedAt = @updatedAt WHERE u.externalUserId = @externalUserId', Tables> ? true : false
>;
type _UpExtId = AssertTrue<
  'externalUserId' extends keyof WhereParams<'UPDATE user AS u SET u.token = @token, u.updatedAt = @updatedAt WHERE u.externalUserId = @externalUserId', Tables> ? true : false
>;
type _UpTokenNullable = AssertTrue<
  null extends WhereParams<'UPDATE user AS u SET u.token = @token WHERE u.externalUserId = @externalUserId', Tables>['token'] ? true : false
>;

const _u: WhereParams<'UPDATE user AS u SET u.email = @email WHERE u.externalUserId = @externalUserId', Tables> = {
  'email': null,
  'externalUserId': 'abc',
};

// ── WhereParams (DELETE) ──

type _WpDelete = AssertTrue<
  'id' extends keyof WhereParams<'DELETE FROM user AS u WHERE u.id = @id', Tables> ? true : false
>;
type _WpDeleteType = AssertFalse<
  null extends WhereParams<'DELETE FROM user AS u WHERE u.id = @id', Tables>['id'] ? true : false
>;
 
// ── INSERT OR REPLACE ──

type _IorParams = AssertTrue<
  'openKfId' extends keyof WhereParams<'INSERT OR REPLACE INTO kfCursor (openKfId, cursor) VALUES (@openKfId, @cursor)', Tables> ? true : false
> & AssertTrue<
  'cursor' extends keyof WhereParams<'INSERT OR REPLACE INTO kfCursor (openKfId, cursor) VALUES (@openKfId, @cursor)', Tables> ? true : false
>;

// ── SqlAllResult ──

type _SarStar = AssertTrue<
  Tables['user'][] extends SqlAllResult<'SELECT * FROM user AS u WHERE u.id = @id', Tables> ? true : false
>;
type _SarCol = AssertTrue<
  { email: string | null; phone: string | null }[] extends SqlAllResult<'SELECT u.email AS email, u.phone AS phone FROM user AS u WHERE 1=1 ', Tables> ? true : false
>;
type _SarAggCount = AssertTrue<
  { count: number }[] extends SqlAllResult<'SELECT COUNT(*) AS count FROM markRecord AS mr WHERE 1=1 ', Tables> ? true : false
>;
type _SarAggTotal = AssertTrue<
  { total: number }[] extends SqlAllResult<'SELECT COALESCE(SUM(mr.costCredits), 0) AS total FROM markRecord AS mr WHERE mr.userId = @userId', Tables> ? true : false
>;
type _SarDmlNever = AssertTrue<
  never extends SqlAllResult<'INSERT INTO user (id) VALUES (@id)', Tables> ? true : false
>;
type _SarUpdateNever = AssertTrue<
  never extends SqlAllResult<'UPDATE user SET email = @email', Tables> ? true : false
>;

// ── SqlGetResult ──

type _SgrStar = AssertTrue<
  Tables['user'] | undefined extends SqlGetResult<'SELECT * FROM user AS u WHERE u.id = @id', Tables> ? true : false
>;
type _SgrCol = AssertTrue<
  { username: string } | undefined extends SqlGetResult<'SELECT u.username AS username FROM user AS u WHERE u.username = @username', Tables> ? true : false
>;
type _SgrColMulti = AssertTrue<
  { email: string | null; phone: string | null } | undefined extends SqlGetResult<'SELECT u.email AS email, u.phone AS phone FROM user AS u WHERE 1=1 ', Tables> ? true : false
>;
type _SgrAggCount = AssertTrue<
  { count: number } | undefined extends SqlGetResult<'SELECT COUNT(*) AS count FROM markRecord AS mr WHERE 1=1 ', Tables> ? true : false
>;

// ── SqlRunResult ──

type _SrrInsert = AssertTrue<
  { lastInsertRowid: number; changes: number } extends SqlRunResult<'INSERT INTO user (id) VALUES (@id)', Tables> ? true : false
>;
type _SrrUpdate = AssertTrue<
  { lastInsertRowid: number; changes: number } extends SqlRunResult<'UPDATE user AS u SET u.email = @email WHERE u.id = @id', Tables> ? true : false
>;
type _SrrDelete = AssertTrue<
  { lastInsertRowid: number; changes: number } extends SqlRunResult<'DELETE FROM user AS u WHERE u.id = @id', Tables> ? true : false
>;
type _SrrSelectNever = AssertTrue<
  never extends SqlRunResult<'SELECT * FROM user AS u WHERE 1=1 ', Tables> ? true : false
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

type _InvalidAllDdl = AssertTrue<never extends SqlAllResult<'DROP TABLE user', Tables> ? true : false>;
type _InvalidRunDdl = AssertTrue<never extends SqlRunResult<'DROP TABLE user', Tables> ? true : false>;
type _InvalidGetDdl = AssertTrue<undefined extends SqlGetResult<'DROP TABLE user', Tables> ? true : false>;
type _InvalidParseTableName = AssertTrue<never extends ParseTableName<'NOT SQL'> ? true : false>;
type _InvalidParseInsert = AssertTrue<never extends ParseTableName<'BOGUS SQL'> ? true : false>;

// ── Runtime validation ──

const _rtAll: SqlAllResult<'SELECT * FROM user AS u WHERE u.id = @id', Tables> = [{ externalUserId: 'abc', username: 'x', passwordHash: 'h', email: null, phone: null, token: null, createdAt: 'now', updatedAt: 'now' }];
const _rtGet: SqlGetResult<'SELECT * FROM user AS u WHERE u.id = @id', Tables> = undefined;
const _rtGet2: SqlGetResult<'SELECT u.username AS username FROM user AS u WHERE u.username = @username', Tables> = { username: 'x' };
const _rtRunInsert: SqlRunResult<'INSERT INTO user (id) VALUES (@id)', Tables> = { lastInsertRowid: 1, changes: 1 };
const _rtRunUpdate: SqlRunResult<'UPDATE user AS u SET u.email = @email WHERE u.id = @id', Tables> = { lastInsertRowid: 1, changes: 1 };

// ── Runtime function tests ──

const TEST_TBL_SQL = `CREATE TABLE testTbl (
id INTEGER PRIMARY KEY,
label TEXT NOT NULL,
val INTEGER
)` as const;
type _TestTables = Schema<typeof TEST_TBL_SQL>;

interface TestTables extends _TestTables {}

// ── TypedDb ──

const _nativeDb = new (require('node:sqlite').DatabaseSync)(':memory:');
_nativeDb.exec(`CREATE TABLE testTbl (
  id INTEGER PRIMARY KEY,
  label TEXT NOT NULL,
  val INTEGER
)`);

const _testDb = new TypedDb<TestTables>(_nativeDb);

// prepare(...).run — INSERT (no alias for INSERT)
const _ins = _testDb.prepare("INSERT INTO testTbl (label, val) VALUES (@label, @val)").run({ label: 'a', val: 1 });
const _insCheck: { lastInsertRowid: number; changes: number } = _ins;

// prepare(...).run — INSERT OR REPLACE (no alias for INSERT)
const _repl = _testDb.prepare("INSERT OR REPLACE INTO testTbl (id, label, val) VALUES (@id, @label, @val)").run({ id: 1, label: 'b', val: 2 });
const _replCheck: { lastInsertRowid: number; changes: number } = _repl;

// prepare(...).run — UPDATE
const _upd = _testDb.prepare("UPDATE testTbl AS t SET t.label = @label WHERE t.id = @id").run({ 'label': 'c', 'id': 1 });
const _updCheck: { lastInsertRowid: number; changes: number } = _upd;

// prepare(...).run — DELETE
const _del = _testDb.prepare("DELETE FROM testTbl AS t WHERE t.id = @id").run({ 'id': 1 });
const _delCheck: { lastInsertRowid: number; changes: number } = _del;

// prepare(...).all — SELECT *
const _all = _testDb.prepare("SELECT * FROM testTbl AS t WHERE t.id = @id").all({ 'id': 1 });
const _allCheck: { id: number; label: string; val: number | null }[] = _all;

// prepare(...).get — single row
const _get = _testDb.prepare("SELECT * FROM testTbl AS t WHERE t.id = @id").get({ 'id': 1 });
const _getCheck: { id: number; label: string; val: number | null } | undefined = _get;

// prepare(...).all — empty result
const _allEmpty = _testDb.prepare("SELECT * FROM testTbl AS t WHERE t.id = @id").all({ 'id': 999 });
const _allEmptyCheck: { id: number; label: string; val: number | null }[] = _allEmpty;

// prepare(...).get — no match
const _getNone = _testDb.prepare("SELECT * FROM testTbl AS t WHERE t.id = @id").get({ 'id': 999 });
const _getNoneCheck: { id: number; label: string; val: number | null } | undefined = _getNone;

// prepare(...).all — column select
const _allCol = _testDb.prepare("SELECT t.label AS label, t.val AS val FROM testTbl AS t WHERE 1=1 ").all({});
const _allColCheck: { label: string; val: number | null }[] = _allCol;

// prepare(...).get — column select
const _getCol = _testDb.prepare("SELECT t.label AS label FROM testTbl AS t WHERE t.id = @id").get({ 'id': 1 });
const _getColCheck: { label: string } | undefined = _getCol;
