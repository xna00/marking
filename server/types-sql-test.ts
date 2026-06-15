import type {
  Schema, Tables,
  WhereParams, SelectResult, ParseTableName,
  InsertParams,
} from './types-sql.ts';

// ── Schema / Tables ──

type User = Schema<`CREATE TABLE user (
externalUserId TEXT PRIMARY KEY,
username TEXT NOT NULL UNIQUE,
passwordHash TEXT NOT NULL,
email TEXT,
phone TEXT,
token TEXT,
createdAt TEXT NOT NULL,
updatedAt TEXT NOT NULL
)`>;

const a: User = {
  externalUserId: 'abc',
  username: 'test',
  passwordHash: 'hash',
  email: null,
  phone: null,
  token: null,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
};

const _b: User['email'] = null;
const _c: User['email'] = 'test@test.com';

const _d: Tables['user']['externalUserId'] = 'abc';
const _e: Tables['markRecord']['confirmedAt'] = null;
const _f: Tables['markRecord']['costCredits'] = 1.5;

// ── 用 @name 语法验证类型推导 ──

// SELECT * FROM user WHERE externalUserId = @externalUserId
type _FindUserParams = WhereParams<'SELECT * FROM user WHERE externalUserId = @externalUserId'>;
const _g: _FindUserParams = { externalUserId: 'abc' };

type _FindUserResult = SelectResult<'SELECT * FROM user WHERE externalUserId = @externalUserId'>;
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
const _i: WhereParams<'SELECT * FROM user WHERE username = @username AND token = @token'> = {
  username: 'test',
  token: null,
};

// INSERT INTO markRecord (userId, createdAt, costCredits) VALUES (@userId, @createdAt, @costCredits)
const _m: InsertParams<'INSERT INTO markRecord (userId, createdAt, costCredits) VALUES (@userId, @createdAt, @costCredits)'> = {
  userId: 'abc',
  createdAt: '2024-01-01',
  costCredits: 1.5,
};

// INSERT INTO user (...) VALUES (@externalUserId, @username, ...)
const _n: InsertParams<'INSERT INTO user (externalUserId, username, passwordHash, email, phone, token, createdAt, updatedAt) VALUES (@externalUserId, @username, @passwordHash, @email, @phone, @token, @createdAt, @updatedAt)'> = {
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
const _o: InsertParams<'INSERT INTO creditTransaction (userId, amountMoney, amountCredits, description, createdAt) VALUES (@userId, @amountMoney, @amountCredits, @description, @createdAt)'> = {
  userId: 'abc',
  amountMoney: 1000,
  amountCredits: 100,
  description: null,
  createdAt: '2024-01-01',
};

// INSERT OR REPLACE INTO kfCursor (openKfId, cursor) VALUES (@openKfId, @cursor)
const _p: InsertParams<'INSERT OR REPLACE INTO kfCursor (openKfId, cursor) VALUES (@openKfId, @cursor)'> = {
  openKfId: 'kf_abc',
  cursor: 'some_cursor',
};

// ── SELECT col1, col2 FROM table (Phase 4) ──

// SELECT username FROM user → Pick<Tables['user'], 'username'>[]
type _SelectSingleColResult = SelectResult<'SELECT username FROM user WHERE username = @username'>;
const _q: _SelectSingleColResult = [{ username: 'test' }];

// SELECT email,phone FROM user → Pick<Tables['user'], 'email' | 'phone'>[]
type _SelectMultiColResult = SelectResult<'SELECT email,phone FROM user'>;
const _r: _SelectMultiColResult = [{ email: null, phone: '123' }];

// ParseTableName still works with column selection
const _t: ParseTableName<'SELECT username FROM user WHERE username = @username'> = 'user';

// WhereParams still works with column selection
const _s: WhereParams<'SELECT username FROM user WHERE username = @username'> = { username: 'test' };
