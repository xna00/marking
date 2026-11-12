// Responses API 相关的纯函数：请求体构造 + 响应解析 + 错误体解析。
// 抽出来是为了不依赖网络就能单测，ai.ts 只负责编排。
//
// 几个和 Chat API 不一样、容易踩的点（都按方舟文档来的）：
// - 图片是 input_image，image_url 直接是字符串（不是 Chat 的 { url } 对象）
// - 系统提示词只能作为 role:"system" 的 input 块；caching.type=enabled 与 instructions 冲突
// - Prefix 创建请求不能设 stream，且只写缓存、不产出内容（output_tokens=0）
// - expire_at 是 UTC 秒的绝对时间戳，使用缓存不会重置它
// - 评分请求用 disabled：仍能命中前缀缓存，但不把本轮输入写进缓存（详见 buildGradingBody）

import type { ImageDetail } from "./admin/model-store.ts";

export type MarkingUsage = {
  input: number;
  cached: number;
  output: number;
};

// 请求体契约。函数返回时不写注解，用 satisfies 校验：
// 既能编译期挡住拼错的键 / 写错的枚举，又保留推断出的具体形状。
type PrefixCreateBody = {
  model: string;
  input: { role: "system"; content: string }[];
  caching: { type: "enabled"; prefix: true };
  thinking: { type: "disabled" };
  expire_at: number;
  store: true;
};

type GradingBody = {
  model: string;
  input: {
    role: "user";
    content: { type: "input_image"; image_url: string; detail: ImageDetail }[];
  }[];
  caching: { type: "disabled" };
  previous_response_id: string;
  thinking: { type: "disabled" };
  store: false;
};

// 解析结果用判别联合：ok:true 之后字段一定齐全，调用方不用再逐个判空。
export type ParseResult<T> = { ok: true; value: T } | { ok: false; raw: unknown };

export type CreateResponseValue = {
  id: string;
  // 正常都会返回；缺失时由调用方退化为 now + ttl，不必因此丢掉这次创建
  expireAt: number | null;
  prefixTokens: number;
};

export type GradingResponseValue = {
  text: string;
  usage: MarkingUsage | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function buildPrefixCreateBody(model: string, prompt: string, ttlSeconds: number) {
  return {
    model,
    input: [{ role: "system", content: prompt }],
    caching: { type: "enabled", prefix: true },
    thinking: { type: "disabled" },
    expire_at: Math.floor(Date.now() / 1000) + ttlSeconds,
    store: true,
  } satisfies PrefixCreateBody;
}

// 评分请求：只读父前缀缓存，不写本轮、不留存响应。
// 实测（doubao-seed-2-1-lite / 2-0-mini）：
// - caching.type=disabled 仍能命中 previous_response_id 指向的前缀缓存。验证时把总输入压到
//   382 token（低于该模型 1024 的隐式门槛），排除隐式缓存的干扰，cached_tokens=274 只可能来自显式前缀。
//   这与现行文档「disabled 不读取」相悖，但和旧版 Context API 文档「前缀缓存无需配置 caching」一致。
// - 反过来，caching.type=enabled 会把本轮输入（含答卷图片）写进缓存，寿命跟随该响应的 expire_at
//   （默认 72h）。这些缓存挂在评分响应自己的 ID 下，我们从不引用，等于白付存储费（约为省下费用的 5 倍）。
// - caching.type=enabled 要求 store=true；disabled 时才能 store=false，从而让方舟不再留存答卷图片。
export function buildGradingBody(
  model: string,
  responseId: string,
  imageUrl: string,
  detail: ImageDetail,
) {
  return {
    model,
    input: [{
      role: "user",
      content: [{ type: "input_image", image_url: imageUrl, detail }],
    }],
    caching: { type: "disabled" },
    previous_response_id: responseId,
    thinking: { type: "disabled" },
    store: false,
  } satisfies GradingBody;
}

// 创建请求的响应：只关心 id / expire_at / 前缀 token 数，没有可读文本。
export function parseCreateResponse(json: unknown): ParseResult<CreateResponseValue> {
  if (!isRecord(json)) return { ok: false, raw: json };

  const id = typeof json.id === "string" && json.id.length > 0 ? json.id : null;
  if (id === null) return { ok: false, raw: json };

  const expireAt = typeof json.expire_at === "number" ? json.expire_at : null;
  const prefixTokens = isRecord(json.usage) ? toNumber(json.usage.input_tokens) : 0;
  return { ok: true, value: { id, expireAt, prefixTokens } };
}

// 方舟的错误体。前缀不足没有专属错误码：实测 code 一律是 InvalidParameter、
// param 是 input，唯一可用的信息是 message 里的真实 token 数（`current: 245`）。
// 把它抠出来记日志，顺便攒一份「字符数 → token 数」的实测对照。
export type ArkErrorInfo = {
  code: string | null;
  param: string | null;
  message: string | null;
  currentTokens: number | null;
};

const CURRENT_TOKENS_RE = /current:\s*(\d+)/;

export function parseArkError(raw: string): ArkErrorInfo {
  const empty: ArkErrorInfo = { code: null, param: null, message: null, currentTokens: null };

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return empty;
  }
  if (!isRecord(json)) return empty;

  const error = isRecord(json.error) ? json.error : json;
  const code = typeof error.code === "string" ? error.code : null;
  const param = typeof error.param === "string" ? error.param : null;
  const message = typeof error.message === "string" ? error.message : null;

  const matched = message === null ? null : CURRENT_TOKENS_RE.exec(message);
  const parsed = matched === null ? null : Number(matched[1]);
  const currentTokens = parsed !== null && Number.isFinite(parsed) ? parsed : null;

  return { code, param, message, currentTokens };
}

// 评分请求的响应：结构和文档一致（output[] → 消息项 → content[] → output_text）。
// 只有 200 才会走到这里，所以按 Chat 路径的既有写法直接断言；缺字段用 ?? 兜住，
// 结构真的不对时抛异常，由 doChatResponses 的 catch 回退 Chat（`as` 不校验运行时）。
type GradingResponseJson = {
  output?: { type: string; content?: { type: string; text?: string }[] }[];
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    input_tokens_details?: { cached_tokens?: number };
  };
};

export function parseGradingResponse(json: unknown): ParseResult<GradingResponseValue> {
  // res.json() 对 "null" / 纯字符串会返回非对象，直接取字段会抛
  if (typeof json !== "object" || json === null) return { ok: false, raw: json };
  const data = json as GradingResponseJson;

  const message = (data.output ?? []).find((item) => item.type === "message");
  const text = (message?.content ?? [])
    .filter((part) => part.type === "output_text")
    .map((part) => part.text ?? "")
    .join("");

  // 空文本：incomplete / 被拦截 / 拒答（文本在 message.refusal 里）都走这里回退 Chat
  if (text.length === 0) return { ok: false, raw: json };

  let usage: MarkingUsage | null = null;
  if (data.usage) {
    usage = {
      input: data.usage.input_tokens ?? 0,
      cached: data.usage.input_tokens_details?.cached_tokens ?? 0,
      output: data.usage.output_tokens ?? 0,
    };
  }

  return { ok: true, value: { text, usage } };
}
