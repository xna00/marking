// ═══════════════════════════════════════════════
//  类型级 SQL 解析器
//
//  约定：
//   - 关键字一律大写（SELECT, FROM, WHERE, INSERT...）
//   - 所有表名必须写别名：FROM user AS u, UPDATE user AS u
//   - 所有 SELECT 列必须写别名：u.id AS id, COUNT(*) AS cnt
//   - 参数类型从 `alias.col = @param` 推导，参数名可任意
//   - @name 后紧跟 , 或 )，不留空格（如 @a,@b / @a)）
//   - 传参用 object（node:sqlite 原生支持命名参数，无需关心顺序）
//   - SELECT 必须带 WHERE，至少 WHERE 1=1，这简化了 FROM 子句提取
//   - SELECT 结果 always T[]（.all() 语义）
//   - 表名后必须跟一个空格，即使 SQL 在此结束（如 'SELECT * FROM user AS u '）
//   - SELECT 列列表逗号后跟一个空格：col1, col2
// ═══════════════════════════════════════════

/**
 * Expand a computed type for IDE display (no aliases, no `&`)
 */
export type O<T> = { [K in keyof T]: T[K] };

/**
 * SqlType<"TEXT"> → string
 *
 * SqlType<"INTEGER"> → number
 *
 * SqlType<"REAL"> → number
 */
type SqlType<T extends string> =
  T extends `INTEGER${string}` ? number
  : T extends `INT${string}` ? number
  : T extends `REAL${string}` ? number
  : T extends `FLOAT${string}` ? number
  : T extends `TEXT${string}` ? string
  : T extends `BLOB${string}` ? Uint8Array
  : never;

/**
 * TypeWord<["TEXT", "NOT", "NULL"]> → "TEXT"
 */
type TypeWord<Words extends string[]> =
  Words extends [infer W extends string, ...infer Rest extends string[]]
    ? W extends 'NOT' | 'NULL' | 'PRIMARY' | 'KEY' | 'UNIQUE' | 'REFERENCES'
        | 'DEFAULT' | 'CHECK' | 'AUTOINCREMENT' | '' | `\n${string}`
      ? TypeWord<Rest>
      : W
    : never;

/**
 * ColNameType<"name TEXT NOT NULL"> → ["name", "TEXT"]
 */
type ColNameType<S extends string> =
  S extends `${infer Name} ${infer Rest}`
    ? [Name, TypeWord<Split<Rest, ' '>>]
    : never;

/**
 * Split<"a b c", " "> → ["a", "b", "c"]
 */
type Split<S extends string, Sep extends string, Acc extends string[] = []> =
  S extends `${infer Head}${Sep}${infer Tail}`
    ? Split<Tail, Sep, [...Acc, Head]>
    : S extends '' ? Acc : [...Acc, S];

/**
 * ColNullable<"name TEXT NOT NULL"> → never
 *
 * ColNullable<"name TEXT"> → null
 */
type ColNullable<S extends string> =
  S extends `${string}NOT NULL${string}` ? never
  : S extends `${string}PRIMARY KEY${string}` ? never
  : null;

/**
 * ColToField<"name TEXT NOT NULL"> → { name: string }
 *
 * ColToField<"email TEXT"> → { email: string | null }
 */
type ColToField<S extends string> =
  ColNameType<S> extends [infer N extends string, infer T extends string]
    ? Record<N, SqlType<T> | ColNullable<S>>
    : {};

/**
 * ParseCols<"\nid INTEGER PRIMARY KEY,\nname TEXT NOT NULL"> → { id: number; name: string }
 *
 * Strips leading \n, splits by ,\n, then folds each column into one record.
 */
type ParseCols<S extends string> =
  S extends `\n${infer Rest}`
    ? ParseColsList<Split<Rest, `,\n`>>
    : {};

type ParseColsList<Parts extends string[], Acc extends Record<string, unknown> = {}> =
  Parts extends [infer P extends string, ...infer Rest extends string[]]
    ? ParseColsList<Rest, Acc & ColToField<P>>
    : Acc;

/**
 * Schema<"CREATE TABLE user (id INTEGER PRIMARY KEY, name TEXT NOT NULL)">
 *   → { user: { id: number; name: string } }
 *
 * Schema<"CREATE TEMP TABLE IF NOT EXISTS log (msg TEXT)">
 *   → { log: { msg: string | null } }
 */
export type Schema<S extends string> =
  S extends `CREATE${string}TABLE ${'IF NOT EXISTS ' | ''}${infer Name} (${infer Cols})${string}`
    ? Record<Name, O<ParseCols<Cols>>>
    : {};

// ── @name parameter scanner ──

/**
 * FirstWord<"user WHERE id = @id"> → "user"
 *
 * Space-first: for SQL keywords (INSERT/SELECT/UPDATE/... followed by space)
 */
type FirstWord<S extends string> =
  S extends `${infer W} ${infer _}` ? W
  : S extends `${infer W},${infer _}` ? W
  : S extends `${infer W})${infer _}` ? W
  : S extends `${infer W};${infer _}` ? W
  : S;

/**
 * ParamName<"externalUserId, @username)"> → "externalUserId"
 *
 * Comma/paren-first: for @name params (name immediately followed by , or ) or space)
 */
type ParamName<S extends string> =
  S extends `${infer N},${infer _}` ? N
  : S extends `${infer N})${infer _}` ? N
  : S extends `${infer N};${infer _}` ? N
  : S extends `${infer N} ${infer _}` ? N
  : S;

/**
 * AtParams<"SELECT * FROM user WHERE id = @id"> → "id"
 *
 * AtParams<"INSERT INTO user (name) VALUES (@name)"> → "name"
 */
type AtParams<S extends string> = _AtParams<Split<S, '@'>>;

/**
 * _AtParams<["id", "name"], never> → "id" | "name"
 */
type _AtParams<Parts extends string[], Acc extends string = never> =
  Parts extends [infer _P, ...infer Tail extends string[]]
    ? Tail extends [infer T extends string, ...infer Rest extends string[]]
      ? _AtParams<Tail, Acc | ParamName<T>>
      : Acc
    : Acc;

// ── Table alias map ──

type _TblAlias<S extends string> =
  S extends `${infer Tbl} AS ${infer A} ON ${string}` ? [Tbl, FirstWord<A>]
  : S extends `${infer Tbl} AS ${infer A}` ? [Tbl, FirstWord<A>]
  : never;

type _NewTables<Parts extends string[], Tables extends {}, Acc extends {} = {}> =
  Parts extends [infer F extends string, ...infer R extends string[]]
    ? _TblAlias<F> extends [infer N extends string, infer A extends string]
      ? N extends keyof Tables
        ? _NewTables<R, Tables, Acc & Record<A, Tables[N]>>
        : _NewTables<R, Tables, Acc>
      : _NewTables<R, Tables, Acc>
    : Acc;

/**
 * BuildAliasMap<"SELECT * FROM user AS u WHERE u.id = @id", Tables>
 *   → { u: Tables['user'] }
 *
 * BuildAliasMap<"SELECT u.id AS id, o.order_id AS oid FROM user AS u LEFT JOIN order_record AS o ON u.id = o.user_id", Tables>
 *   → { u: Tables['user']; o: Tables['order_record'] }
 */
type BuildAliasMap<S extends string, Tables extends {}> =
  S extends `SELECT ${string} FROM ${infer Before} WHERE ${string}`
    ? _NewTables<Split<Before, ' JOIN '>, Tables>
  : {};

// ── Column helpers ──

type ColsString<S extends string> =
  S extends `SELECT DISTINCT ${infer Cols} FROM${string}` ? Cols
  : S extends `SELECT ${infer Cols} FROM${string}` ? Cols
  : never;

/**
 * ColType<"u.id", { u: Tables['user'] }> → Tables['user']['id']
 *
 * ColType<"COUNT(*)", ...> → number
 *
 * ColType<"u.age + 10", ...> → unknown
 */
type ColType<Expr extends string, Aliases extends {}> =
  Expr extends `${infer T}.${infer C}`
    ? T extends keyof Aliases
      ? C extends keyof Aliases[T]
        ? Aliases[T][C]
        : never
      : never
    : Expr extends `${string}COUNT(${string}` ? number
    : Expr extends `${string}SUM(${string}` ? number
    : Expr extends `${string}AVG(${string}` ? number
    : Expr extends `${string}MAX(${string}` ? number
    : Expr extends `${string}MIN(${string}` ? number
    : Expr extends `${string}GROUP_CONCAT(${string}` ? number
    : unknown;

type _Col<S extends string, Aliases extends {}> =
  S extends `${infer Expr} AS ${infer Name}`
    ? Record<FirstWord<Name>, ColType<Expr, Aliases>>
    : {};

type _Cols<Parts extends string[], Aliases extends {}, Acc = {}> =
  Parts extends [infer F extends string, ...infer R extends string[]]
    ? _Cols<R, Aliases, Acc & _Col<F, Aliases>>
    : Acc;

type _UnionToIntersection<U> =
  (U extends unknown ? (arg: U) => void : never) extends (arg: infer I) => void ? I : never;

/**
 * SelectResult<"SELECT * FROM user AS u", Tables> → Tables['user'][]
 *
 * SelectResult<"SELECT u.id AS id, u.email AS email FROM user AS u", Tables>
 *   → { id: number; email: string | null }[]
 *
 * SelectResult<"SELECT DISTINCT u.username AS name FROM user AS u", Tables>
 *   → { name: string }[]
 */
export type SelectResult<S extends string, T extends {}> =
  ColsString<S> extends infer RawCols extends string
    ? BuildAliasMap<S, T> extends infer AliasMap extends {}
      ? RawCols extends '*'
        ? _UnionToIntersection<AliasMap[keyof AliasMap]>[]
        : _Cols<Split<RawCols, ', '>, AliasMap>[]
      : never
    : never;

// ── Param type resolution ──

/**
 * _TableName<"SELECT * FROM user WHERE id = @id"> → "user"
 *
 * _TableName<"INSERT INTO user (name) VALUES (@name)"> → "user"
 *
 * _TableName<"INSERT OR REPLACE INTO kfCursor (k) VALUES (@k)"> → "kfCursor"
 *
 * _TableName<"UPDATE user SET token = @token"> → "user"
 */
type _TableName<S extends string> =
  S extends `INSERT OR REPLACE INTO ${infer Name} ${string}` ? FirstWord<Name>
  : S extends `INSERT INTO ${infer Name} ${string}` ? FirstWord<Name>
  : S extends `DELETE FROM ${infer Name} ${string}` ? FirstWord<Name>
  : S extends `UPDATE ${infer Name} SET ${string}` ? FirstWord<Name>
  : S extends `SELECT ${string} FROM ${infer Name} ${string}` ? FirstWord<Name>
  : never;

/** @internal re-export for test compatibility */
export type ParseTableName<S extends string> = _TableName<S>;

type _FindColFromParam<S extends string, P extends string> =
  S extends `${string}${infer A}.${infer C} = @${P}${string}`
    ? [A, C]
    : never;

type _FallbackType<S extends string, P extends string, T extends {}> =
  _TableName<S> extends keyof T
    ? P extends keyof T[_TableName<S> & keyof T]
      ? T[_TableName<S> & keyof T][P & keyof T[_TableName<S> & keyof T]]
      : never
    : never;

type _ParamType<S extends string, P extends string, T extends {}> =
  _FindColFromParam<S, P> extends [infer A extends string, infer C extends string]
    ? A extends keyof BuildAliasMap<S, T>
      ? C extends keyof BuildAliasMap<S, T>[A]
        ? BuildAliasMap<S, T>[A][C]
        : _FallbackType<S, P, T>
      : _FallbackType<S, P, T>
    : _FallbackType<S, P, T>;

/**
 * WhereParams<
 *   "SELECT * FROM user AS u WHERE u.externalUserId = @euid",
 *   Tables
 * > → { euid: string }
 */
export type WhereParams<S extends string, T extends {}> =
  _TableName<S> extends keyof T
    ? { [P in AtParams<S>]: _ParamType<S, P, T> }
    : {};

// ── SQL method result types ──

type DmlResult = { lastInsertRowid: number; changes: number };

/**
 * SqlAllResult<"SELECT * FROM user AS u ", Tables>
 *   → Tables['user'][]
 *
 * SqlAllResult<"SELECT COUNT(*) AS count FROM markRecord AS mr ", Tables>
 *   → { count: number }[]
 *
 * SqlAllResult<"INSERT INTO user (id) VALUES (@id)", Tables>
 *   → never
 */
export type SqlAllResult<S extends string, T extends {}> =
  S extends `SELECT${string}`
    ? SelectResult<S, T>
    : never;

/**
 * SqlGetResult<"SELECT * FROM user AS u WHERE u.id = @id", Tables>
 *   → Tables['user'] | undefined
 *
 * SqlGetResult<"INSERT INTO user (id) VALUES (@id)", Tables>
 *   → undefined
 */
export type SqlGetResult<S extends string, T extends {}> =
  SqlAllResult<S, T>[number] | undefined;

/**
 * SqlRunResult<"INSERT INTO user ...", Tables>
 *   → { lastInsertRowid: number; changes: number }
 *
 * SqlRunResult<"UPDATE user SET ...", Tables>
 *   → { lastInsertRowid: number; changes: number }
 *
 * SqlRunResult<"DELETE FROM ...", Tables>
 *   → { lastInsertRowid: number; changes: number }
 *
 * SqlRunResult<"SELECT * FROM user AS u ", Tables>
 *   → never
 */
export type SqlRunResult<S extends string, T extends {}> =
  S extends `${'INSERT' | 'UPDATE' | 'DELETE'}${string}`
    ? DmlResult
    : never;

// ── TypedDb ──

import { DatabaseSync } from "node:sqlite";

export class TypedDb<S extends {}> {
  constructor(private db: DatabaseSync) {}

  prepare<const T extends string>(sql: T) {
    const stmt = this.db.prepare(sql);
    return {
      all: (params: WhereParams<T, S>): SqlAllResult<T, S> =>
        stmt.all(params as any) as SqlAllResult<T, S>,
      get: (params: WhereParams<T, S>): SqlGetResult<T, S> =>
        stmt.get(params as any) as SqlGetResult<T, S>,
      run: (params: WhereParams<T, S>): SqlRunResult<T, S> =>
        stmt.run(params as any) as SqlRunResult<T, S>,
    };
  }
}