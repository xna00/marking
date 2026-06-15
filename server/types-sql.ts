// Derive TS type from a single CREATE TABLE statement

type Trim<S extends string> =
  S extends ` ${infer R}` ? Trim<R>
  : S extends `\n${infer R}` ? Trim<R>
  : S extends `\t${infer R}` ? Trim<R>
  : S extends `\r${infer R}` ? Trim<R>
  : S;

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
  Trim<S> extends `${infer Name} ${infer Rest}`
    ? { name: Trim<Name>; type: TypeWord<Split<Trim<Rest>, ' '>> }
    : never;

type Split<S extends string, Sep extends string, Acc extends string[] = []> =
  S extends `${infer Head}${Sep}${infer Tail}`
    ? Split<Tail, Sep, [...Acc, Head]>
    : S extends '' ? Acc : [...Acc, S];

type ColNullable<S extends string> =
  Trim<S> extends `${string}NOT NULL${string}` ? false
  : Trim<S> extends `${string}TEXT PRIMARY KEY${string}` ? false
  : Trim<S> extends `${string}INTEGER PRIMARY KEY${string}` ? false
  : Trim<S> extends `${string}REAL PRIMARY KEY${string}` ? false
  : Trim<S> extends `${string}PRIMARY KEY${string}` ? false
  : true;

type ColToField<S extends string> =
  ColNameType<S> extends infer P
    ? P extends { name: infer N extends string; type: infer T extends string }
      ? ColNullable<S> extends false
        ? Record<N, SqlType<T>>
        : Record<N, SqlType<T> | null>
      : {}
    : {};

// Split "a, b, c" at commas (no nested parens)
type _Chomp<S extends string> =
  S extends `${infer A},${infer B}` ? [Trim<A>, B] : [Trim<S>, ''];

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
  Trim<S> extends `${string}(${infer Cols})${string}`
    ? ParseCols<Trim<Cols>>
    : {};

// ── SELECT parser ──

type FirstWord<S extends string> =
  Trim<S> extends `${infer W} ${infer _}` ? W : Trim<S>;

export type ParseTableName<S extends string> =
  Trim<S> extends `SELECT * FROM ${infer Rest}` ? FirstWord<Trim<Rest>>
  : never;

export type SelectResult<S extends string> =
  ParseTableName<S> extends keyof Tables ? Tables[ParseTableName<S>][] : never;

type ParseWhereCond<Cond extends string, TName extends keyof Tables> =
  Trim<Cond> extends `${infer Col} = ? AND ${infer Rest}`
    ? Col extends keyof Tables[TName]
      ? Record<Col, Tables[TName][Col]> & ParseWhereCond<Rest, TName>
      : {}
  : Trim<Cond> extends `${infer Col} = ?`
    ? Col extends keyof Tables[TName]
      ? Record<Col, Tables[TName][Col]>
      : {}
  : {};

export type WhereParams<S extends string> =
  ParseTableName<S> extends keyof Tables
    ? Trim<S> extends `${string}WHERE ${infer Cond}`
      ? ParseWhereCond<Trim<Cond>, ParseTableName<S>>
      : {}
    : {};

// ══════════════════════════════════════════
//  Compile-time tests
// ══════════════════════════════════════════

type AssertTrue<T extends true> = T;
type AssertFalse<T extends false> = T;

// ── user table ──

type User = Schema<`
  CREATE TABLE user (
    externalUserId TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    passwordHash TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    token TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )
`>;

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

type MarkRecord = Schema<`
  CREATE TABLE markRecord (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT NOT NULL,
    costCredits REAL NOT NULL DEFAULT 1.0,
    createdAt TEXT NOT NULL,
    confirmedAt TEXT
  )
`>;

type _Mi = AssertTrue<'id' extends keyof MarkRecord ? true : false>;
type _Mu = AssertTrue<'userId' extends keyof MarkRecord ? true : false>;
type _Mc = AssertTrue<'costCredits' extends keyof MarkRecord ? true : false>;
type _Mcr = AssertTrue<'createdAt' extends keyof MarkRecord ? true : false>;
type _MCo = AssertTrue<'confirmedAt' extends keyof MarkRecord ? true : false>;

type _MrkConfirmedNull  = AssertTrue<null extends MarkRecord['confirmedAt'] ? true : false>;
type _MrkCreatedAtNull  = AssertFalse<null extends MarkRecord['createdAt'] ? true : false>;

// ── creditTransaction table ──

type CreditTx = Schema<`
  CREATE TABLE creditTransaction (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT NOT NULL,
    amountMoney INTEGER NOT NULL,
    amountCredits INTEGER NOT NULL,
    description TEXT,
    createdAt TEXT NOT NULL
  )
`>;

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
};

type _TblUser = AssertTrue<'user' extends keyof Tables ? true : false>;
type _TblMrk = AssertTrue<'markRecord' extends keyof Tables ? true : false>;
type _TblCt = AssertTrue<'creditTransaction' extends keyof Tables ? true : false>;
type _TblConfirmedNull = AssertTrue<null extends Tables['markRecord']['confirmedAt'] ? true : false>;
type _TblDescNull = AssertTrue<null extends Tables['creditTransaction']['description'] ? true : false>;

// ── ParseTableName ──

type _PtnUser = AssertTrue<
  'user' extends ParseTableName<'SELECT * FROM user WHERE id = ?'> ? true : false
>;
type _PtnMarkRecord = AssertTrue<
  'markRecord' extends ParseTableName<'SELECT * FROM markRecord WHERE userId = ?'> ? true : false
>;
type _PtnNoWhere = AssertTrue<
  'creditTransaction' extends ParseTableName<'SELECT * FROM creditTransaction'> ? true : false
>;

// ── SelectResult ──

type _SrUserKey = AssertTrue<'externalUserId' extends keyof SelectResult<'SELECT * FROM user WHERE id = ?'>[number] ? true : false>;
type _SrMrkKey = AssertTrue<'userId' extends keyof SelectResult<'SELECT * FROM markRecord'>[number] ? true : false>;
type _SrUserVal = AssertFalse<null extends SelectResult<'SELECT * FROM user WHERE id = ?'>[number]['externalUserId'] ? true : false>;
type _SrMrkNull = AssertTrue<null extends SelectResult<'SELECT * FROM markRecord'>[number]['confirmedAt'] ? true : false>;

// ── WhereParams ──

type _WpUser = AssertTrue<
  'externalUserId' extends keyof WhereParams<'SELECT * FROM user WHERE externalUserId = ?'> ? true : false
>;
type _WpUserType = AssertFalse<
  null extends WhereParams<'SELECT * FROM user WHERE externalUserId = ?'>['externalUserId'] ? true : false
>;
type _WpNoWhere = AssertTrue<
  keyof WhereParams<'SELECT * FROM user'> extends never ? true : false
>;
type _WpMulti = AssertTrue<
  'id' extends keyof WhereParams<'SELECT * FROM markRecord WHERE id = ? AND userId = ?'> ? true : false
>;
