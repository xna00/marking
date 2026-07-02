import { getCurrentUser } from "./auth.ts";
import { ADMIN_USERNAME } from "./constants.ts";
import { ApiError } from "./utils.ts";
import { getMarkLogs } from "../db.ts";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function markLogs(body: { limit?: number; offset?: number }) {
  const admin = await getCurrentUser();
  if (admin.username !== ADMIN_USERNAME) {
    throw new ApiError(403, "无权限", {}, "API_FORBIDDEN", {});
  }
  return getMarkLogs(body.limit, body.offset);
}

export async function markImage(body: { filename: string }) {
  const admin = await getCurrentUser();
  if (admin.username !== ADMIN_USERNAME) {
    throw new ApiError(403, "无权限", {}, "API_FORBIDDEN", {});
  }
  const filePath = join(process.cwd(), "data", "mark-images", body.filename);
  const buffer = await readFile(filePath);
  return new Response(buffer, { headers: { "content-type": "image/webp" } });
}
