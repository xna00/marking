import type {
  Schema,
  ParseTableName, SelectResult, WhereParams,
  InsertParams,
} from './types-sql.ts';

// ── Test helpers ──

type O<T> = { [K in keyof T]: T[K] };
type AssertTrue<T extends true> = T;
type AssertFalse<T extends false> = T;

// ── Table definitions ──

type Tables = {
  user: Schema<`CREATE TABLE user (
externalUserId TEXT PRIMARY KEY,
username TEXT NOT NULL UNIQUE,
passwordHash TEXT NOT NULL,
email TEXT,
phone TEXT,
token TEXT,
createdAt TEXT NOT NULL,
updatedAt TEXT NOT NULL
)`>;
  markRecord: Schema<`CREATE TABLE markRecord (
id INTEGER PRIMARY KEY AUTOINCREMENT,
userId TEXT NOT NULL,
costCredits REAL NOT NULL DEFAULT 1.0,
createdAt TEXT NOT NULL,
confirmedAt TEXT
)`>;
  creditTransaction: Schema<`CREATE TABLE creditTransaction (
id INTEGER PRIMARY KEY AUTOINCREMENT,
userId TEXT NOT NULL,
amountMoney INTEGER NOT NULL,
amountCredits INTEGER NOT NULL,
description TEXT,
createdAt TEXT NOT NULL
)`>;
  kfCursor: Schema<`CREATE TABLE kfCursor (
openKfId TEXT PRIMARY KEY,
cursor TEXT NOT NULL
)`>;
};

// ── Schema tests ──

type User = O<Tables['user']>;

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

type MarkRecord = O<Tables['markRecord']>;

type _Mi = AssertTrue<'id' extends keyof MarkRecord ? true : false>;
type _Mu = AssertTrue<'userId' extends keyof MarkRecord ? true : false>;
type _Mc = AssertTrue<'costCredits' extends keyof MarkRecord ? true : false>;
type _Mcr = AssertTrue<'createdAt' extends keyof MarkRecord ? true : false>;
type _MCo = AssertTrue<'confirmedAt' extends keyof MarkRecord ? true : false>;

type _MrkConfirmedNull  = AssertTrue<null extends MarkRecord['confirmedAt'] ? true : false>;
type _MrkCreatedAtNull  = AssertFalse<null extends MarkRecord['createdAt'] ? true : false>;

type CreditTx = O<Tables['creditTransaction']>;

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
  'creditTransaction' extends ParseTableName<'SELECT * FROM creditTransaction'> ? true : false
>;

// ── SelectResult ──

type _SrUserKey = AssertTrue<'externalUserId' extends keyof SelectResult<'SELECT * FROM user WHERE id = @id', Tables>[number] ? true : false>;
type _SrMrkKey = AssertTrue<'userId' extends keyof SelectResult<'SELECT * FROM markRecord', Tables>[number] ? true : false>;
type _SrUserVal = AssertFalse<null extends SelectResult<'SELECT * FROM user WHERE id = @id', Tables>[number]['externalUserId'] ? true : false>;
type _SrMrkNull = AssertTrue<null extends SelectResult<'SELECT * FROM markRecord', Tables>[number]['confirmedAt'] ? true : false>;

// ── WhereParams ──

type _WpUser = AssertTrue<
  'externalUserId' extends keyof WhereParams<'SELECT * FROM user WHERE externalUserId = @externalUserId', Tables> ? true : false
>;
type _WpUserType = AssertFalse<
  null extends WhereParams<'SELECT * FROM user WHERE externalUserId = @externalUserId', Tables>['externalUserId'] ? true : false
>;
type _WpNoWhere = AssertTrue<
  keyof WhereParams<'SELECT * FROM user', Tables> extends never ? true : false
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
type _SelectMultiColResult = SelectResult<'SELECT email,phone FROM user', Tables>;
const _r: _SelectMultiColResult = [{ email: null, phone: '123' }];

// ParseTableName still works with column selection
const _t: ParseTableName<'SELECT username FROM user WHERE username = @username'> = 'user';

// WhereParams still works with column selection
const _s: WhereParams<'SELECT username FROM user WHERE username = @username', Tables> = { username: 'test' };
