#!/usr/bin/env node
/// <reference types="node" />

// 为 dist/doc 生成 brotli 旁车文件（<file> → <file>.br），
// 服务端命中 Accept-Encoding: br 时直接返回旁车，避免请求时现压

import fs from "node:fs";
import path from "node:path";
import { brotliCompressSync, constants } from "node:zlib";

const ROOT = path.resolve(import.meta.dirname, "../dist/doc");
const SUFFIX = ".br";
const QUALITY = 11;

// 已经是二进制压缩格式，压了没收益甚至会变大
const SKIP = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "avif", "ico",
  "woff", "woff2", "ttf", "otf", "pdf",
  "br", "gz",
]);

function walk(dir: string, files: string[] = [], dirs: string[] = []): void {
  dirs.push(dir);
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, files, dirs);
    else if (entry.isFile() && !entry.name.endsWith(SUFFIX)) files.push(p);
  }
}

if (!fs.existsSync(ROOT)) {
  console.error(`[compress-static] not found: ${ROOT}`);
  process.exit(1);
}

const files: string[] = [];
const dirs: string[] = [];
walk(ROOT, files, dirs);

let count = 0;
let before = 0;
let after = 0;

for (const file of files) {
  const ext = path.extname(file).toLowerCase().slice(1);
  const side = file + SUFFIX;
  if (SKIP.has(ext)) {
    // 换回原格式后要清掉旧旁车，否则会继续返回过期的压缩内容
    fs.rmSync(side, { force: true });
    continue;
  }
  const buf = fs.readFileSync(file);
  const out = brotliCompressSync(buf, {
    params: { [constants.BROTLI_PARAM_QUALITY]: QUALITY },
  });
  fs.writeFileSync(side, out);
  count++;
  before += buf.length;
  after += out.length;
}

// 基文件已删除的孤儿旁车
let orphan = 0;
for (const dir of dirs) {
  for (const entry of fs.readdirSync(dir)) {
    if (!entry.endsWith(SUFFIX)) continue;
    if (fs.existsSync(path.join(dir, entry.slice(0, -SUFFIX.length)))) continue;
    fs.rmSync(path.join(dir, entry));
    orphan++;
  }
}

const mb = (n: number) => (n / 1048576).toFixed(2);
console.log(
  `[compress-static] ${count} files, ${mb(before)}MB -> ${mb(after)}MB` +
    ` (saved ${mb(before - after)}MB)` +
    (orphan ? `, removed ${orphan} orphan sidecars` : ""),
);
