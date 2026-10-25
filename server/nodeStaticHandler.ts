import { createReadStream, existsSync, statSync } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { logger } from "./logger.ts";

// 用 import.meta.url 解析，不依赖 cwd（npm run dev 的 cwd 是 server/）
// 设 STATIC_DIR 可覆盖目录，设空串可关闭静态服务
export const STATIC_DIR: string =
  process.env.STATIC_DIR ?? fileURLToPath(new URL("../dist/doc", import.meta.url));

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".htm": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
  ".svg": "image/svg+xml", ".webp": "image/webp", ".avif": "image/avif", ".ico": "image/x-icon",
  ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf",
  ".zip": "application/zip", ".pdf": "application/pdf", ".exe": "application/octet-stream",
  ".bat": "application/octet-stream",
};

// scripts/compress-static.ts 生成的旁车文件
const BROTLI_SUFFIX = ".br";

// doc/vite.config.ts 给内容寻址的资源打的标记，配合 [hash] 保证同名内容不变
const IMMUTABLE_MARKER = "--imm--";

/**
 * 命中返回 Response；未命中、路径越界或任何异常都返回 null，由调用方兜底 404
 */
export async function staticHandler(req: Request): Promise<Response | null> {
  if (!STATIC_DIR) return null;

  try {
    // URL parser 只做 dot-segment 归一化和补编码，不解码 %XX，
    // 所以 %2e%2e%2f 会原样留在 pathname 里，必须自己 decode
    let rel = decodeURIComponent(new URL(req.url).pathname);
    if (rel === "/" || rel === "") rel = "/index.html";
    if (rel.includes("\0")) return null;

    const root = path.resolve(STATIC_DIR);
    const target = path.resolve(root, "." + rel);
    if (target !== root && !target.startsWith(root + path.sep)) return null;

    let filePath = target;
    let st = await stat(filePath);
    if (st.isDirectory()) {
      // 目录回退到 index.html，不做 SPA rewrite
      filePath = path.join(filePath, "index.html");
      st = await stat(filePath);
    }
    if (!st.isFile()) return null;

    // 有旁车就直接返回压缩字节，省掉请求时的压缩；br;q=0 表示客户端明确拒收
    let bodyPath = filePath;
    let encoding: string | undefined;
    const accept = req.headers.get("accept-encoding") ?? "";
    if (accept.includes("br") && !accept.includes("br;q=0")) {
      const brPath = filePath + BROTLI_SUFFIX;
      if (existsSync(brPath)) {
        bodyPath = brPath;
        st = statSync(brPath);
        encoding = "br";
      }
    }

    const headers = new Headers({
      "content-length": String(st.size),
      "content-type": MIME[path.extname(filePath).toLowerCase()] ?? "application/octet-stream",
    });
    if (encoding) {
      headers.set("content-encoding", encoding);
      // nginx/CDN 共享缓存按这个头区分变体
      headers.set("vary", "accept-encoding");
    }
    // 只有带 --imm-- 的才永久缓存，html / update.json / 最新版指针都不带
    if (path.basename(filePath).includes(IMMUTABLE_MARKER)) {
      headers.set("cache-control", "public, max-age=31536000, immutable");
    }

    return new Response(Readable.toWeb(createReadStream(bodyPath)), { headers });
  } catch (e) {
    // 两种正常的 404 来源：文件不存在、URL 半截 percent（如 /100%）
    if (e instanceof URIError || (e as NodeJS.ErrnoException).code === "ENOENT") return null;
    logger.error(e);
    return null;
  }
}
