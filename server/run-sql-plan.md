# runSql 实现计划

## 目标

```ts
const users = runSql('SELECT * FROM user WHERE id = ?', { id: 1 })
//    ^ type: Tables['user'][]  (always array — .all() 语义)

const inserted = runSql(
  'INSERT INTO user (externalUserId, username, passwordHash) VALUES (?, ?, ?)',
  { externalUserId: 'abc', username: 'test', passwordHash: 'hash' }
)
//    ^ type: { lastInsertRowid: number; changes: number }
```

## 设计决策

| 项目 | 选择 | 原因 |
|------|------|------|
| 参数传递 | object `{ col: value }` | 语义清晰，调用方不用数 `?` 顺序 |
| SELECT 结果 | 全部按 `.all()` 返回 `T[]` | 统一 API，调用方自行 `.at(0)` 取单行 |
| 运行时 | 纯函数，内部 `getDb().prepare().run() / .all()` | 零依赖，复用现有连接 |

## 关键问题

### 如何推导参数类型

SQL 中的 `?` 没有名字，需要从上下文推断对应的列名，从而查到 `Tables[table][col]` 的类型。

常见模式（Phase 1 支持）：

```
WHERE col = ?         →  col 是列名，? 类型 = Tables[table][col]
INSERT INTO t (a,b) VALUES (?, ?)  →  第 n 个 ? 对应第 n 个列名
UPDATE t SET a = ?    →  a 是列名，? 类型 = Tables[table][a]
```

暂不支持的复杂模式：

```
WHERE col + ? = 1     →  难以推断列名
WHERE col IN (?, ?)   →  两个 ? 对应同列，tuple 而非 object
```

### INSERT 返回值类型

`stmt.run()` 返回 `{ lastInsertRowid: number | bigint; changes: number }`。
类型层面统一为 `{ lastInsertRowid: number; changes: number }`。

### UPDATE / DELETE 返回值类型

同 INSERT，`{ changes: number }`。无 `lastInsertRowid`，但为统一返回相同结构。

## 阶段划分

### Phase 1：基础框架 + `SELECT * FROM <table> WHERE col = ?`

- `types-sql.ts`：新增类型级 SELECT 解析器

  ```
  ParseTableName<S>       → 从 "SELECT * FROM user WHERE ..." 提取 'user'
  ParseWhereParam<S>      → 从 "WHERE id = ? AND name = ?" 提取 { id: unknown, name: unknown }
  SelectParams<S>         → 根据列名查 Table 得到具体类型 { id: string, name: string | null }
  SelectResult<S>         → Tables[ParseTableName<S>][]  （always array）
  ```

- `db.ts`：新增 `runSql` 函数

  ```ts
  // 运行时
  export function runSql<S extends string>(
    sql: S,
    params: SelectParams<S>,
  ): SelectResult<S> | { lastInsertRowid: number; changes: number } {
    const stmt = getDb().prepare(sql);
    const isSelect = /^\s*SELECT/i.test(sql);
    if (isSelect) return stmt.all(Object.values(params)) as any;
    return stmt.run(...Object.values(params)) as any;
  }
  ```

  运行时不关心类型参数——类型推导全靠函数签名。签名和运行时分离：

  ```ts
  // db.ts (运行时实现)
  export function runSql(sql: string, params: Record<string, unknown>): unknown {
    const stmt = getDb().prepare(sql);
    if (/^\s*SELECT/i.test(sql)) return stmt.all(Object.values(params));
    return stmt.run(...Object.values(params));
  }
  ```

  ```ts
  // types-sql.ts (类型推导)
  export type RunSqlResult<S extends string> =
    IsSelect<S> extends true ? SelectResult<S>[]
    : { lastInsertRowid: number; changes: number };

  export type RunSqlParams<S extends string> =
    IsSelect<S> extends true ? SelectParams<S>
    : WhereParams<S>;
  ```

  但是 TypeScript 不支持函数签名和实现分离后的泛型推导同时工作（declare + implement 会导致实现签名覆盖声明）。所以需要 **overload**：

  ```ts
  // db.ts
  export function runSql<S extends string>(
    sql: S,
    params: RunSqlParams<S>,
  ): RunSqlResult<S>;
  export function runSql(sql: string, params: Record<string, unknown>): unknown {
    // runtime implementation
  }
  ```

  overload 的缺点是参数类型推导不够好（TS 对 overload 的 `infer` 支持有限），可能需要把类型参数显式传递或使用更简单的签名。

  **替代方案**：类型层和运行时层解耦，用户手动指定类型：

  ```ts
  const users = runSql<User>('SELECT * FROM user WHERE id = ?', { id: 1 });
  ```

  但这失去了类型自动推导的乐趣。先尝试 overload，不行再退化为手动传类型。

### Phase 2：INSERT / UPDATE 参数类型

```
INSERT INTO user (col1, col2) VALUES (?, ?)  → { col1: ..., col2: ... }
UPDATE user SET col1 = ?, col2 = ? WHERE id = ?  → { col1: ..., col2: ..., id: ... }
```

### Phase 3：`INSERT` 返回值区分（是否需要 lastInsertRowid）

### Phase 4：`SELECT col1, col2 FROM table` 列选取

```ts
type SelectCols<S> = ParseColNames<S>       // 'id' | 'userId'
type SelectResult<S> = Pick<Tables[table], SelectCols<S>>
```

### Phase 5：`LIMIT 1` 推断单行语义（可选，优先级低）

## 风险

| 风险 | 缓解 |
|------|------|
| overload 函数签名 + 泛型推导效果差 | 退化为 `runSql<T>(sql, params)` 手动传类型，保留 `RunSqlParams` 辅助类型 |
| TypeScript 递归深度限制 | ParseWhereClause 递归层数控制在 20 以内，超出回退为 `Record<string, unknown>` |
| SQL 模式匹配过宽泛（如注释/字符串内有 `=`） | Phase 1 只处理简单 case，复杂 SQL 退化为 `any` |
| `node:sqlite` `.all()` 返回 `unknown[]` 无类型 | 函数签名负责类型，运行时不关心 |

## 现状（已完成）

### Phase 1 已实现的类型

- `ParseTableName<S>`: `SELECT * FROM <table>` → 提取表名
- `SelectResult<S>`: → `Tables[table][]`
- `WhereParams<S>`: `WHERE col = ?` / `WHERE col1 = ? AND col2 = ?` → `{ col: Type }`

### 已知 limitation

`Object.values(params)` 顺序依赖 JS 对象属性定义顺序。若调用方写 `{ userId: 'abc', id: 1 }` 而 SQL 是 `WHERE id = ? AND userId = ?`，传参顺序会错。后续可考虑：

- 运行时按 `?` 出现顺序从对象取值，而非 `Object.values`
- 或约定调用方保持与 SQL 一致的属性顺序

## 语法覆盖分析（基于 db.ts 实际 SQL）

### ✅ 当前已覆盖（3/15 条）

| SQL 语句 | 所在函数 |
|----------|---------|
| `SELECT * FROM user WHERE externalUserId = ?` | findUserByExternalUserId |
| `SELECT * FROM user WHERE username = ?` | findUserByUsername |
| `SELECT * FROM user WHERE token = ?` | findUserByToken |

### ❌ 尚未覆盖（12/15 条）

| SQL 语句 | 缺口分析 | 依赖 |
|----------|---------|------|
| `SELECT cursor FROM kfCursor WHERE openKfId = ?` | 非 `SELECT *`，需解析列列表 | Phase 4 |
| `SELECT COUNT(*) as count FROM markRecord WHERE userId = ? AND confirmedAt IS NOT NULL` | 聚合查询 + 非 `*` | Phase 6 |
| `SELECT COALESCE(SUM(costCredits), 0) as total FROM markRecord WHERE userId = ? AND confirmedAt IS NOT NULL` | 聚合表达式 + 别名 | Phase 6 |
| `SELECT COALESCE(SUM(amountCredits), 0) as total FROM creditTransaction WHERE userId = ?` | 同上 | Phase 6 |
| `SELECT id, amountMoney, ... FROM creditTransaction WHERE userId = ? ORDER BY ... LIMIT 50` | 列选取 + ORDER BY/LIMIT 干扰 | Phase 4 |
| `SELECT id, createdAt, ... FROM markRecord WHERE userId = ? AND confirmedAt IS NOT NULL ORDER BY ... LIMIT 50` | 同上 | Phase 4 |
| `INSERT INTO markRecord (userId, createdAt, costCredits) VALUES (?, ?, ?)` | INSERT 参数 + 返回值 | Phase 2 |
| `INSERT INTO user (...) VALUES (?, ?, ?, ?, ?, ?, ?, ?)` | INSERT 参数 | Phase 2 |
| `INSERT INTO creditTransaction (...) VALUES (?, ?, ?, ?, ?)` | INSERT 参数 | Phase 2 |
| `INSERT OR REPLACE INTO kfCursor (openKfId, cursor) VALUES (?, ?)` | INSERT OR REPLACE 语法变体 | Phase 2 |
| `UPDATE markRecord SET confirmedAt = ? WHERE id = ? AND userId = ?` | UPDATE SET + WHERE 参数 | Phase 5 |
| `UPDATE user SET token = ?, updatedAt = ? WHERE externalUserId = ?` | UPDATE SET + WHERE 参数 | Phase 5 |

### WHERE 子句兼容性

当前 `WhereParams` 只匹配 `col = ?` 条件。`AND confirmedAt IS NOT NULL` 这类无参数条件会被忽略（结果正确，因为不需要参数）。

有 `ORDER BY` / `LIMIT` 跟在 `WHERE` 后面时，如果模式是 `col = ? AND <Rest>`，`Rest` 中包含 `ORDER BY`，递归处理到不支持的模式时返回 `{}`，也不会产生错误参数。**结果是安全的**。

### 各阶段依赖关系

```
Phase 1 ──→ Phase 4 (SELECT col1, col2 ...)
  │              └──→ Phase 6 (聚合查询)
  │
  └──────→ Phase 2 (INSERT)
  │           └──→ Phase 3 (INSERT 返回值区分)
  │
  └──────→ Phase 5 (UPDATE)
```

## 验证方式

```ts
// types-sql.ts 内编译期断言
type _TestSelect = AssertTrue<Tables['user'] extends SelectResult<'SELECT * FROM user WHERE id = ?'> ? true : false>;

// types-sql-test.ts 运行时验证
const rows = runSql('SELECT * FROM user WHERE externalUserId = ?', { externalUserId: 'test' });
// rows is User[]
```

## 工作步骤

1. ✅ types-sql.ts：Phase 1 — `ParseTableName`, `SelectResult`, `WhereParams`
2. Phase 2：`INSERT INTO table (cols) VALUES (?, ...)` — 参数类型推导
3. Phase 4：`SELECT col1, col2 FROM table` — 列选取 + 表名提取（支持非 `*`）
4. Phase 5：`UPDATE table SET col = ? WHERE ...` — SET/WHERE 参数
5. Phase 3：INSERT 返回值 `{ lastInsertRowid, changes }`
6. Phase 6：聚合查询 `COUNT(*) / SUM(col) as alias` — 返回 `Record<string, number>`
7. db.ts：新增 `runSql` 运行时实现
8. types-sql-test.ts：新增运行测试
