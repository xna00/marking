# 类型级 SQL 约定（typed-sql 库）

## 概览

- 原生 `node:sqlite`，零第三方依赖
- 类型级解析器从 SQL 字符串推导参数与返回值类型，`TypedDb<S>` 提供类型安全的 `prepare().all/get/run`
- 表类型由 `Schema<T>` 从 `CREATE [TEMP] TABLE IF NOT EXISTS` 语句推导；示例表定义在测试文件（typed-sql-test.ts）中

## API 使用

- `prepare<const T extends string>(sql)` 接受字面量 SQL，返回类型安全的语句对象
  - `.all(params)` → `T[]`（SELECT 全量结果）
  - `.get(params)` → `T | undefined`（取单行，无行返回 `undefined`）
  - `.run(params)` → `{ lastInsertRowid: number; changes: number }`（INSERT/UPDATE/DELETE）
- 参数一律传 **object**（命名参数），`node:sqlite` 原生支持，**无需关心属性顺序**
- `params` 必填：无参数的查询也要传 `{}`（如 `WHERE 1=1`）

```ts
// ✓ 任意顺序
const u = db.prepare('SELECT ALL * FROM user WHERE user.id = @id ORDER BY 1 LIMIT -1 OFFSET 0').get({ id: 1 });
```

## SQL 书写约定

### 关键字与标识符

- 解析器按**大写字面**匹配关键字，一律大写：`SELECT`, `ALL`, `DISTINCT`, `FROM`, `WHERE`, `GROUP BY`, `HAVING`, `ORDER BY`, `LIMIT`, `OFFSET`, `INSERT`, `INTO`, `VALUES`, `UPDATE`, `SET`, `DELETE`, `AND`, `OR`, `AS`, `IS`, `NOT IN`, `LIKE`, `NOT LIKE`, `IN`, `BETWEEN`, `NOT NULL`, `PRIMARY KEY`
- 唯一例外：`BETWEEN` 中的 `and` 用小写
- `ORDER BY` / `GROUP BY` / `HAVING` 的**内容不被校验**（大小写、列名、表达式任意）
- **表名直接写，必须不写别名**：`FROM user`, `UPDATE user`（`FROM user u` 会解析失败）
- WHERE 子句用 `table.col`：`user.externalUserId = @externalUserId`
- **UPDATE 的 SET 子句用裸列名**（`token = @token`）——SQLite 的 SET 不接受 `table.col` 前缀
- SELECT 列用 `table.col AS name` 投影

### 参数：`@name` 命名参数

- 不用 `?` 占位符，改用 `@名称`
- 参数名规则按语句区分：
  - **SELECT** 的 WHERE / LIMIT / OFFSET、**UPDATE** 的 SET / WHERE、**DELETE** 的 WHERE：参数名可任意（如 `@limit`、`@anotherId`）
  - **INSERT VALUES**：参数名**必须是目标表列名**（非列名参数会被静默丢弃，调用处编译错）
- 参数类型从对应列类型推导：TEXT → `string`，INTEGER/REAL → `number`，可空列 → `| null`
- 例外：`LIMIT` / `OFFSET` 的参数恒为 `number`
- `VALUES` 括号内、`IN` 列表内用「逗号 + 一个空格」分隔参数：`(@a, @b)`
- 参数值里避免出现字面量 `@`（如 `'email@example.com'`），会被误识别

```
✓ 完整合法示例
SELECT ALL * FROM user WHERE user.externalUserId = @externalUserId ORDER BY 1 LIMIT -1 OFFSET 0
INSERT INTO user (username, passwordHash) VALUES (@username, @passwordHash)
UPDATE user SET token = @token WHERE user.externalUserId = @externalUserId
INSERT OR REPLACE INTO kfCursor (openKfId, cursor) VALUES (@openKfId, @cursor)

✗ 反例
SELECT * FROM user WHERE user.externalUserId = @externalUserId        # 缺 ALL、缺 ORDER BY/LIMIT/OFFSET
SELECT ALL * FROM user WHERE externalUserId = @id ORDER BY 1 LIMIT -1 OFFSET 0   # WHERE 缺 user. 前缀
FROM user u                                                          # 表别名
VALUES (@a,@b)                                                       # 逗号后缺空格
```

### 严格格式（解析器不做空白归一化）

| 规则 | 原因 |
|------|------|
| SQL 字符串 **无前导或尾随空白** | 类型以 `SELECT`/`INSERT`/`UPDATE` 开头直接匹配 |
| `FROM 表名` 后必须**恰好一个空格**再接 ` WHERE`，无多余空白 | 模板用 `FROM ${FromClause} WHERE` 取表名；表名后多余空格会让 `_NewTables` 查不到表，列全部退化为 `{}` |
| CREATE TABLE **列定义顶格写**（每行 column 0 开始，无缩进） | `ParseCols` 用 `Split<Rest, ",\n">` 拆分列 |
| SELECT 列列表 **逗号后跟一个空格**：`col1, col2` | `Split<Cols, ', '>` 分隔列名 |
| SELECT 模板：`SELECT {ALL\|DISTINCT} <cols> FROM <table> WHERE <cond> ORDER BY ... LIMIT ... OFFSET ...`，**GROUP BY/HAVING 可选且成对出现** | `_MatchSelect` 按带/不带 GROUP BY 两个变体匹配；GROUP BY 若被吞进 WHERE 会破坏 `IS NULL` 收窄 |
| 聚合必须位于**列表达式开头**，不得包在其他函数内（如 `COALESCE(SUM(x),0)`） | `ColType` 只匹配以聚合开头的表达式，包裹后落入 T.C 分支得 `unknown` |
| `BETWEEN` 中的 `AND` 用小写 `and` | 避免被 WHERE-level ` AND ` 误拆分 |

### 查询结果

- `.all()` 统一返回 `T[]`；取单行用 `.get()` → `T | undefined`

### 枚举列：`CHECK (... IN (...))`

- 用列级 `CHECK` 的 `IN` 形式声明枚举，类型层推导为字面量联合：
  `status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed'))` → `'pending' | 'confirmed'`
- 字符串值用**单引号**，数值裸写（`score INTEGER CHECK (score IN (1, 2, 3))` → `1 | 2 | 3`）
- 列表用「逗号 + 一个空格」分隔；值内不得含单引号
- 枚举类型自动传播：`SELECT *` 结果列、WHERE / SET / INSERT VALUES 参数全部收窄
- 可空列（无 `NOT NULL`）→ `| null`；NULL 恒通过 CHECK（SQLite 语义）
- 仅支持简单单列 `CHECK (col IN (...))`；范围式（`CHECK (cost > 0)`）、多条件 CHECK 不参与枚举推导，列回落到对应基础类型
- 只有 `CHECK (本列名 IN (...))` 参与推导；引用其他列（`CHECK (score IN (1,2,3))` 写在 status 上）或常量表达式（`CHECK (1 IN (1,2))`）同样回落基础类型

## 类型推导规则

### 参数类型：`Params<S>`（SELECT）/ `RunParams<S>`（INSERT/UPDATE/DELETE）

1. 扫描 SQL 中所有 `@identifier` 引用
2. 从 SQL 提取表名（SELECT 用 `_MatchSelect`，DML 用 `_MatchInsert` / `_MatchUpdate` / `_MatchDelete` 匹配）
3. 查 `Tables[表名][参数名]` 得到每个参数的具体类型
4. 合并为 `{ 参数名: 类型 }`

WHERE 支持的操作符：`=`, `>=`, `<=`, `!=`, `<>`, `>`, `<`, `LIKE`, `NOT LIKE`, `IN`, `NOT IN`, `BETWEEN ... and ...`。
`LIKE`/`NOT LIKE` 的参数类型按列类型推导（TEXT 列 → `string`）；LIKE 的 `%`/`_` 通配符写在参数值里，不进入 SQL 字符串。
SELECT 额外把 `LIMIT` / `OFFSET` 中的 `@参数` 类型定为 `number`。

### 返回值类型：`SelectResult<S>`

- `SELECT * FROM 表名` → `Tables[表名][]`
- `SELECT 列1,列2 FROM 表名` → `{ 列1: 类型, 列2: 类型 }[]`
- 多表 JOIN 时 `*` 返回各表字段的合并（交集）类型
- WHERE 中的 `Tbl.Col IS NOT NULL` / `Tbl.Col IS NULL` 会进一步收窄对应列（去空 / 恒 `null`），
  `SELECT *` 与显式列两条路径都生效
- 聚合列按 SQL 语义建模（空集/全 NULL 时 SUM/AVG/MAX/MIN 返回 NULL）：
  - `COUNT(*)` → `number`
  - `SUM(x)` / `AVG(x)` / `MAX(x)` / `MIN(x)` → `number | null`
  - `GROUP_CONCAT(x)` → `string | null`
- 空集行为（SQLite 语义）：
  - 省略 GROUP BY 的聚合查询（全局聚合）恒返回 1 行：`COUNT`→`0`、`SUM/AVG/MAX/MIN`→`null`
  - 带 GROUP BY 的空集返回 0 行
  - 两者都可用 `?? 0` 等兜底归一

## 设计边界（刻意不做）

以下均为**刻意的实现简化**，不是缺陷。匹配失败时类型退化（`unknown` / `never` / `{}`）本身就是可见的警示信号，提醒调用方该写法不在支持范围内。

- **SELECT 四要件强制**：`WHERE` / `ORDER BY` / `LIMIT` / `OFFSET` 缺一不可，是为了让 `_MatchSelect` 只维护固定变体（带/不带 GROUP BY），匹配失败即 `unknown`。不提供"无 WHERE"、"无 LIMIT/OFFSET"的省略写法
  - 占位成分与 SQL 语义等效（实测 `EXPLAIN QUERY PLAN` 一致）：
    - `WHERE 1=1` ≡ 不写 WHERE（SQLite 常量折叠，查询计划不变）
    - `LIMIT -1` ≡ 无行数上限（负 LIMIT 即无上限，OFFSET 仍照常生效）；`OFFSET 0` ≡ 从第一行起
    - **`ORDER BY 1` 不等价于无 ORDER BY**——它按第一列排序，对单行/聚合查询无影响才可作占位；真实排序需求必须写实际子句（如 `createdAt DESC, id DESC`）
- **表别名**：必须不写别名，`FROM user u` 解析失败
- **GLOB**：SQLite 特有、大小写敏感，刻意不支持（`LIKE` 已覆盖常见匹配需求）
- **CASE WHEN / 标量函数**（`strftime`/`ifnull` 等）：非聚合列表达式解析不了 → `unknown`（可见信号）
- **子查询 / UNION / INSERT SELECT / INSERT DEFAULT VALUES**
- **JOIN 拼写**：仅 `LEFT JOIN` / `INNER JOIN`；`LEFT OUTER JOIN`、`RIGHT`/`FULL`/`CROSS`/`NATURAL` 均不支持
- **`SELECT *, COUNT(*) AS c` 混合投影**：列列表含 `*` 且非纯 `*` 时，`*` 部分解析为 `{}`（该写法本身无可靠语义，退化即警示）
- **`GROUP_CONCAT(x, y)` 多参数**：列列表按 `", "` 切分，函数内逗号会被误拆 → 类型退化（仅支持单参）
- **HAVING / ORDER BY 不参与参数提取**：`HAVING COUNT(*) > @min`、`ORDER BY @col` 中的参数会被丢弃
- **UPDATE/DELETE 无 WHERE**：模板强制 WHERE
- **UPDATE SET 表达式**（如 `count = count + 1`）：`SetParams` 只认 `列名 = @参数` 形式
- **CREATE TABLE 必须带 `IF NOT EXISTS`**：只支持 `CREATE [TEMP] TABLE IF NOT EXISTS <name>`，漏写时 `Schema` 返回 `{}`（运行时重复建表也会报 `table already exists`，类型层信号与之一致）

## 代码组织

| 文件 | 职责 |
|------|------|
| `typed-sql.ts` | lib——类型体操（Schema / SelectResult / Params / RunParams）+ TypedDb<Schema> class |
| `typed-sql-test.ts` | 示例表定义 + 编译期类型断言 + 运行时验证 |
