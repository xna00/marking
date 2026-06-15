// ═══════════════════════════════════════════════
//  类型级 SQL 解析器
//
//  约定：
//   - 关键字一律大写（SELECT, FROM, WHERE, INSERT...）
//   - 参数用 @name，name = 列名，如 WHERE id = @id
//   - @name 后紧跟 , 或 )，不留空格（如 @a,@b / @a)）
//   - 传参用 object，属性顺序应与 SQL 中 @name 出现顺序一致
//   - SELECT 结果 always T[]（.all() 语义）
// ═══════════════════════════════════════════

type SqlType<T extends string> =
  T extends `INTEGER${string}` ? number
  : T extends `INT${string}` ? number
  : T extends `REAL${string}` ? number
  : T extends `FLOAT${string}` ? number
  : T extends `TEXT${string}` ? string
  : T extends `BLOB${string}` ? Uint8Array
  : never;

// Find first word that's a SQL type name (skip constraint keywords)
type TypeWord<Words extends string[]> =
  Words extends [infer W extends string, ...infer Rest extends string[]]
    ? W extends 'NOT' | 'NULL' | 'PRIMARY' | 'KEY' | 'UNIQUE' | 'REFERENCES'
        | 'DEFAULT' | 'CHECK' | 'AUTOINCREMENT' | '' | `\n${string}`
      ? TypeWord<Rest>
      : W
    : never;

// Parse "name TYPE constraints..." → { name: "name", type: "TYPE" }
type ColNameType<S extends string> =
  S extends `${infer Name} ${infer Rest}`
    ? { name: Name; type: TypeWord<Split<Rest, ' '>> }
    : never;

type Split<S extends string, Sep extends string, Acc extends string[] = []> =
  S extends `${infer Head}${Sep}${infer Tail}`
    ? Split<Tail, Sep, [...Acc, Head]>
    : S extends '' ? Acc : [...Acc, S];

type ColNullable<S extends string> =
  S extends `${string}NOT NULL${string}` ? false
  : S extends `${string}TEXT PRIMARY KEY${string}` ? false
  : S extends `${string}INTEGER PRIMARY KEY${string}` ? false
  : S extends `${string}REAL PRIMARY KEY${string}` ? false
  : S extends `${string}PRIMARY KEY${string}` ? false
  : true;

type ColToField<S extends string> =
  ColNameType<S> extends infer P
    ? P extends { name: infer N extends string; type: infer T extends string }
      ? ColNullable<S> extends false
        ? Record<N, SqlType<T>>
        : Record<N, SqlType<T> | null>
      : {}
    : {};

// Split columns at commas (columns separated by \n,\n)
type _Chomp<S extends string> =
  S extends `\n${infer A},\n${infer B}` ? [A, `\n${B}`]
  : S extends `\n${infer A}\n${string}` ? [A, '']
  : S extends `\n${infer A}` ? [A, '']
  : [S, ''];

type ParseCols<S extends string, Acc extends Record<string, unknown> = {}> =
  _Chomp<S> extends [infer Col extends string, infer Rest extends string]
    ? Col extends '' ? Acc
    : ColToField<Col> extends infer F
      ? F extends Record<string, unknown>
        ? Rest extends ''
          ? Omit<Acc, keyof F> & F
          : ParseCols<Rest, Omit<Acc, keyof F> & F>
        : Acc
      : Acc
    : Acc;

export type Schema<S extends string> =
  S extends `${string}(${infer Cols})${string}`
    ? ParseCols<Cols>
    : {};

// ── @name parameter scanner ──
// 扫描 SQL 中所有 @name → 查 Tables[表名][name] → Record<name, type>

// First word of a string (word breaks: space, comma, close-paren, semicolon)
type FirstWord<S extends string> =
  S extends `${infer W} ${infer _}` ? W
  : S extends `${infer W},${infer _}` ? W
  : S extends `${infer W})${infer _}` ? W
  : S extends `${infer W};${infer _}` ? W
  : S;

// Extract a single parameter name from text after @
type ParamName<S extends string> =
  S extends `${infer N},${infer _}` ? N
  : S extends `${infer N})${infer _}` ? N
  : S extends `${infer N};${infer _}` ? N
  : S extends `${infer N} ${infer _}` ? N
  : S;

// Collect all @name references from a SQL string
type AtParams<S extends string> = _AtParams<Split<S, '@'>>;

type _AtParams<Parts extends string[], Acc extends string = never> =
  Parts extends [infer _P, ...infer Tail extends string[]]
    ? Tail extends [infer T extends string, ...infer Rest extends string[]]
      ? _AtParams<Tail, Acc | ParamName<T>>
      : Acc
    : Acc;

// Map parameter name union to Record<name, type> via table schema
type NamesToRecord<Names extends string, TName extends keyof Tables> = {
  [K in Names & keyof Tables[TName]]: Tables[TName][K]
};

// ── SELECT parser ──

// Extract table name from SELECT (handles both SELECT * and SELECT col1, col2)
export type ParseTableName<S extends string> =
  S extends `SELECT ${infer Rest}`
    ? Rest extends `${string} FROM ${infer TName}`
      ? FirstWord<TName>
      : never
    : never;

// Check if SELECT uses * (star)
type ParseIsStar<S extends string> =
  S extends `SELECT ${infer Rest}`
    ? Rest extends `*${string}` ? true : false
    : false;

// Parse column list from SELECT (comma-separated identifiers)
type ParseColNames<S extends string> =
  S extends `SELECT ${infer Rest}`
    ? Rest extends `${infer Cols} FROM ${string}`
      ? _SplitCols<Cols>
      : never
    : never;

type _SplitCols<S extends string> =
  S extends `${infer C},${infer Rest}` ? C | _SplitCols<Rest>
  : S;

// Result type: SELECT * → Tables[table][], SELECT cols → Pick<Tables[table], cols>[]
export type SelectResult<S extends string> =
  ParseTableName<S> extends keyof Tables
    ? ParseIsStar<S> extends true
      ? Tables[ParseTableName<S>][]
      : Pick<Tables[ParseTableName<S>], ParseColNames<S>>[]
    : never;

export type WhereParams<S extends string> =
  ParseTableName<S> extends keyof Tables
    ? NamesToRecord<AtParams<S>, ParseTableName<S>>
    : {};

// ── INSERT parser ──

type ParseInsertTableName<S extends string> =
  S extends `INSERT OR REPLACE INTO ${infer Rest}` ? FirstWord<Rest>
  : S extends `INSERT INTO ${infer Rest}` ? FirstWord<Rest>
  : never;

export type InsertParams<S extends string> =
  ParseInsertTableName<S> extends keyof Tables
    ? NamesToRecord<AtParams<S>, ParseInsertTableName<S>>
    : {};

// ══════════════════════════════════════════
//  Compile-time tests
// ══════════════════════════════════════════

type AssertTrue<T extends true> = T;
type AssertFalse<T extends false> = T;

// ── user table ──

type _User = Schema<`CREATE TABLE user (
externalUserId TEXT PRIMARY KEY,
username TEXT NOT NULL UNIQUE,
passwordHash TEXT NOT NULL,
email TEXT,
phone TEXT,
token TEXT,
createdAt TEXT NOT NULL,
updatedAt TEXT NOT NULL
)`>;

type O<T> = {[K in keyof T]: T[K]}
type User = O<_User>

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

// ── markRecord table ──

type _MarkRecord = Schema<`CREATE TABLE markRecord (
id INTEGER PRIMARY KEY AUTOINCREMENT,
userId TEXT NOT NULL,
costCredits REAL NOT NULL DEFAULT 1.0,
createdAt TEXT NOT NULL,
confirmedAt TEXT
)`>;
type MarkRecord = O<_MarkRecord>

type _Mi = AssertTrue<'id' extends keyof MarkRecord ? true : false>;
type _Mu = AssertTrue<'userId' extends keyof MarkRecord ? true : false>;
type _Mc = AssertTrue<'costCredits' extends keyof MarkRecord ? true : false>;
type _Mcr = AssertTrue<'createdAt' extends keyof MarkRecord ? true : false>;
type _MCo = AssertTrue<'confirmedAt' extends keyof MarkRecord ? true : false>;

type _MrkConfirmedNull  = AssertTrue<null extends MarkRecord['confirmedAt'] ? true : false>;
type _MrkCreatedAtNull  = AssertFalse<null extends MarkRecord['createdAt'] ? true : false>;

// ── creditTransaction table ──

type _CreditTx = Schema<`CREATE TABLE creditTransaction (
id INTEGER PRIMARY KEY AUTOINCREMENT,
userId TEXT NOT NULL,
amountMoney INTEGER NOT NULL,
amountCredits INTEGER NOT NULL,
description TEXT,
createdAt TEXT NOT NULL
)`>;
type CreditTx = O<_CreditTx>

type _Cd = AssertTrue<'description' extends keyof CreditTx ? true : false>;
type _Ca = AssertTrue<'amountMoney' extends keyof CreditTx ? true : false>;
type _Cc = AssertTrue<'amountCredits' extends keyof CreditTx ? true : false>;

type _CtDescNull = AssertTrue<null extends CreditTx['description'] ? true : false>;

// ── Manual table mapping ──

export type Tables = {
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

type _SrUserKey = AssertTrue<'externalUserId' extends keyof SelectResult<'SELECT * FROM user WHERE id = @id'>[number] ? true : false>;
type _SrMrkKey = AssertTrue<'userId' extends keyof SelectResult<'SELECT * FROM markRecord'>[number] ? true : false>;
type _SrUserVal = AssertFalse<null extends SelectResult<'SELECT * FROM user WHERE id = @id'>[number]['externalUserId'] ? true : false>;
type _SrMrkNull = AssertTrue<null extends SelectResult<'SELECT * FROM markRecord'>[number]['confirmedAt'] ? true : false>;

// ── WhereParams (@name) ──

type _WpUser = AssertTrue<
  'externalUserId' extends keyof WhereParams<'SELECT * FROM user WHERE externalUserId = @externalUserId'> ? true : false
>;
type _WpUserType = AssertFalse<
  null extends WhereParams<'SELECT * FROM user WHERE externalUserId = @externalUserId'>['externalUserId'] ? true : false
>;
type _WpNoWhere = AssertTrue<
  keyof WhereParams<'SELECT * FROM user'> extends never ? true : false
>;
type _WpMulti = AssertTrue<
  'id' extends keyof WhereParams<'SELECT * FROM markRecord WHERE id = @id AND userId = @userId'> ? true : false
>;
type _WpBoth = AssertTrue<
  'id' extends keyof WhereParams<'SELECT * FROM markRecord WHERE id = @id AND userId = @userId'> ? true : false
> & AssertTrue<
  'userId' extends keyof WhereParams<'SELECT * FROM markRecord WHERE id = @id AND userId = @userId'> ? true : false
>;

// ── InsertParams (@name) ──

type _IpUser = AssertTrue<
  'externalUserId' extends keyof InsertParams<'INSERT INTO user (externalUserId, username, passwordHash, email, phone, token, createdAt, updatedAt) VALUES (@externalUserId, @username, @passwordHash, @email, @phone, @token, @createdAt, @updatedAt)'> ? true : false
>;
type _IpUserType = AssertFalse<
  null extends InsertParams<'INSERT INTO user (externalUserId, username, passwordHash, email, phone, token, createdAt, updatedAt) VALUES (@externalUserId, @username, @passwordHash, @email, @phone, @token, @createdAt, @updatedAt)'>['username'] ? true : false
>;
type _IpUserEmail = AssertTrue<
  null extends InsertParams<'INSERT INTO user (externalUserId, username, passwordHash, email, phone, token, createdAt, updatedAt) VALUES (@externalUserId, @username, @passwordHash, @email, @phone, @token, @createdAt, @updatedAt)'>['email'] ? true : false
>;
type _IpMrk = AssertTrue<
  'userId' extends keyof InsertParams<'INSERT INTO markRecord (userId, createdAt, costCredits) VALUES (@userId, @createdAt, @costCredits)'> ? true : false
>;
type _IpReplace = AssertTrue<
  'openKfId' extends keyof InsertParams<'INSERT OR REPLACE INTO kfCursor (openKfId, cursor) VALUES (@openKfId, @cursor)'> ? true : false
>;
type _IpCt = AssertTrue<
  'amountMoney' extends keyof InsertParams<'INSERT INTO creditTransaction (userId, amountMoney, amountCredits, description, createdAt) VALUES (@userId, @amountMoney, @amountCredits, @description, @createdAt)'> ? true : false
>;
