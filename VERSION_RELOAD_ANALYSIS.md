# 版本号 / 域名异常分析

## 背景

`marking-out.log` 中观察到的异常请求组合：

| 组合 | 请求数 | 日期 | 解释 |
|------|--------|------|------|
| 1.56 + IP | 82 | 6/10 仅今天 | **exe 更新 bug 导致新旧文件混搭** |
| 1.55 + domain | 48 | 6/5 | 同上（中间版本，有 domain 但未 bump） |
| 1.55 + IP | 2573 | 多天 | 真实用户，未更新 |
| 1.56 + domain | 1784 | 6/6,9,10 | 真实用户，正常更新 |

## 根因：`start.c` 文件操作时序 bug

`start.c` 的 `MainLogic()` 函数中，文件操作在杀死 Edge 之前执行：

```c
// 错误顺序（当前代码）：
DeleteFileTree(g_destPath);         // ① 删除旧扩展 ← Edge 还在运行
MoveFileExW(srcPath, g_destPath);   // ② 移动新扩展
KillEdgeProcesses();                // ③ 杀死 Edge（太晚了）
Sleep(500);
StartEdge();                        // ④ 启动 Edge
```

### 问题细节

1. **`DeleteFileTree` 不检查返回值**——被 Edge 锁定的文件（如 background.js）无法删除，但目录下的非锁定文件（如 manifest.json）可能被删掉
2. 目录未完全清空，`MoveFileExW` 可能失败
3. 回退到 `CopyFileTree`，其中 `CopyFileW(src, dst, TRUE)` 遇到已存在/锁定的目标文件会静默跳过
4. `CopyFileTree` 的返回值同样被忽略
5. 结果：manifest.json 被成功覆盖（版本→1.56），但 background.js 仍保留旧版（含硬编码 IP）

### 修复方案

**先把 KillEdgeProcesses 移到 DeleteFileTree 之前：**

```c
// 正确顺序：
KillEdgeProcesses();
Sleep(500);

if (needDownload) {
    DeleteFileTree(g_destPath);
    MoveFileExW(srcPath, g_destPath);
}

StartEdge();
```

## Chromium / Edge 文件锁定行为 ✅ 已通过源码验证

### 结论

Edge 运行 unpacked extension 时，**确实可能短暂锁定 JS 文件**。具体取决于 service worker 是否恰好在更新窗口期内被重启。

### 源码证据

#### 1. `FileURLLoader` 打开文件时不带 `FILE_SHARE_DELETE`

`content/browser/loader/file_url_loader_factory.cc`：
```cpp
base::File file(path, base::File::FLAG_OPEN | base::File::FLAG_READ);
```

Windows 上 `base::File::Initialize()` 的共享模式为：
```cpp
// FLAG_OPEN | FLAG_READ 下：
DWORD sharing = FILE_SHARE_READ | FILE_SHARE_WRITE;  // 无 FILE_SHARE_DELETE
```

源文件：`base/files/file_win.cc`

#### 2. 文件句柄在 mojo data pipe 活动期间保持打开

`FileLoader` 将 `base::File` 包装为 `mojo::DataPipeProducer::DataSource`，通过 mojo pipe 流式传输到渲染进程。Data pipe 连接期间，文件句柄保持打开。

源文件：`content/browser/loader/file_url_loader_factory.cc`

#### 3. 在句柄打开期间执行 `DeleteFile` 会失败

Windows 上删除一个已被其他进程以独占方式打开的文件时，`DeleteFileW` 返回 `ERROR_SHARING_VIOLATION`。

### 触发条件

虽然 background.js 很小（读取 + 管道传输通常 < 1ms），但以下场景会扩大竞争窗口：

- **Service Worker 频繁重启**：MV3 extension 的 service worker 在空闲约 30 秒后自动停止；新事件触发重启 → 重新从磁盘读取 background.js
- **用户打开了多个使用该 extension 的标签页**：每个标签页都可能触发 service worker 事件，增加重启频率
- **`Sleep(500)` 时间不够**：当前 `KillEdgeProcesses` 后的 500ms 延迟发生在文件操作之后，不在关键路径上

### 总结

`start.c` 的文件操作顺序 bug 是明确的。即使在通常的短窗口期内概率不高，但只要 Edge 进程还在运行期间执行 `DeleteFileTree` + `MoveFileExW`/`CopyFileTree`，就会存在文件被锁导致部分文件未更新的场景。

## 其他相关发现

- `chrome.runtime.getManifest()` 返回的是扩展加载时的内存缓存，不会重新读取磁盘。
- `ShouldReloadExtensionManifest()` 只在 Chrome 启动时重新加载 unpacked extension 的 manifest，运行时不会检测文件变化。
- 当前 1.56 版本的 `extension/constants.ts` 中 `BACKEND_URL` 正确指向 `api.marking.xna00.top`。

## 已分析但排除的可能原因

- CI 构建 / gh-pages 部署流程无误（`clean: true` 确保旧文件被清理，构建脚本一致）
- `extension_1.56.zip` 内容与 `extension.zip` 一致（由同一构建步骤产出）
- `chrome.runtime.getManifest()` 不可用于获取编译时常量版本号（返回缓存值）
- 非 Chromium 自动检测文件变化（社区 hot-reload 方案均需自己实现文件监听 + `chrome.runtime.reload()`）
