# 类型级 SQL 约定

## 数据库

- 原生 `node:sqlite`，零第三方依赖
- 4 张表定义在 `Tables`（types-sql.ts），用 `Schema<T>` 从 CREATE TABLE 推导 TS 类型

## SQL 书写约定

### 关键字
- **一律大写**：`SELECT`, `FROM`, `WHERE`, `INSERT INTO`, `VALUES`, `AND`, `OR`, `NOT NULL`, `PRIMARY KEY` 等
- 类型级解析器只匹配大写关键字

### 参数：`@name` 命名参数
- 不用 `?` 占位符，改用 `@列名`
- 参数名 = 对应的列名，只多一个 `@` 前缀
- 遵循以上规则，解析器不需要了解 SQL 结构，只需扫描 `@identifier`

```
✓ SELECT * FROM user WHERE externalUserId = @externalUserId
✓ INSERT INTO user (username, passwordHash) VALUES (@username, @passwordHash)
✓ UPDATE user SET token = @token WHERE externalUserId = @externalUserId
✓ INSERT OR REPLACE INTO kfCursor (openKfId, cursor) VALUES (@openKfId, @cursor)

✗ SELECT * FROM user WHERE externalUserId = ?
✗ INSERT INTO user (username) VALUES (?)
```

### 严格格式（解析器不做空白归一化）

移除 `Trim` 后，类型级解析器要求精确的空格/换行排版：

| 规则 | 原因 |
|------|------|
| SQL 字符串 **无前导或尾随空白**（表名后的尾空格是唯一例外） | 类型以 `SELECT`/`INSERT`/`UPDATE` 开头直接匹配 |
| **表名后必须跟恰好一个空格**，即使 SQL 到此结束（如 `'SELECT * FROM user '`） | `ParseTableName` 用 `${infer Name} ${string}` 取第一个词 |
| CREATE TABLE **列定义顶格写**（每行 column 0 开始，无缩进） | `ParseCols` 用 `Split<Rest, ",\n">` 拆分列 |
| SELECT 列列表 **逗号后跟一个空格**：`col1, col2` | `Split<Cols, ', '>` 分隔列名 |
| `@name` 后紧跟 `,` 或 `)`：`@a,@b` 或 `@a)` | 逗号/paren 直接作为 word terminator |
| `@` 出现在字面量（如 `'email@example.com'`）会误识别 | 避免在 SQL 参数中使用这种模式 |

### 参数传递：object

- `runSql` 第二个参数传 object，不用 tuple：`{ externalUserId: 'abc' }`
- `node:sqlite` 原生支持命名参数，**直接传 object，无需关心属性顺序**

```ts
// ✓ 任意顺序
runSql('WHERE id = @id AND name = @name', { name: 'foo', id: 1 })
```

### 查询结果：always array

- SELECT 查询无论返回 0/1/N 行，统一返回 `T[]`（`.all()` 语义）
- 取单行用 `.at(0)`

## 类型推导规则

### 参数类型：`WhereParams<S>`（通用于 SELECT / INSERT / UPDATE）
1. 扫描 SQL 中所有 `@identifier` 引用
2. 从 SQL 提取表名（统一用 `ParseTableName`）
3. 查 `Tables[表名][参数名]` 得到每个参数的具体类型
4. 合并为 `{ 参数名: 类型 }`

### 返回值类型：`SelectResult<S>`
- `SELECT * FROM 表名` → `Tables[表名][]`
- `SELECT 列1,列2 FROM 表名` → `Pick<Tables[表名], '列1' | '列2'>[]`

## 设计笔记

### 为什么 `FirstWord` 不能用 `${infer W}${' ' | ',' | ')' | ';'}${string}`

```ts
// ❌ 不可用！
type FirstWord<S extends string> =
  S extends `${infer W}${' ' | ',' | ')' | ';'}${string}` ? W : S;
```

TypeScript 对 `${infer W}${A | B | C}${string}` 会做 **distribution**——每个 delimiter 独立匹配，
结果取**所有成功匹配的 W 的 union**，而不是选最短的那一个。

例：`FirstWord<"user (externalUserId, username)">`
- 空格匹配：W = `"user"`（空格在 position 4）
- 逗号匹配：W = `"user (externalUserId"`（逗号在 position 20）
- 结果：`"user" | "user (externalUserId"` → `extends "user"` 为 false ❌

例：`FirstWord<"externalUserId, ">`
- 逗号匹配：W = `"externalUserId"` ✓
- 空格匹配：W = `"externalUserId,"` ✗
- 结果：`"externalUserId" | "externalUserId,"` → ❌

**方案**：用显式链式条件类型，不同场景用不同优先级排序：
- `FirstWord`：空格优先（当前仅用于 `_ParseAlias` 提取聚合别名：`... as total` → `"total"`）
- `ParamName`：逗号/paren 优先（`@name` 后取参数名：`@externalUserId,` → `"externalUserId"`）

**教训**：`${infer W}${Union}${string}` 不保证最短匹配，会 production union；
需要最短匹配时用链式条件 + 正确优先级。

> 注：`ParseTableName` 统一后用 `${infer Name} ${string}` 取表名第一个词，不再需要 `FirstWord`。

## 代码组织

| 文件 | 职责 |
|------|------|
| `server/types-sql.ts` | lib——类型体操（Schema / ParseTableName / SelectResult / WhereParams）+ TypedDb<Schema> class |
| `server/types-sql-test.ts` | 运行时类型验证 + Tables 定义 + 编译期断言 |
| `server/db.ts` | 数据库连接 + 定义 `AppTables`（`Tables` 的实际类型），计划接入 `runSql` |
