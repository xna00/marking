import { getCurrentUser } from "./auth.ts";
import { ADMIN_USERNAME } from "./constants.ts";
import { ApiError } from "./utils.ts";
import { getMarkLogs } from "../db.ts";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

export async function markLogs(body: { limit?: number; offset?: number }) {
  const admin = await getCurrentUser();
  if (admin.username !== ADMIN_USERNAME) {
    throw new ApiError(403, "无权限", {}, "API_FORBIDDEN", {});
  }
  return getMarkLogs(body.limit, body.offset);
}

export async function getMarkImage(body: { filename: string }) {
  const admin = await getCurrentUser();
  if (admin.username !== ADMIN_USERNAME) {
    throw new ApiError(403, "无权限", {}, "API_FORBIDDEN", {});
  }
  const dir = join(process.cwd(), "data", "mark-images");
  const brPath = join(dir, `${body.filename}.br`);
  const webpPath = join(dir, body.filename);
  if (existsSync(brPath)) {
    const buffer = await readFile(brPath);
    return new Response(buffer, {
      headers: {
        "content-type": "image/webp",
        "content-encoding": "br",
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  }
  const buffer = await readFile(webpPath);
  return new Response(buffer, {
    headers: {
      "content-type": "image/webp",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
