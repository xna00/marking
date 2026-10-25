#!/usr/bin/env node
/// <reference types="node" />

// 组装发布产物：把 extension 产物打成 zip 放进 dist/doc，再生成版本号相关的下载清单
// 顺序有依赖，不能随意调整：
//   1. zip 必须在两个 workspace build 之后（extension 产物要存在）
//   2. zip 必须在 setUpdateUrl 之前（后者要读 dist/doc/extension.zip 做版本化拷贝）
//   3. compress-static 必须最后（要给最终产物生成 brotli 旁车）

import { execFileSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

execFileSync("zip", ["-r", "../doc/extension.zip", "."], {
  cwd: "dist/extension",
  stdio: "inherit",
});

for (const script of ["setUpdateUrl.ts", "generate-start-bat.ts", "compress-static.ts"]) {
  execFileSync(process.execPath, [path.join(root, "scripts", script)], { stdio: "inherit" });
}
