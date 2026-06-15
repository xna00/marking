import {
  type O,
  type Schema,
  type ParseTableName, type SelectResult, type WhereParams,
  type InsertParams,
  type UpdateParams,
  type ParseAggAliases,
  type SqlAllResult, type SqlGetResult, type SqlRunResult,
  sqlAll, sqlGet, sqlRun,
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
  'user' extends ParseTableName<'SELECT * FROM user WHERE id = @id'> ? true : false
>;
type _PtnMarkRecord = AssertTrue<
  'markRecord' extends ParseTableName<'SELECT * FROM markRecord WHERE userId = @userId'> ? true : false
>;
type _PtnNoWhere = AssertTrue<
  'creditTransaction' extends ParseTableName<'SELECT * FROM creditTransaction '> ? true : false
>;

// ── SelectResult ──

type _SrUserKey = AssertTrue<'externalUserId' extends keyof SelectResult<'SELECT * FROM user WHERE id = @id', Tables>[number] ? true : false>;
type _SrMrkKey = AssertTrue<  'userId' extends keyof SelectResult<'SELECT * FROM markRecord ', Tables>[number] ? true : false>;
type _SrUserVal = AssertFalse<null extends SelectResult<'SELECT * FROM user WHERE id = @id', Tables>[number]['externalUserId'] ? true : false>;
type _SrMrkNull = AssertTrue<  null extends SelectResult<'SELECT * FROM markRecord ', Tables>[number]['confirmedAt'] ? true : false>;

// ── WhereParams ──

type _WpUser = AssertTrue<
  'externalUserId' extends keyof WhereParams<'SELECT * FROM user WHERE externalUserId = @externalUserId', Tables> ? true : false
>;
type _WpUserType = AssertFalse<
  null extends WhereParams<'SELECT * FROM user WHERE externalUserId = @externalUserId', Tables>['externalUserId'] ? true : false
>;
type _WpNoWhere = AssertTrue<
  keyof WhereParams<'SELECT * FROM user ', Tables> extends never ? true : false
>;
type _WpMulti = AssertTrue<
  'id' extends keyof WhereParams<'SELECT * FROM markRecord WHERE id = @id AND userId = @userId', Tables> ? true : false
>;
type _WpBoth = AssertTrue<
  'id' extends keyof WhereParams<'SELECT * FROM markRecord WHERE id = @id AND userId = @userId', Tables> ? true : false
> & AssertTrue<
  'userId' extends keyof WhereParams<'SELECT * FROM markRecord WHERE id = @id AND userId = @userId', Tables> ? true : false
>;

// ── InsertParams ──

type _IpUser = AssertTrue<
  'externalUserId' extends keyof InsertParams<'INSERT INTO user (externalUserId, username, passwordHash, email, phone, token, createdAt, updatedAt) VALUES (@externalUserId, @username, @passwordHash, @email, @phone, @token, @createdAt, @updatedAt)', Tables> ? true : false
>;
type _IpUserType = AssertFalse<
  null extends InsertParams<'INSERT INTO user (externalUserId, username, passwordHash, email, phone, token, createdAt, updatedAt) VALUES (@externalUserId, @username, @passwordHash, @email, @phone, @token, @createdAt, @updatedAt)', Tables>['username'] ? true : false
>;
type _IpUserEmail = AssertTrue<
  null extends InsertParams<'INSERT INTO user (externalUserId, username, passwordHash, email, phone, token, createdAt, updatedAt) VALUES (@externalUserId, @username, @passwordHash, @email, @phone, @token, @createdAt, @updatedAt)', Tables>['email'] ? true : false
>;
type _IpMrk = AssertTrue<
  'userId' extends keyof InsertParams<'INSERT INTO markRecord (userId, createdAt, costCredits) VALUES (@userId, @createdAt, @costCredits)', Tables> ? true : false
>;
type _IpReplace = AssertTrue<
  'openKfId' extends keyof InsertParams<'INSERT OR REPLACE INTO kfCursor (openKfId, cursor) VALUES (@openKfId, @cursor)', Tables> ? true : false
>;
type _IpCt = AssertTrue<
  'amountMoney' extends keyof InsertParams<'INSERT INTO creditTransaction (userId, amountMoney, amountCredits, description, createdAt) VALUES (@userId, @amountMoney, @amountCredits, @description, @createdAt)', Tables> ? true : false
>;

// ── Runtime tests ──

const _d: Tables['user']['externalUserId'] = 'abc';
const _e: Tables['markRecord']['confirmedAt'] = null;
const _f: Tables['markRecord']['costCredits'] = 1.5;

// SELECT * FROM user WHERE externalUserId = @externalUserId
type _FindUserParams = WhereParams<'SELECT * FROM user WHERE externalUserId = @externalUserId', Tables>;
const _g: _FindUserParams = { externalUserId: 'abc' };

type _FindUserResult = SelectResult<'SELECT * FROM user WHERE externalUserId = @externalUserId', Tables>;
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


// SELECT * FROM user WHERE username = @username AND token = @token
const _i: WhereParams<'SELECT * FROM user WHERE username = @username AND token = @token', Tables> = {
  username: 'test',
  token: null,
};

// INSERT INTO markRecord (userId, createdAt, costCredits) VALUES (@userId, @createdAt, @costCredits)
const _m: InsertParams<'INSERT INTO markRecord (userId, createdAt, costCredits) VALUES (@userId, @createdAt, @costCredits)', Tables> = {
  userId: 'abc',
  createdAt: '2024-01-01',
  costCredits: 1.5,
};

// INSERT INTO user (...) VALUES (@externalUserId, @username, ...)
const _n: InsertParams<'INSERT INTO user (externalUserId, username, passwordHash, email, phone, token, createdAt, updatedAt) VALUES (@externalUserId, @username, @passwordHash, @email, @phone, @token, @createdAt, @updatedAt)', Tables> = {
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
const _o: InsertParams<'INSERT INTO creditTransaction (userId, amountMoney, amountCredits, description, createdAt) VALUES (@userId, @amountMoney, @amountCredits, @description, @createdAt)', Tables> = {
  userId: 'abc',
  amountMoney: 1000,
  amountCredits: 100,
  description: null,
  createdAt: '2024-01-01',
};

// INSERT OR REPLACE INTO kfCursor (openKfId, cursor) VALUES (@openKfId, @cursor)
const _p: InsertParams<'INSERT OR REPLACE INTO kfCursor (openKfId, cursor) VALUES (@openKfId, @cursor)', Tables> = {
  openKfId: 'kf_abc',
  cursor: 'some_cursor',
};

// SELECT col1,col2 FROM table (Phase 4)

// SELECT username FROM user → Pick<Tables['user'], 'username'>[]
type _SelectSingleColResult = SelectResult<'SELECT username FROM user WHERE username = @username', Tables>;
const _q: _SelectSingleColResult = [{ username: 'test' }];

// SELECT email,phone FROM user → Pick<Tables['user'], 'email' | 'phone'>[]
type _SelectMultiColResult = SelectResult<'SELECT email,phone FROM user ', Tables>;
const _r: _SelectMultiColResult = [{ email: null, phone: '123' }];

// ParseTableName still works with column selection
const _t: ParseTableName<'SELECT username FROM user WHERE username = @username'> = 'user';

// WhereParams still works with column selection
const _s: WhereParams<'SELECT username FROM user WHERE username = @username', Tables> = { username: 'test' };

// ── ParseTableName (UPDATE / DELETE) ──

type _PtnUpdate = AssertTrue<
  'user' extends ParseTableName<'UPDATE user SET email = @email WHERE externalUserId = @externalUserId'> ? true : false
>;
type _PtnUpdateMrk = AssertTrue<
  'markRecord' extends ParseTableName<'UPDATE markRecord SET confirmedAt = @confirmedAt WHERE id = @id'> ? true : false
>;
type _PtnDelete = AssertTrue<
  'user' extends ParseTableName<'DELETE FROM user WHERE id = @id'> ? true : false
>;
type _PtnInsertRep = AssertTrue<
  'kfCursor' extends ParseTableName<'INSERT OR REPLACE INTO kfCursor (openKfId, cursor) VALUES (@openKfId, @cursor)'> ? true : false
>;

// ── UpdateParams ──

type _UpToken = AssertTrue<
  'token' extends keyof UpdateParams<'UPDATE user SET token = @token, updatedAt = @updatedAt WHERE externalUserId = @externalUserId', Tables> ? true : false
>;
type _UpUpdated = AssertTrue<
  'updatedAt' extends keyof UpdateParams<'UPDATE user SET token = @token, updatedAt = @updatedAt WHERE externalUserId = @externalUserId', Tables> ? true : false
>;
type _UpExtId = AssertTrue<
  'externalUserId' extends keyof UpdateParams<'UPDATE user SET token = @token, updatedAt = @updatedAt WHERE externalUserId = @externalUserId', Tables> ? true : false
>;
type _UpTokenNullable = AssertTrue<
  null extends UpdateParams<'UPDATE user SET token = @token WHERE externalUserId = @externalUserId', Tables>['token'] ? true : false
>;

const _u: UpdateParams<'UPDATE user SET email = @email WHERE externalUserId = @externalUserId', Tables> = {
  email: null,
  externalUserId: 'abc',
};

// ── ParseAggAliases ──

type _PaaCount = AssertTrue<
  'count' extends ParseAggAliases<'SELECT COUNT(*) as count FROM markRecord WHERE userId = @userId'> ? true : false
>;
type _PaaTotal = AssertTrue<
  'total' extends ParseAggAliases<'SELECT COALESCE(SUM(costCredits), 0) as total FROM markRecord WHERE userId = @userId'> ? true : false
>;

// ── INSERT OR REPLACE ──

type _IorParams = AssertTrue<
  'openKfId' extends keyof InsertParams<'INSERT OR REPLACE INTO kfCursor (openKfId, cursor) VALUES (@openKfId, @cursor)', Tables> ? true : false
> & AssertTrue<
  'cursor' extends keyof InsertParams<'INSERT OR REPLACE INTO kfCursor (openKfId, cursor) VALUES (@openKfId, @cursor)', Tables> ? true : false
>;

// ── SqlAllResult ──

type _SarStar = AssertTrue<
  Tables['user'][] extends SqlAllResult<'SELECT * FROM user WHERE id = @id', Tables> ? true : false
>;
type _SarCol = AssertTrue<
  Pick<Tables['user'], 'email' | 'phone'>[] extends SqlAllResult<'SELECT email,phone FROM user ', Tables> ? true : false
>;
type _SarAggCount = AssertTrue<
  { count: number }[] extends SqlAllResult<'SELECT COUNT(*) as count FROM markRecord ', Tables> ? true : false
>;
type _SarAggTotal = AssertTrue<
  { total: number }[] extends SqlAllResult<'SELECT COALESCE(SUM(costCredits), 0) as total FROM markRecord WHERE userId = @userId', Tables> ? true : false
>;
type _SarDmlNever = AssertTrue<
  never extends SqlAllResult<'INSERT INTO user (id) VALUES (@id)', Tables> ? true : false
>;
type _SarUpdateNever = AssertTrue<
  never extends SqlAllResult<'UPDATE user SET email = @email', Tables> ? true : false
>;

// ── SqlGetResult ──

type _SgrStar = AssertTrue<
  Tables['user'] | undefined extends SqlGetResult<'SELECT * FROM user WHERE id = @id', Tables> ? true : false
>;
type _SgrCol = AssertTrue<
  { username: string } | undefined extends SqlGetResult<'SELECT username FROM user WHERE username = @username', Tables> ? true : false
>;
type _SgrColMulti = AssertTrue<
  Pick<Tables['user'], 'email' | 'phone'> | undefined extends SqlGetResult<'SELECT email,phone FROM user ', Tables> ? true : false
>;
type _SgrAggCount = AssertTrue<
  { count: number } | undefined extends SqlGetResult<'SELECT COUNT(*) as count FROM markRecord ', Tables> ? true : false
>;

// ── SqlRunResult ──

type _SrrInsert = AssertTrue<
  { lastInsertRowid: number; changes: number } extends SqlRunResult<'INSERT INTO user (id) VALUES (@id)', Tables> ? true : false
>;
type _SrrUpdate = AssertTrue<
  { lastInsertRowid: number; changes: number } extends SqlRunResult<'UPDATE user SET email = @email WHERE id = @id', Tables> ? true : false
>;
type _SrrDelete = AssertTrue<
  { lastInsertRowid: number; changes: number } extends SqlRunResult<'DELETE FROM user WHERE id = @id', Tables> ? true : false
>;
type _SrrSelectNever = AssertTrue<
  never extends SqlRunResult<'SELECT * FROM user ', Tables> ? true : false
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

const _rtAll: SqlAllResult<'SELECT * FROM user WHERE id = @id', Tables> = [{ externalUserId: 'abc', username: 'x', passwordHash: 'h', email: null, phone: null, token: null, createdAt: 'now', updatedAt: 'now' }];
const _rtGet: SqlGetResult<'SELECT * FROM user WHERE id = @id', Tables> = undefined;
const _rtGet2: SqlGetResult<'SELECT username FROM user WHERE username = @username', Tables> = { username: 'x' };
const _rtRunInsert: SqlRunResult<'INSERT INTO user (id) VALUES (@id)', Tables> = { lastInsertRowid: 1, changes: 1 };
const _rtRunUpdate: SqlRunResult<'UPDATE user SET email = @email WHERE id = @id', Tables> = { lastInsertRowid: 1, changes: 1 };

// ── Runtime function tests ──

const TEST_TBL_SQL = `CREATE TABLE testTbl (
id INTEGER PRIMARY KEY,
label TEXT NOT NULL,
val INTEGER
)` as const;
type TestTables = Schema<typeof TEST_TBL_SQL>;

const _db = new (require('node:sqlite').DatabaseSync)(':memory:');
_db.exec(`CREATE TABLE testTbl (
  id INTEGER PRIMARY KEY,
  label TEXT NOT NULL,
  val INTEGER
)`);

// sqlRun — INSERT
const _ins = sqlRun<"INSERT INTO testTbl (label, val) VALUES (@label, @val)", TestTables>(
  _db,
  "INSERT INTO testTbl (label, val) VALUES (@label, @val)",
  { label: 'a', val: 1 },
);
const _insCheck: { lastInsertRowid: number; changes: number } = _ins;

// sqlRun — INSERT OR REPLACE
const _repl = sqlRun<"INSERT OR REPLACE INTO testTbl (id, label, val) VALUES (@id, @label, @val)", TestTables>(
  _db,
  "INSERT OR REPLACE INTO testTbl (id, label, val) VALUES (@id, @label, @val)",
  { id: 1, label: 'b', val: 2 },
);
const _replCheck: { lastInsertRowid: number; changes: number } = _repl;

// sqlRun — UPDATE
const _upd = sqlRun<"UPDATE testTbl SET label = @label WHERE id = @id", TestTables>(
  _db,
  "UPDATE testTbl SET label = @label WHERE id = @id",
  { label: 'c', id: 1 },
);
const _updCheck: { lastInsertRowid: number; changes: number } = _upd;

// sqlRun — DELETE
const _del = sqlRun<"DELETE FROM testTbl WHERE id = @id", TestTables>(
  _db,
  "DELETE FROM testTbl WHERE id = @id",
  { id: 1 },
);
const _delCheck: { lastInsertRowid: number; changes: number } = _del;

// sqlAll — SELECT *
const _all = sqlAll<"SELECT * FROM testTbl WHERE id = @id", TestTables>(
  _db,
  "SELECT * FROM testTbl WHERE id = @id",
  { id: 1 },
);
const _allCheck: { id: number; label: string; val: number | null }[] = _all;

// sqlGet — single row
const _get = sqlGet<"SELECT * FROM testTbl WHERE id = @id", TestTables>(
  _db,
  "SELECT * FROM testTbl WHERE id = @id",
  { id: 1 },
);
const _getCheck: { id: number; label: string; val: number | null } | undefined = _get;

// sqlAll — empty result
const _allEmpty = sqlAll<"SELECT * FROM testTbl WHERE id = @id", TestTables>(
  _db,
  "SELECT * FROM testTbl WHERE id = @id",
  { id: 999 },
);
const _allEmptyCheck: { id: number; label: string; val: number | null }[] = _allEmpty;

// sqlGet — no match
const _getNone = sqlGet<"SELECT * FROM testTbl WHERE id = @id", TestTables>(
  _db,
  "SELECT * FROM testTbl WHERE id = @id",
  { id: 999 },
);
const _getNoneCheck: { id: number; label: string; val: number | null } | undefined = _getNone;

// sqlAll — column select
const _allCol = sqlAll<"SELECT label,val FROM testTbl ", TestTables>(
  _db,
  "SELECT label,val FROM testTbl ",
  {},
);
const _allColCheck: { label: string; val: number | null }[] = _allCol;

// sqlGet — column select
const _getCol = sqlGet<"SELECT label FROM testTbl WHERE id = @id", TestTables>(
  _db,
  "SELECT label FROM testTbl WHERE id = @id",
  { id: 1 },
);
const _getColCheck: { label: string } | undefined = _getCol;
