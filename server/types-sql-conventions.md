# 类型级 SQL 约定

## 数据库

- 原生 `node:sqlite`，零第三方依赖
- 4 张表定义在 `Tables`（typed-sql-test.ts），用 `Schema<T>` 从 CREATE TABLE 推导 TS 类型

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
| **表名后必须跟恰好一个空格**，即使 SQL 到此结束（如 `'SELECT * FROM user '`） | 类型模板用 `FROM ${infer Name} WHERE` 取表名 |
| CREATE TABLE **列定义顶格写**（每行 column 0 开始，无缩进） | `ParseCols` 用 `Split<Rest, ",\n">` 拆分列 |
| SELECT 列列表 **逗号后跟一个空格**：`col1, col2` | `Split<Cols, ', '>` 分隔列名 |
| 聚合必须位于**列表达式开头**，不得包在其他函数内（如 `COALESCE(SUM(x),0)`） | `ColType` 只匹配以聚合开头的表达式，包裹后落入 T.C 分支得 `unknown` |
| `@name` 后紧跟 `,` 或 `)`：`@a,@b` 或 `@a)` | 逗号/paren 直接作为 word terminator |
| `BETWEEN` 中的 `AND` 用小写 `and` | 避免被 WHERE-level ` AND ` 误拆分 |
| `@` 出现在字面量（如 `'email@example.com'`）会误识别 | 避免在 SQL 参数中使用这种模式 |
| UPDATE 的 **SET 子句用裸列名**（`token = @token`），WHERE 子句用 `table.col`（`user.externalUserId = @externalUserId`） | SQLite 的 SET 不接受 `table.col` 前缀；`SetParams` 从裸列名 + 表名推导参数类型 |

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

### 参数类型：`Params<S>`（SELECT）/ `RunParams<S>`（INSERT/UPDATE/DELETE）
1. 扫描 SQL 中所有 `@identifier` 引用
2. 从 SQL 提取表名（SELECT 用 `_MatchSelect`，DML 用 `_MatchInsert` / `_MatchUpdate` / `_MatchDelete` 匹配）
3. 查 `Tables[表名][参数名]` 得到每个参数的具体类型
4. 合并为 `{ 参数名: 类型 }`

### 返回值类型：`SelectResult<S>`
- `SELECT * FROM 表名` → `Tables[表名][]`
- `SELECT 列1,列2 FROM 表名` → `Pick<Tables[表名], '列1' | '列2'>[]`
- WHERE 中的 `Tbl.Col IS NOT NULL` / `Tbl.Col IS NULL` 会进一步收窄对应列（去空 / 恒 `null`），
  `SELECT *` 与显式列两条路径都生效
- 聚合列按 SQL 语义建模（空集/全 NULL 时 SUM/AVG/MAX/MIN 返回 NULL）：
  - `COUNT(*)` → `number`
  - `SUM(x)` / `AVG(x)` / `MAX(x)` / `MIN(x)` → `number | null`
  - `GROUP_CONCAT(x)` → `string | null`
  - 空值用 `?? 0` 等兜底（如 `db.ts` 的 `sumCredits`）

## 设计笔记

### 别名提取用 `{[K in Name]: ...}` 映射类型

`_Col` 解析 `expr AS name` 后直接用 `{[K in Name]: ...}` 生成字段，
不再需要独立的 `FirstWord`（已删除）。

## 代码组织

| 文件 | 职责 |
|------|------|
| `server/typed-sql.ts` | lib——类型体操（Schema / SelectResult / Params / RunParams）+ TypedDb<Schema> class |
| `server/typed-sql-test.ts` | 运行时类型验证 + Tables 定义 + 编译期断言 |
| `server/db.ts` | 数据库连接 + 初始化表 + 运行时 CRUD 函数 |
