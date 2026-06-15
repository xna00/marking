// ═══════════════════════════════════════════════
//  类型级 SQL 解析器
//
//  约定：
//   - 关键字一律大写（SELECT, FROM, WHERE, INSERT...）
//   - 参数用 @name，name = 列名，如 WHERE id = @id
//   - @name 后紧跟 , 或 )，不留空格（如 @a,@b / @a)）
//   - 传参用 object（node:sqlite 原生支持命名参数，无需关心顺序）
//   - SELECT 结果 always T[]（.all() 语义）
//   - 表名后必须跟一个空格，即使 SQL 在此结束（如 'SELECT * FROM user '）
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

// ── SELECT parser ──

/**
 * ParseTableName<"SELECT * FROM user WHERE id = @id"> → "user"
 *
 * ParseTableName<"INSERT INTO user (name) VALUES (@name)"> → "user"
 *
 * ParseTableName<"INSERT OR REPLACE INTO kfCursor (k) VALUES (@k)"> → "kfCursor"
 *
 * ParseTableName<"UPDATE user SET token = @token"> → "user"
 *
 * Table name must be followed by exactly one space (see conventions).
 */
export type ParseTableName<S extends string> =
  S extends `INSERT OR REPLACE INTO ${infer Name} ${string}` ? Name
  : S extends `INSERT INTO ${infer Name} ${string}` ? Name
  : S extends `DELETE FROM ${infer Name} ${string}` ? Name
  : S extends `UPDATE ${infer Name} SET ${string}` ? Name
  : S extends `SELECT ${string} FROM ${infer Name} ${string}` ? Name
  : never;

/**
 * ParseIsStar<"SELECT * FROM user"> → true
 *
 * ParseIsStar<"SELECT name FROM user"> → false
 */
type ParseIsStar<S extends string> =
  S extends `SELECT ${infer Rest}`
    ? Rest extends `*${string}` ? true : false
    : false;

/**
 * ParseColNames<"SELECT name,email FROM user"> → "name" | "email"
 */
type ParseColNames<S extends string> =
  S extends `SELECT ${infer Rest}`
    ? Rest extends `${infer Cols} FROM ${string}`
      ? _SplitCols<Cols>
      : never
    : never;

/**
 * _SplitCols<"a,b,c"> → "a" | "b" | "c"
 */
type _SplitCols<S extends string> =
  S extends `${infer C},${infer Rest}` ? C | _SplitCols<Rest>
  : S;

// ── Table-generic types ──

/**
 * TableSchema used as the table row shape constraint.
 */
type TableSchema = Record<string, unknown>;

/**
 * NamesToRecord<"id" | "name", "user", Tables> → { id: number; name: string }
 */
type NamesToRecord<Names extends string, TName extends keyof T, T extends Record<string, TableSchema>> = {
  [K in Names & keyof T[TName]]: T[TName][K]
};

/**
 * SelectResult<"SELECT * FROM user", Tables> → Tables['user'][]
 *
 * SelectResult<"SELECT username,email FROM user", Tables> → Pick<Tables['user'], 'username' | 'email'>[]
 */
export type SelectResult<S extends string, T extends Record<string, TableSchema>> =
  ParseTableName<S> extends keyof T
    ? ParseIsStar<S> extends true
      ? T[ParseTableName<S>][]
      : Pick<T[ParseTableName<S>], ParseColNames<S>>[]
    : never;

/**
 * WhereParams<
 *   "SELECT * FROM user WHERE id = @id" |
 *   "INSERT INTO user (id,name) VALUES (@id,@name)" |
 *   "UPDATE user SET email = @email WHERE externalUserId = @uid",
 *   Tables
 * > → { id: number } | { id: number; name: string } | { email: string | null; externalUserId: string }
 */
export type WhereParams<S extends string, T extends Record<string, TableSchema>> =
  ParseTableName<S> extends keyof T
    ? NamesToRecord<AtParams<S>, ParseTableName<S>, T>
    : {};

// ── Aggregate SELECT parser ──

/**
 * IsAggSelect<"SELECT COUNT(*) as cnt FROM markRecord"> → true
 * IsAggSelect<"SELECT username FROM user"> → false
 */
type IsAggSelect<S extends string> =
  S extends `${string}COUNT(${string}` ? true
  : S extends `${string}SUM(${string}` ? true
  : false;

/**
 * ParseAggAliases<"SELECT COUNT(*) as count FROM markRecord"> → "count"
 *
 * ParseAggAliases<"SELECT COALESCE(SUM(costCredits), 0) as total FROM markRecord"> → "total"
 */
export type ParseAggAliases<S extends string> =
  S extends `SELECT ${infer Cols} FROM ${string}`
    ? _ParseAliases<Cols>
    : never;

type _ParseAliases<S extends string> =
  S extends `${infer A}, ${infer Rest}`
    ? _ParseAlias<A> | _ParseAliases<Rest>
    : _ParseAlias<S>;

type _ParseAlias<S extends string> =
  S extends `${string} as ${infer Alias}` ? FirstWord<Alias>
  : never;

// ── SQL method result types ──

type DmlResult = { lastInsertRowid: number; changes: number };

/**
 * SqlAllResult<"SELECT * FROM user ", Tables>
 *   → Tables['user'][]
 *
 * SqlAllResult<"SELECT COUNT(*) as count FROM markRecord ", Tables>
 *   → { count: number }[]
 *
 * SqlAllResult<"INSERT INTO user ...", Tables>
 *   → never
 *
 * Maps to runSql(sql, tables).all().
 */
export type SqlAllResult<S extends string, T extends Record<string, TableSchema>> =
  S extends `SELECT${string}`
    ? IsAggSelect<S> extends true
      ? Record<ParseAggAliases<S>, number>[]
      : SelectResult<S, T>
    : never;

/**
 * SqlGetResult<"SELECT * FROM user WHERE id = @id", Tables>
 *   → Tables['user'] | undefined
 *
 * SqlGetResult<"INSERT INTO user ...", Tables>
 *   → undefined
 *
 * Maps to runSql(sql, tables).get().
 */
export type SqlGetResult<S extends string, T extends Record<string, TableSchema>> =
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
 * SqlRunResult<"SELECT * FROM user", Tables>
 *   → never
 *
 * Maps to runSql(sql, tables).run().
 */
export type SqlRunResult<S extends string, T extends Record<string, TableSchema>> =
  S extends `${'INSERT' | 'UPDATE' | 'DELETE'}${string}`
    ? O<DmlResult>
    : never;

// ── Runtime functions ──

import { DatabaseSync } from "node:sqlite";

export function sqlAll<const S extends string, T extends Record<string, Record<string, unknown>>>(
  db: DatabaseSync,
  sql: S,
  params: WhereParams<S, T>,
): SqlAllResult<S, T> {
  return db.prepare(sql).all(params as any) as SqlAllResult<S, T>;
}

export function sqlGet<const S extends string, T extends Record<string, Record<string, unknown>>>(
  db: DatabaseSync,
  sql: S,
  params: WhereParams<S, T>,
): SqlGetResult<S, T> {
  return db.prepare(sql).get(params as any) as SqlGetResult<S, T>;
}

export function sqlRun<const S extends string, T extends Record<string, Record<string, unknown>>>(
  db: DatabaseSync,
  sql: S,
  params: WhereParams<S, T>,
): SqlRunResult<S, T> {
  return db.prepare(sql).run(params as any) as SqlRunResult<S, T>;
}