import { DatabaseSync } from "node:sqlite";

// ═══════════════════════════════════════════════════════
//  类型级 SQL 解析器
//
//  约定：
//   - 关键字一律大写（SELECT, FROM, WHERE, INSERT...）
//   - 表名直接写，无需别名：FROM user, UPDATE user
//   - SELECT 列用 table.col AS name：user.id AS id, COUNT(*) AS cnt
//   - 参数类型从 `alias.col = @param` 推导，参数名可任意
//   - @name 后紧跟 , 或 )，不留空格（如 @a,@b / @a)）
//   - 传参用 object（node:sqlite 原生支持命名参数，无需关心顺序）
//   - SELECT 结果 always T[]（.all() 语义）
//   - SELECT 列列表逗号后跟一个空格：col1, col2
//   - SELECT 必须用以下完整模板，缺一不可：
//       SELECT {ALL|DISTINCT} <cols>
//         FROM <table>
//         WHERE <condition>
//         GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0
//     其中 GROUP BY/HAVING/ORDER BY/LIMIT/OFFSET 可替换实际值
// ═══════════════════════════════════════════════════════

// ── Column type mapping ──

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

// ── SELECT pattern match ──

type _MatchSelect<S extends string> =
  S extends `SELECT ${'ALL' | 'DISTINCT'} ${infer Cols} FROM ${infer FromClause} WHERE ${infer WhereClause} GROUP BY ${infer _GroupBy} HAVING ${infer Having} ORDER BY ${infer _OrderBy} LIMIT ${infer Limit} OFFSET ${infer Offset}`
  ? { cols: Cols; from: FromClause; where: WhereClause; limit: Limit; offset: Offset }
  : never;

// ── DML pattern match ──

type _MatchInsert<S extends string> =
  S extends `INSERT${' OR REPLACE' | ''} INTO ${infer Tbl} (${infer Cols}) VALUES (${infer Values})`
  ? { table: Tbl; cols: Cols; values: Values }
  : never;

type _MatchUpdate<S extends string> =
  S extends `UPDATE ${infer Tbl} SET ${infer SetClause} WHERE ${infer WhereClause}`
  ? { table: Tbl; set: SetClause; where: WhereClause }
  : never;

type _MatchDelete<S extends string> =
  S extends `DELETE FROM ${infer Tbl} WHERE ${infer WhereClause}`
  ? { table: Tbl; where: WhereClause }
  : never;

// ── Column resolution ──

type FlatSplit<SS extends string[], Sep extends string, R extends string[] = []> =
  SS extends [infer First extends string, ...infer Rest extends string[]]
  ? FlatSplit<Rest, Sep, [...R, ...Split<First, Sep>]>
  : R;

type _ExtractTableName<T extends string> =
  T extends `${infer Tbl} ON ${string}` ? Tbl : T;

type _NewTables<FromClause extends string, Tables extends {}> =
  Pick<Tables,
    _ExtractTableName<
      FlatSplit<FlatSplit<[FromClause], " LEFT JOIN ">, " INNER JOIN ">[number]
    > & keyof Tables
  >;

type _AggFuncs = 'COUNT' | 'SUM' | 'AVG' | 'MAX' | 'MIN' | 'GROUP_CONCAT';

/**
 * ColType<"user.id", { user: Tables['user'] }> → Tables['user']['id']
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
  : Expr extends `${string}${_AggFuncs}(${string}` ? number
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
 * SelectResult<"SELECT ALL * FROM user WHERE 1=1 GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0", Tables>
 *   → Tables['user'][]
 *
 * SelectResult<"SELECT ALL user.id AS id, user.email AS email FROM user WHERE 1=1 GROUP BY 1 HAVING 1=1 ORDER BY 1 LIMIT -1 OFFSET 0", Tables>
 *   → { id: number; email: string | null }[]
 */
export type SelectResult<S extends string, Tbls extends {}> =
  _MatchSelect<S> extends { cols: infer RawCols extends string; from: infer FromClause extends string }
  ? _NewTables<FromClause, Tbls> extends infer AliasMap extends {}
  ? RawCols extends '*'
  ? _UnionToIntersection<AliasMap[keyof AliasMap]>[]
  : _Cols<Split<RawCols, ', '>, AliasMap>[]
  : never
  : never;

// ── Param type resolution ──

type AtParamName<N extends string> = N extends `@${infer M extends string}` ? M : never

type ParamTypes<S extends string, Sep extends string, Tbl extends {}> =
  { [K in AtParamName<Split<S, Sep>[number]> & keyof Tbl]: Tbl[K] };

export type RunParams<S extends string, Tbls extends {}> =
  S extends `INSERT${string}`
  ? (_MatchInsert<S> extends infer M extends { table: keyof Tbls, values: string }
      ? ParamTypes<M['values'], ", ", Tbls[M['table']] & {}>
      : never)
  : S extends `UPDATE${string}`
    ? (_MatchUpdate<S> extends infer M extends { table: keyof Tbls, set: string, where: string }
        ? Condition<Split<M["set"], ", ">, Tbls> & WhereParams<M['where'], Tbls>
        : never)
  : S extends `DELETE${string}`
    ? (_MatchDelete<S> extends infer M extends { where: string }
        ? WhereParams<M['where'], Tbls>
        : never)
  : never;

type WhereParams<W extends string, Tbls extends {}> = Condition<FlatSplit<FlatSplit<[W], ' OR '>, ' AND '>, Tbls>

export type Params<S extends string, Tbls extends {}> =
  _MatchSelect<S> extends infer W extends { where: string; limit: string; offset: string }
  ? WhereParams<W['where'], Tbls> & { [K in AtParamName<W['limit'] | W['offset']>]: number }
  : never;

// ── Condition（WHERE 条件参数提取）──

type TblsPick<Tbls extends {}, Tbl, Column> = Tbls[Tbl & keyof Tbls][Column & keyof Tbls[Tbl & keyof Tbls]];

type Condition<SS extends string[], Tbls extends {}, R extends {} = {}> =
  SS extends [infer First extends string, ...infer Rest extends string[]]
  ? (
    First extends `${infer Table}.${infer Column} NOT IN (${infer Name})`
      ? Condition<Rest, Tbls, R & { [K in AtParamName<Split<Name, ", ">[number]>]: TblsPick<Tbls, Table, Column> }>
    : First extends `${infer Table}.${infer Column} IN (${infer Name})`
      ? Condition<Rest, Tbls, R & { [K in AtParamName<Split<Name, ", ">[number]>]: TblsPick<Tbls, Table, Column> }>
    : First extends `${infer Table}.${infer Column} ${infer Op} @${infer Name}`
      ? Condition<Rest, Tbls, R & (
          Op extends ("=" | ">=" | "<=" | "!=" | "<>" | ">" | "<")
          ? { [K in Name]: TblsPick<Tbls, Table, Column> }
          : {}
        )>
    : Condition<Rest, Tbls, R>
  )
  : R;

// ── SQL method result types ──

type DmlResult = { lastInsertRowid: number; changes: number };

export type SqlAllResult<S extends string, Tbls extends {}> =
  S extends `SELECT${string}`
  ? SelectResult<S, Tbls>
  : never;

export type SqlGetResult<S extends string, Tbls extends {}> =
  SqlAllResult<S, Tbls>[number] | undefined;

export type SqlRunResult<S extends string, Tbls extends {}> =
  S extends `${'INSERT' | 'UPDATE' | 'DELETE'}${string}`
  ? DmlResult
  : never;

// ── TypedDb ──

export type O<T> = { [K in keyof T]: T[K] };

export class TypedDb<S extends {}> {
  #db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.#db = db;
  }

  prepare<const T extends string>(sql: T) {
    const stmt = this.#db.prepare(sql);
    return {
      all: (params: Params<T, S>): SqlAllResult<T, S> =>
        stmt.all(params as any) as SqlAllResult<T, S>,
      get: (params: Params<T, S>): SqlGetResult<T, S> =>
        stmt.get(params as any) as SqlGetResult<T, S>,
      run: (params: RunParams<T, S>): SqlRunResult<T, S> =>
        stmt.run(params as any) as SqlRunResult<T, S>,
    };
  }
}
