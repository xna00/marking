import { jsonrepair } from "jsonrepair";
import { DOUBAO_URL, DOUBAO_RESPONSES_URL, API_KEY, SITE_HOST, PROMPT_CACHE_ENABLED } from "./constants.ts";
import { ApiError } from "./utils.ts";
import { getCurrentUser, getUserIfLoggedIn } from "./auth.ts";
import { insertMarkRecord, confirmMarkRecord, countConfirmedRecords, sumCredits, sumConsumedCredits, getTransactions as getDbTransactions, getUsageHistory as getDbUsageHistory, countTransactions as countDbTransactions, countUsageHistory as countDbUsageHistory, insertMarkLog } from "../db.ts";
import { logger } from "../logger.ts";
import { CONFIRM_MARK_MARKER_BASE64, type confirmMarkData } from "@marking/shared";
import { getModelDef, resolveModel, resolveDetail, getModels as getModelsFromStore } from "./admin/model-store.ts";
import { getActivePromptContent, PROMPT_PLACEHOLDER } from "./admin/prompt-store.ts";
import { ensureEntry } from "./prompt-cache-store.ts";
import { buildGradingBody, parseGradingResponse } from "./responses.ts";
import { createHash } from "node:crypto";
import { brotliCompress } from "node:zlib";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";

type ConfigItem = {
  position: string;
  points: number;
  markingCriteria: string;
};

// 题型：决定评分提示词模板（第 2 步起按题型取模板；default 用现有默认提示词）。
// 列表值由服务器定义并通过 getQuestionTypes() 下发给扩展下拉，加/减题型只改这里，
// 扩展不用重新发版。服务器是唯一事实源。
export const QUESTION_TYPES = ["default", "chineseEssay", "short"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];
export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  default: "默认",
  chineseEssay: "语文作文",
  short: "简答",
};

type ChatBody = {
  model: string;
  config: ConfigItem[];
  imageUrl: string;
  // 题型（第 1 步只声明并透传，第 2 步起参与选提示词模板；缺省走 default）
  questionType?: QuestionType;
  // 诊断字段集中一处：服务端只读、只打日志，不参与评分与缓存 key。
  // 当前用于定位语文作文图片拼接颠倒的根因（URL 命名是否与上下位置一致）。
  diag?: {
    // 参与上下拼接的每张切片原始 URL（扩展已按字母序排好）
    rawUrls?: string[];
  };
};

type RawAIResultItem = [string, number, string];

export type AIResultItem = { text: string; score: number; reason: string };

// 提示词模板存在 prompt 表里，由后台「提示词管理」维护（首次访问自动写入内置默认）
function constructPrompt(config: ConfigItem[]): string {
  const header = "序号|位置|分值|评分标准";
  const separator = "-|-|-|-";
  const rows = config.map((item, i) => `${i + 1}|${item.position}|${item.points}|${item.markingCriteria}`).join("\n");
  const mdTable = [header, separator, rows].join("\n");
  return getActivePromptContent().replace(PROMPT_PLACEHOLDER, mdTable);
}

// 模型定义 / 价格 / 默认 / 启用状态统一由 model-store 管理（DB 表 + 内存缓存），
// 这里只保留给扩展用的 getModels 入口。
export async function getModels() {
  return getModelsFromStore();
}

// 题型列表（值 + 显示名）下发给扩展下拉，与模型列表同模式。
export async function getQuestionTypes(): Promise<{ value: QuestionType; label: string }[]> {
  return QUESTION_TYPES.map((v) => ({ value: v, label: QUESTION_TYPE_LABELS[v] }));
}

// 隐式缓存的「缓存路由标识」（方舟 Prompt Cache Key）：按 Endpoint + 模型 + 该取值
// 做路由映射，取值相同的请求优先落到缓存过该前缀的服务上，提升命中概率。
// 只有模型和提示词（含评分标准表）都相同时才共享，所以两者都进 hash；
// 用摘要而不是原文，符合文档「不要用 Prompt 原文」的要求。
function promptCacheKey(resolvedModel: string, prompt: string): string {
  return createHash("sha256")
    .update(resolvedModel)
    .update("\n")
    .update(prompt)
    .digest("hex")
    .slice(0, 32);
}

// 把模型返回的 JSON 数组解析成结构化结果。Chat / Responses 两条路径共用。
function parseMarkingContent(content: string): AIResultItem[] {
  const repaired = jsonrepair(content);
  const parsed: unknown = JSON.parse(repaired);

  if (!Array.isArray(parsed)) {
    throw new Error(`AI response is not an array: ${content}`);
  }

  const raw: RawAIResultItem[] = [];
  for (const item of parsed) {
    if (!Array.isArray(item) || item.length < 3) {
      throw new Error(`AI returned invalid item: ${content}`);
    }
    raw.push([String(item[0]), Number(item[1]), String(item[2])]);
  }

  return raw.map(([text, score, reason]) => ({
    text,
    score,
    reason,
  }));
}

// 豆包官方计费：费用 = 输入价×(输入token−命中token) + 命中价×命中token + 输出价×输出token
function logUsage(tag: string, resolvedModel: string, input: number, cached: number, output: number): void {
  const p = getModelDef(resolvedModel);
  const cost = p
    ? ((input - cached) * p.inputPrice + cached * p.cacheHitPrice + output * p.outputPrice) / 1_000_000
    : 0;
  logger.logWithId(`${tag}: 输入${input} 缓存命中${cached} 输出${output} 总计${input + output} 费用${cost.toFixed(4)}元`);
}

class ResponsesCallError extends Error {
  readonly status: number;
  // 4xx 里除了 408/429 都是确定性错误（缓存 ID 失效、请求体不被接受），
  // 重试只会把同一个 400 再打一遍，所以直接放弃并交给编排层处理。
  readonly retryable: boolean;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ResponsesCallError";
    this.status = status;
    this.retryable = status >= 500 || status === 408 || status === 429;
  }
}

// 走 Responses API + previous_response_id 复用 Prefix 缓存。
// 命中失败（cached_tokens=0）不重试：这次请求本身是有效的，只是没吃到缓存价，
// 直接返回结果最省（重试等于再花一次全价）。
async function doChatResponses(
  body: ChatBody,
  resolvedModel: string,
  cacheKey: string,
  responseId: string,
): Promise<AIResultItem[]> {
  const fetchBody = buildGradingBody(resolvedModel, responseId, body.imageUrl, resolveDetail(body.model));
  const errors: Error[] = [];

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      logger.logWithId(`=> responses model=${resolvedModel}, cacheKey=${cacheKey.slice(0, 8)}, cacheId=${responseId}, image=${body.imageUrl.slice(0, 60)}...${body.imageUrl.length}chars`);
      for (const cfg of body.config) logger.logWithId(`  ${cfg.position} ${cfg.points}分 ${cfg.markingCriteria}`);
      const start = Date.now();
      const res = await fetch(DOUBAO_RESPONSES_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify(fetchBody),
        signal: AbortSignal.timeout(30000),
        duplex: "half",
      });
      const ms = Date.now() - start;
      logger.logWithId('<=', res.status, `(${ms}ms)`);

      if (!res.ok) {
        const errorBody = await res.text().catch(() => "");
        throw new ResponsesCallError(res.status, `AI API error ${res.status}: ${errorBody.slice(0, 500)}`);
      }

      const parsed = parseGradingResponse(await res.json());
      if (!parsed.ok) {
        // 空文本/incomplete 之类的原因只在原始响应里，直接打出来
        throw new Error(`Unexpected AI response: ${JSON.stringify(parsed.raw)}`);
      }

      logger.logWithId('body:', parsed.value.text);
      const usage = parsed.value.usage;
      if (usage) {
        logUsage('tokens', resolvedModel, usage.input, usage.cached, usage.output);
        logger.logWithId(`cache=${usage.cached > 0 ? "hit" : "miss"} key=${cacheKey.slice(0, 8)} cached=${usage.cached}`);
      }

      return parseMarkingContent(parsed.value.text);
    } catch (e) {
      logger.logWithId('attempt', attempt + 1, 'failed:', e);
      errors.push(e instanceof Error ? e : new Error(String(e)));
      if (e instanceof ResponsesCallError && !e.retryable) break;
    }
  }

  throw errors.at(-1) ?? new Error("Responses 调用失败");
}

async function doChatChat(
  body: ChatBody,
  prompt: string,
  resolvedModel: string,
  cacheKey: string,
): Promise<AIResultItem[]> {
  const fetchBody = {
    model: resolvedModel,
    // 隐式缓存自动开启、不可关闭，这里只做路由亲和；不保证命中，也不额外计费
    prompt_cache_key: cacheKey,
    messages: [
      {
        role: "system",
        content: [{ type: "text", text: prompt }],
      },
      {
        role: "user",
        content: [{
          type: "image_url",
          image_url: {
            url: body.imageUrl,
            detail: resolveDetail(body.model),
          },
        }],
      },
    ],
    thinking: { type: "disabled" },
    // max_completion_tokens: 200,
  };

  const errors: unknown[] = [];
  let lastContent: string | undefined;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      logger.logWithId(`=> model=${resolvedModel}, cacheKey=${cacheKey.slice(0, 8)}, image=${body.imageUrl.slice(0, 60)}...${body.imageUrl.length}chars`);
      for (const cfg of body.config) logger.logWithId(`  ${cfg.position} ${cfg.points}分 ${cfg.markingCriteria}`);
      const start = Date.now();
      const res = await fetch(DOUBAO_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify(fetchBody),
        signal: AbortSignal.timeout(30000),
        duplex: "half",
      });
      const ms = Date.now() - start;
      logger.logWithId('<=', res.status, `(${ms}ms)`);

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new Error(`AI API error ${res.status}: ${JSON.stringify(errorBody)}`);
      }

      // 豆包 Ark 响应。res.json() 在 node 下返回 unknown，这里按我们读取的字段
      // 做最小结构声明（不完整校验 schema，非关键路径，缺失字段都有兜底）
      const data = await res.json() as {
        choices?: { message?: { content?: string } }[];
        usage?: {
          prompt_tokens: number;
          completion_tokens: number;
          total_tokens: number;
          prompt_tokens_details?: { cached_tokens?: number };
        };
      };
      const content = data.choices?.[0]?.message?.content;
      lastContent = content;

      logger.logWithId('body:', content);
      if (data.usage) {
        logUsage(
          'tokens',
          resolvedModel,
          data.usage.prompt_tokens,
          data.usage.prompt_tokens_details?.cached_tokens ?? 0,
          data.usage.completion_tokens,
        );
      }

      if (!content) {
        throw new Error(`Unexpected AI response: ${JSON.stringify(data)}`);
      }

      return parseMarkingContent(content);
    } catch (e) {
      logger.logWithId('attempt', attempt + 1, 'failed:', e);
      errors.push(e);
    }
  }

  throw new ApiError(502, `3 次重试均失败: ${errors.map(e => String(e)).join("; ")}`, {}, "API_AI_FAILED", { rawContent: lastContent });
}

// 编排：能用显式缓存就走 Responses（第一份也吃命中价），任何异常都回退到 Chat。
async function doChat(body: ChatBody): Promise<AIResultItem[]> {
  const prompt = constructPrompt(body.config);
  const resolvedModel = resolveModel(body.model);
  const cacheKey = promptCacheKey(resolvedModel, prompt);

  // 诊断日志：拼接顺序由扩展按 URL 路径名字母序排好后整图发来，
  // 这里记录参与拼接的每张切片原始 URL，供比对真实命名与上下位置是否一致。
  const diagUrls = body.diag?.rawUrls;
  if (diagUrls?.length) {
    logger.logWithId(`sliceUrls[${diagUrls.length}]: ${diagUrls.join(" | ")}`);
  }

  // 不预估前缀长度：够不够 256 token 交给服务端判定（400 不计费），
  // 失败的细则由 prompt-cache-store 按 key 记住，本进程不再重试。
  if (PROMPT_CACHE_ENABLED) {
    // 整段都在 try 里：缓存层自己的异常（DB 读写、响应解析）也不能让评分失败
    try {
      const responseId = await ensureEntry(cacheKey, resolvedModel, prompt);
      if (responseId) {
        return await doChatResponses(body, resolvedModel, cacheKey, responseId);
      }
    } catch (e) {
      logger.logWithId(`promptCache: 缓存路径失败，回退 Chat key=${cacheKey.slice(0, 8)}`, e);
      // 前缀只按 expireAt 过期删除（见 getEntry）；评分响应失败不删前缀。
      // 副作用：若 Ark 侧提前回收了前缀，本地映射仍引用它，每次请求会多一次 400 再回退 Chat，
      // 直到本地过期才重建。已知取舍，接受（错误消息判据不可靠）。
    }
  }

  return doChatChat(body, prompt, resolvedModel, cacheKey);
}

export async function getBalance() {
  const user = await getCurrentUser();
  const totalCredits = sumCredits(user.externalUserId);
  const confirmedCount = countConfirmedRecords(user.externalUserId);
  const consumedCredits = sumConsumedCredits(user.externalUserId);
  return { totalCredits, confirmedCount, consumedCredits, remainingCredits: totalCredits - consumedCredits };
}

export async function getTransactions(body: { limit?: number; offset?: number } = {}) {
  const user = await getCurrentUser();
  const limit = body.limit ?? 50;
  const offset = body.offset ?? 0;
  const rows = getDbTransactions(user.externalUserId, limit, offset);
  const total = countDbTransactions(user.externalUserId);
  return { rows, total };
}

export async function getUsageHistory(body: { limit?: number; offset?: number } = {}) {
  const user = await getCurrentUser();
  const limit = body.limit ?? 50;
  const offset = body.offset ?? 0;
  const rows = getDbUsageHistory(user.externalUserId, limit, offset);
  const total = countDbUsageHistory(user.externalUserId);
  return { rows, total };
}



async function saveImageFile(dataUrl: string): Promise<string> {
  const base64Index = dataUrl.indexOf("base64,");
  if (base64Index === -1) return "";
  const base64 = dataUrl.slice(base64Index + 7);
  const buffer = Buffer.from(base64, "base64");
  const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 12);
  const filename = `${hash}.webp`;
  const dir = join(process.cwd(), "data", "mark-images");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, filename), buffer);
  brotliCompress(buffer, (err, compressed) => {
    if (err) return;
    writeFile(join(dir, `${filename}.br`), compressed).then(
      () => unlink(join(dir, filename)).catch(() => {}),
      () => {},
    );
  });
  return filename;
}

export async function markImage(body: ChatBody): Promise<{
  result: AIResultItem[]; markRecordId: number, usage:
  { confirmedCount: number, consumedCredits: number, totalCredits: number, remainingCredits: number }
}> {
  const user = await getCurrentUser();

  if (body.imageUrl.endsWith(CONFIRM_MARK_MARKER_BASE64)) {
    const end = body.imageUrl.length - CONFIRM_MARK_MARKER_BASE64.length
    const start = body.imageUrl.lastIndexOf(CONFIRM_MARK_MARKER_BASE64, end - 1) + CONFIRM_MARK_MARKER_BASE64.length
    const dataStr = atob(body.imageUrl.slice(start, end))
    logger.logWithId('confirm data:', dataStr)
    body.imageUrl = body.imageUrl.slice(0, start - CONFIRM_MARK_MARKER_BASE64.length)
    try {
      const data = JSON.parse(dataStr) as confirmMarkData
      for (const r of data.recordIds) {
        confirmMarkRecord(r.markRecordId, user.externalUserId)
      }
    } catch (error) {
      logger.logWithId(error)
    }
  }
  // 余额不足禁止改卷：无论普通改卷还是确认标记，doChat + 扣费前统一检查
  const total = sumCredits(user.externalUserId);
  const consumed = sumConsumedCredits(user.externalUserId);
  if (total - consumed <= 0) {
    throw new ApiError(
      402,
      `余额不足，请<a href="${SITE_HOST}/app/#/recharge" target="_blank" rel="noopener noreferrer">充值</a>`,
      {},
      "API_INSUFFICIENT_CREDITS",
      {},
    );
  }
  const result = await doChat(body);
  const markRecordId = insertMarkRecord(user.externalUserId, 1);
  logger.logWithId(`markImage: recordId=${markRecordId}, userName=${user.username}, userId=${user.externalUserId}`);
  try {
    const imageFilename = await saveImageFile(body.imageUrl);
    insertMarkLog(user.externalUserId, body.model, JSON.stringify(body.config), imageFilename, JSON.stringify(result), markRecordId);
    logger.logWithId(`markLog: image=${imageFilename}`);
  } catch (e) {
    logger.logWithId('markLog error:', e);
  }
  const confirmedCount = countConfirmedRecords(user.externalUserId);
  const consumedCredits = sumConsumedCredits(user.externalUserId); // 重读：确认状态已变
  const totalCredits = total; // 复用检查点读的值（充值不改卷中不变）
  const remainingCredits = totalCredits - consumedCredits;
  logger.logWithId(`confirmMark result: confirmedCount=${confirmedCount}, consumedCredits=${consumedCredits}, totalCredits=${totalCredits}, remainingCredits=${remainingCredits}`);
  return { result, markRecordId, usage: { confirmedCount, consumedCredits, totalCredits, remainingCredits } };
}

export async function confirmMark(body: { markRecordId: number }) {
  const user = await getCurrentUser();
  logger.logWithId(`confirmMark: ${JSON.stringify(body)}, userName=${user.username}, userId=${user.externalUserId}`);
  const ok = confirmMarkRecord(body.markRecordId, user.externalUserId);
  if (!ok) throw new ApiError(403, "Forbidden", {}, "API_FORBIDDEN", {});
  const confirmedCount = countConfirmedRecords(user.externalUserId);
  const consumedCredits = sumConsumedCredits(user.externalUserId);
  const totalCredits = sumCredits(user.externalUserId);
  const remainingCredits = totalCredits - consumedCredits;
  logger.logWithId(`confirmMark result: confirmedCount=${confirmedCount}, consumedCredits=${consumedCredits}, totalCredits=${totalCredits}, remainingCredits=${remainingCredits}`);
  return { success: true, usage: { confirmedCount, consumedCredits, totalCredits, remainingCredits } };
}

export async function testMarkImage(body: ChatBody): Promise<AIResultItem[]> {
  await getUserIfLoggedIn();
  return doChat(body);
}
