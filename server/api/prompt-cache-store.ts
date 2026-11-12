import {
  listPromptCacheRows,
  insertPromptCacheRow,
  deletePromptCacheRow,
  prunePromptCacheRows,
} from "../db.ts";
import { API_KEY, DOUBAO_RESPONSES_URL, PROMPT_CACHE_TTL_SECONDS } from "./constants.ts";
import { buildPrefixCreateBody, parseArkError, parseCreateResponse } from "./responses.ts";
import { logger } from "../logger.ts";

// 显式上下文缓存（Prefix 缓存）的 responseId 映射。
// Ark 的响应 ID 由服务端生成、不可自定义，只能自己存；因为服务重启很频繁，
// 必须落库，否则每次重启都会白付一次创建费。
//
// 内存 Map 只是 DB 的镜像：读写都穿透到 DB，命中路径零查询。
//
// 刻意用 Prefix（多个请求共用一个创建 ID）而不是 Session（链式续接）：
// 每份答卷互相独立，链式会把上一个学生的答卷和评分带进下一个学生的上下文。
// 这不是性能优化，别再「优化」成串行链。
//
// 评分请求用 caching.type=disabled（只读前缀、不写本轮），实测与理由见 responses.ts 的 buildGradingBody。
// 各家对「关闭缓存」的语义并不统一，但没有任何一家把它解释成「连显式引用的缓存也不能读」：
// - AWS Bedrock 的 explicit 模式只关自动断点，显式断点仍参与读写；
// - Gemini 关隐式缓存后，显式缓存要另外「不创建、不引用」才算关掉；
// - OpenAI 没有开关，且 store=false 明确不影响缓存命中；
// - 只有 Anthropic / 通义那种「标记即引用」的设计，去掉标记才等于读写全无。
// 方舟 Prefix 的引用是 previous_response_id，与 caching.type 是两个字段，所以 disabled 仍读得到前缀。
// 若哪天服务端对齐文档改成不读，日志里的 cache=miss 会暴露；回退路径是 enabled + expire_at，已实测。

export type CacheEntry = {
  responseId: string;
  expireAt: number;
  prefixTokens: number;
};

// 「这条细则建不了缓存」的 key 集合，key 就是 cacheKey（含模型 + 提示词 hash）。
// 细则一改 key 就变，所以不需要 TTL、不需要落库：进程重启后每条细则
// 最多再打一次 400（不计费，只多一次往返）。失败详情在 createPrefix 里已经打了全量日志。
const unsupported = new Set<string>();

// 只记「请求内容本身有问题」的失败。401/403 是账号级（Chat 也会挂，记了没用），
// 429/5xx/超时是瞬时的，记下来会永久误伤这条细则。
const REJECTED_STATUS = new Set([400, 413, 422]);

const EXPIRE_MARGIN_SECONDS = 60;

let cache: Map<string, CacheEntry> | null = null;
// 同一细则的并发请求共享一次创建
const inflight = new Map<string, Promise<string | null>>();

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function ensureLoaded(): Map<string, CacheEntry> {
  if (!cache) {
    const now = nowSeconds();
    prunePromptCacheRows(now);
    const map = new Map<string, CacheEntry>();
    for (const row of listPromptCacheRows()) {
      if (row.expireAt - EXPIRE_MARGIN_SECONDS <= now) continue;
      map.set(row.key, {
        responseId: row.responseId,
        expireAt: row.expireAt,
        prefixTokens: row.prefixTokens,
      });
    }
    cache = map;
    logger.logWithId(`promptCache: loaded ${map.size} entries`);
  }
  return cache;
}

export function getEntry(key: string): CacheEntry | undefined {
  const map = ensureLoaded();
  const entry = map.get(key);
  if (!entry) return undefined;
  if (entry.expireAt - EXPIRE_MARGIN_SECONDS <= nowSeconds()) {
    map.delete(key);
    deletePromptCacheRow(key);
    logger.logWithId(`promptCache: expired key=${key.slice(0, 8)}`);
    return undefined;
  }
  return entry;
}

function save(key: string, model: string, entry: CacheEntry): void {
  // 同一 key 只保留最新一条：先删再插，避免依赖 ON CONFLICT 的解析支持
  deletePromptCacheRow(key);
  insertPromptCacheRow({
    key,
    model,
    responseId: entry.responseId,
    prefixTokens: entry.prefixTokens,
    expireAt: entry.expireAt,
    createdAt: new Date().toISOString(),
  });
  ensureLoaded().set(key, entry);
}

async function createPrefix(key: string, model: string, prompt: string): Promise<string | null> {
  try {
    const res = await fetch(DOUBAO_RESPONSES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(buildPrefixCreateBody(model, prompt, PROMPT_CACHE_TTL_SECONDS)),
      // 创建只写前缀、不产出内容，8s 足够；超时不记入 unsupported（可能是瞬时的）
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const raw = await res.text().catch(() => "");
      const info = parseArkError(raw);
      if (REJECTED_STATUS.has(res.status)) {
        unsupported.add(key);
      }
      // 服务端会直接告诉我们真实 token 数，比任何估算都准（实测约 0.64 token/字符）
      const perChar = info.currentTokens === null || prompt.length === 0
        ? "-"
        : (info.currentTokens / prompt.length).toFixed(2);
      logger.logWithId(
        `promptCache: create failed status=${res.status} code=${info.code ?? "-"} param=${info.param ?? "-"} ` +
          `chars=${prompt.length} currentTokens=${info.currentTokens ?? "-"} tokensPerChar=${perChar} key=${key.slice(0, 8)}`,
      );
      logger.logWithId(`promptCache: create failed body key=${key.slice(0, 8)}`, raw.slice(0, 300));
      return null;
    }

    const parsed = parseCreateResponse(await res.json());
    if (!parsed.ok) {
      // 创建成功但没有 id 就没法用；把原文打出来，下次请求会重新创建
      logger.logWithId(`promptCache: create invalid response key=${key.slice(0, 8)}`, parsed.raw);
      return null;
    }

    const entry: CacheEntry = {
      responseId: parsed.value.id,
      // 极端情况下响应里没有 expire_at，按自己的 TTL 退化，避免丢掉这次已计费的创建
      expireAt: parsed.value.expireAt ?? nowSeconds() + PROMPT_CACHE_TTL_SECONDS,
      prefixTokens: parsed.value.prefixTokens,
    };
    // 先落库再返回：创建期间重启也不会丢 ID（否则白付一次创建费）
    save(key, model, entry);
    logger.logWithId(
      `promptCache: created key=${key.slice(0, 8)} id=${entry.responseId} prefixTokens=${entry.prefixTokens} expireAt=${entry.expireAt}`,
    );
    return entry.responseId;
  } catch (e) {
    logger.logWithId(`promptCache: create error key=${key.slice(0, 8)}`, e);
    return null;
  }
}

// 返回可直接用于 previous_response_id 的 ID；失败返回 null（调用方回退 Chat）
export function ensureEntry(key: string, model: string, prompt: string): Promise<string | null> {
  const existing = getEntry(key);
  if (existing) return Promise.resolve(existing.responseId);

  // 本进程内已知建不了（前缀过短等），直接回退 Chat，不再发请求
  if (unsupported.has(key)) return Promise.resolve(null);

  const running = inflight.get(key);
  if (running) return running;

  const task = createPrefix(key, model, prompt).finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, task);
  return task;
}
