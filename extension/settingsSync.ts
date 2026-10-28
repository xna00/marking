import { api } from "./api.js";
import { storageKeys } from "./constants.js";
import { chromeStorageLocalGet, chromeStorageLocalSet } from "./storage.js";
import type { ConfigItem, ModelName } from "./models.js";

// 云同步的键：用户设置（跨设备/跨启动）。AUTH_TOKEN（身份）与 IMAGE_SRC（瞬时）
// 不同步；改卷细则/模型/延迟/结果字号是核心偏好。
export const SYNC_KEYS = [
  storageKeys.AI_MODEL,
  storageKeys.CRITERIA_CONFIG,
  storageKeys.AI_DELAY,
  storageKeys.AI_RESULT_FONT_SIZE,
] as const;

type SyncPayload = {
  [storageKeys.AI_MODEL]: ModelName;
  [storageKeys.CRITERIA_CONFIG]: ConfigItem[];
  [storageKeys.AI_DELAY]: [number, number];
  [storageKeys.AI_RESULT_FONT_SIZE]: number;
};

// pull 写本地期间置位，避免 onChanged 把刚拉下来的数据当成本地改动再推回去。
let applying = false;
let pushTimer: number | undefined;

export async function pullSettings(): Promise<void> {
  try {
    const res = await api.userSettings.getSettings();
    // 服务器存的是扩展同步键整包（不透明 JSON，形状由本文件定义）
    const synced = res.data as SyncPayload | null;
    if (synced == null) {
      // 首次同步：服务器无记录，采纳本地为准
      await pushSettingsNow();
      return;
    }
    applying = true;
    try {
      await chromeStorageLocalSet({
        [storageKeys.AI_MODEL]: synced[storageKeys.AI_MODEL],
        [storageKeys.CRITERIA_CONFIG]: synced[storageKeys.CRITERIA_CONFIG],
        [storageKeys.AI_DELAY]: synced[storageKeys.AI_DELAY],
        [storageKeys.AI_RESULT_FONT_SIZE]: synced[storageKeys.AI_RESULT_FONT_SIZE],
      });
    } finally {
      applying = false;
    }
  } catch (e) {
    console.error("[settingsSync] pull failed:", e);
  }
}

async function pushSettingsNow(): Promise<void> {
  // 传可变数组副本：storage.ts 的 KT 类型要求可变数组，readonly SYNC_KEYS 不满足
  const local = await chromeStorageLocalGet([...SYNC_KEYS]);
  const payload: Partial<SyncPayload> = {
    [storageKeys.AI_MODEL]: local[storageKeys.AI_MODEL],
    [storageKeys.CRITERIA_CONFIG]: local[storageKeys.CRITERIA_CONFIG],
    [storageKeys.AI_DELAY]: local[storageKeys.AI_DELAY],
    [storageKeys.AI_RESULT_FONT_SIZE]: local[storageKeys.AI_RESULT_FONT_SIZE],
  };
  await api.userSettings.saveSettings({ data: payload });
}

export function setupSettingsSync(): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    // 登录成功 → 拉取云端配置（launcher 每次启动清空 profile，登录即恢复）
    if (storageKeys.AUTH_TOKEN in changes && changes[storageKeys.AUTH_TOKEN].newValue) {
      pullSettings();
      return;
    }
    if (applying) return;
    // 同步键被本地写入（用户编辑）→ debounce 推云端
    if (SYNC_KEYS.some((key) => key in changes)) {
      if (pushTimer) clearTimeout(pushTimer);
      pushTimer = setTimeout(() => {
        pushSettingsNow().catch((e) => console.error("[settingsSync] push failed:", e));
      }, 1000);
    }
  });
}
