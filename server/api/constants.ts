function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    console.log(`${name} 环境变量未设置`);
    process.exit(1);
  }
  return val;
}

export const API_KEY = requireEnv("DOUBAO_API_KEY");
export const LOGIN_KF_ID = requireEnv("LOGIN_KF_ID");
export const ADMIN_USERNAME = requireEnv("ADMIN_USERNAME");
export const DOUBAO_URL = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";
export const DOUBAO_RESPONSES_URL = "https://ark.cn-beijing.volces.com/api/v3/responses";

// 显式上下文缓存（Prefix 缓存）开关，`.env` 里 `PROMPT_CACHE=1` 才启用。
// 默认关：代码可以先部署、确认无异常后再启用；出问题改 .env + 重启即可回滚。
export const PROMPT_CACHE_ENABLED = process.env.PROMPT_CACHE === "1";
// 不设前置门槛：前缀是否够 256 token 由服务端判定，400 不计费，
// 失败结果在 prompt-cache-store 里按 cacheKey 记一次，不再自己估算。
// TTL 固定 24 小时：按「一个细则当天批完」的实际情况定的，再长只会多付存储费。
// 不做成环境变量——改它等于改缓存生命周期，属于该走 review 的变更，不是运行时开关。
export const PROMPT_CACHE_TTL_SECONDS = 86400;

export const SITE_HOST = "https://marking.112287.xyz";
