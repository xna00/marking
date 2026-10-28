import { getUserSetting, upsertUserSetting } from "../db.ts";
import { getCurrentUser } from "./auth.ts";

// 用户设置的云同步：整包不透明 JSON，形状由扩展定义（同步键见 extension/settingsSync.ts）。
// 服务器只负责按用户存/取，不解析内容。updatedAt 用服务器时间，避免客户端时钟偏差。
export async function getSettings(): Promise<{ data: unknown; updatedAt: string | null }> {
  const user = await getCurrentUser();
  const row = getUserSetting(user.externalUserId);
  return { data: row ? JSON.parse(row.data) : null, updatedAt: row?.updatedAt ?? null };
}

export async function saveSettings(body: { data: unknown }): Promise<{ updatedAt: string }> {
  const user = await getCurrentUser();
  const updatedAt = new Date().toISOString();
  upsertUserSetting(user.externalUserId, JSON.stringify(body.data), updatedAt);
  return { updatedAt };
}
