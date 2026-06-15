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

### 空格排版（简化解析）

以下规则可以减少解析器的歧义：

| 规则 | 推荐 | 避免 | 原因 |
|------|------|------|------|
| `@name` 后紧跟 `,` 或 `)` | `@name,@name2` | `@name ,@name2` | 防止空格被当作 word terminator |
| 逗号后加空格 | `@a, @b` | `@a,@b` | 标注惯例 |
| `=` 前后空格 | `id = @id` | `id=@id` | 可读性，非强制 |
| `VALUES` 紧接 `(` | `VALUES(@a,@b)` | `VALUES (@a, @b)` | 非强制，两种都支持 |
| `INSERT INTO 表名紧接 (` | `INSERT INTO user(...` | `INSERT INTO user (...` | 非强制，两种都支持 |

### 不允许的模式（解析器无法处理）

- **`@` 出现在字符串字面量中**：`'email@example.com'` 会被误识别为参数
- **多条语句**：`runSql` 每次只接受一条 SQL 语句
- **`SELECT 列1, 列2 FROM ...`**：暂不支持非 `*` 的列选取

### 参数传递：object

- `runSql` 第二个参数传 object，不用 tuple：`{ externalUserId: 'abc' }`
- 属性顺序应与 SQL 中 `@name` 出现的顺序一致（运行时 `Object.values` 按此顺序传参给 prepared statement）

```ts
// ✓ 顺序一致
runSql('WHERE id = @id AND name = @name', { id: 1, name: 'foo' })

// ✗ 顺序不一致 —— Object.values 会给出错误顺序
runSql('WHERE id = @id AND name = @name', { name: 'foo', id: 1 })
```

### 查询结果：always array

- SELECT 查询无论返回 0/1/N 行，统一返回 `T[]`（`.all()` 语义）
- 取单行用 `.at(0)`

## 类型推导规则

### 参数类型：`WhereParams<S>` / `InsertParams<S>`
1. 扫描 SQL 中所有 `@identifier` 引用
2. 从 SQL 提取表名（SELECT 走 `ParseTableName`，INSERT 走 `ParseInsertTableName`）
3. 查 `Tables[表名][参数名]` 得到每个参数的具体类型
4. 合并为 `{ 参数名: 类型 }`

### 返回值类型：`SelectResult<S>`
- `SELECT * FROM 表名` → `Tables[表名][]`
- `SELECT 列1, 列2 FROM 表名` → 计划中（Phase 4），暂不支持

## 代码组织

| 文件 | 职责 |
|------|------|
| `server/types-sql.ts` | 类型体操实现 + 编译期断言 |
| `server/types-sql-test.ts` | 运行时类型验证 |
| `server/db.ts` | 数据库连接 + `runSql` 运行时（待实现） |
