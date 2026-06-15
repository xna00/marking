import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../../logger.ts";

const CACHE_FILE = join(process.cwd(), "wechat-token-cache.json");

type CachedToken = {
  accessToken: string;
  expiresAt: number;
};

let tokenCache: CachedToken | null = null;

function loadTokenFromCache(): CachedToken | null {
  try {
    if (existsSync(CACHE_FILE)) {
      const data = readFileSync(CACHE_FILE, "utf-8");
      const cached = JSON.parse(data) as CachedToken;
      if (cached.accessToken && cached.expiresAt && Date.now() < cached.expiresAt) {
        return cached;
      }
    }
  } catch { logger.warn("读取 wechat token 缓存失败"); }
  return null;
}

function saveTokenToCache(token: CachedToken): void {
  try {
    writeFileSync(CACHE_FILE, JSON.stringify(token, null, 2), "utf-8");
  } catch { logger.warn("写入 wechat token 缓存失败"); }
}

const CORP_ID = process.env.WECOM_CORP_ID;
const CORP_SECRET = process.env.WECOM_CORP_SECRET;

export async function getAccessToken(): Promise<string> {
  if (!CORP_ID || !CORP_SECRET) {
    throw new Error("WECOM_CORP_ID 或 WECOM_CORP_SECRET 未设置");
  }

  if (!tokenCache) {
    tokenCache = loadTokenFromCache();
  }
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.accessToken;
  }

  const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${CORP_ID}&corpsecret=${CORP_SECRET}`;
  const res = await fetch(url);
  const data = await res.json() as { errcode: number; errmsg: string; access_token: string; expires_in: number };

  if (data.errcode !== 0) {
    throw new Error(`获取 access_token 失败: ${data.errmsg} (errcode: ${data.errcode})`);
  }

  const bufferTime = 5 * 60 * 1000;
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000 - bufferTime,
  };
  saveTokenToCache(tokenCache);

  return data.access_token;
}
