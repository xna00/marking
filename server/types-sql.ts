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

// ── INSERT parser ──

type ParseInsertTableName<S extends string> =
  S extends `INSERT OR REPLACE INTO ${infer Rest}` ? FirstWord<Rest>
  : S extends `INSERT INTO ${infer Rest}` ? FirstWord<Rest>
  : never;

// ── Table-generic types ──

type TableSchema = Record<string, unknown>;

// Map parameter name union to Record<name, type> via table schema
type NamesToRecord<Names extends string, TName extends keyof T, T extends Record<string, TableSchema>> = {
  [K in Names & keyof T[TName]]: T[TName][K]
};

// Result type: SELECT * → T[table][], SELECT cols → Pick<T[table], cols>[]
export type SelectResult<S extends string, T extends Record<string, TableSchema>> =
  ParseTableName<S> extends keyof T
    ? ParseIsStar<S> extends true
      ? T[ParseTableName<S>][]
      : Pick<T[ParseTableName<S>], ParseColNames<S>>[]
    : never;

export type WhereParams<S extends string, T extends Record<string, TableSchema>> =
  ParseTableName<S> extends keyof T
    ? NamesToRecord<AtParams<S>, ParseTableName<S>, T>
    : {};

export type InsertParams<S extends string, T extends Record<string, TableSchema>> =
  ParseInsertTableName<S> extends keyof T
    ? NamesToRecord<AtParams<S>, ParseInsertTableName<S>, T>
    : {};

