import { getCurrentUser } from "../auth.ts";
import { findUserByUsername, insertCreditTransaction, sumCredits, sumConsumedCredits, listAllUsers, listCreditSums, listConsumedSums, listCreditTransactions, summarizeCreditTransactions } from "../../db.ts";
import { getAllModels, saveModel, setDefaultModel as storeSetDefaultModel, type ModelPatch } from "./model-store.ts";
import {
  getAllPrompts,
  createPrompt as storeCreatePrompt,
  deletePrompt as storeDeletePrompt,
  setDefaultPrompt as storeSetDefaultPrompt,
  PROMPT_PLACEHOLDER,
} from "./prompt-store.ts";
import { QUESTION_TYPES, type QuestionType } from "../question-types.ts";
import { ADMIN_USERNAME } from "../constants.ts";
import { ApiError } from "../utils.ts";

async function requireAdmin() {
  const admin = await getCurrentUser();
  if (admin.username !== ADMIN_USERNAME) {
    throw new ApiError(403, "无权限", {}, "API_FORBIDDEN", {});
  }
  return admin;
}

export async function recharge(body: { targetUsername: string; credits: number; amountMoney: number; description?: string }) {
  await requireAdmin();

  const { targetUsername, credits, amountMoney, description } = body;
  if (!targetUsername || !credits || credits <= 0 || !amountMoney || amountMoney <= 0) {
    throw new ApiError(400, "参数错误", {}, "API_BAD_REQUEST", {});
  }

  const target = findUserByUsername(targetUsername);
  if (!target) {
    throw new ApiError(404, "用户不存在", {}, "API_NOT_FOUND", { url: "" });
  }

  insertCreditTransaction(target.externalUserId, Math.round(amountMoney * 100), credits, description);

  const totalCredits = sumCredits(target.externalUserId);
  const consumedCredits = sumConsumedCredits(target.externalUserId);

  return {
    success: true,
    user: targetUsername,
    addedCredits: credits,
    totalCredits,
    remainingCredits: totalCredits - consumedCredits,
  };
}

export async function listRecharges(body: { limit?: number; offset?: number; start?: string; end?: string } = {}) {
  await requireAdmin();

  const limit = Math.min(Math.max(body.limit ?? 20, 1), 100);
  const offset = Math.max(body.offset ?? 0, 0);
  const start = body.start || "0000";
  const end = body.end || "9999";
  const summary = summarizeCreditTransactions(start, end);
  return {
    rows: listCreditTransactions(limit, offset, start, end),
    total: summary.count,
    amountMoney: summary.amountMoney,
    amountCredits: summary.amountCredits,
  };
}

// 用户列表可排序的列：不支持按用户名排序（搜索框已经能按用户名过滤）
const USER_SORT_KEYS = ["totalCredits", "consumedCredits", "remainingCredits", "createdAt", "lastActiveAt"] as const;
type UserSortKey = (typeof USER_SORT_KEYS)[number];
type UserSortDir = "asc" | "desc";

type UserListRow = {
  username: string;
  nickname: string | null;
  avatar: string | null;
  createdAt: string;
  lastActiveAt: string | null;
  totalCredits: number;
  consumedCredits: number;
  remainingCredits: number;
};

const normalizeUserSortKey = (v: unknown): UserSortKey | null =>
  USER_SORT_KEYS.find((k) => k === v) ?? null;

const normalizeUserSortDir = (v: unknown): UserSortDir => (v === "asc" ? "asc" : "desc");

const compareUserRows = (a: UserListRow, b: UserListRow, sortBy: UserSortKey, sortDir: UserSortDir): number => {
  const dir = sortDir === "asc" ? 1 : -1;
  // 同值时用用户名兜底，保证分页顺序稳定（不会跨页重复/漏行）
  const tieBreak = a.username.localeCompare(b.username);

  if (sortBy === "lastActiveAt") {
    // 从未活跃（null）始终沉底，不随排序方向反转
    if (a.lastActiveAt === null || b.lastActiveAt === null) {
      if (a.lastActiveAt === b.lastActiveAt) return tieBreak;
      return a.lastActiveAt === null ? 1 : -1;
    }
    return a.lastActiveAt.localeCompare(b.lastActiveAt) * dir || tieBreak;
  }

  const va = a[sortBy];
  const vb = b[sortBy];
  if (va === vb) return tieBreak;
  if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
  return String(va).localeCompare(String(vb)) * dir || tieBreak;
};

export async function listUsers(body: { query?: string; limit?: number; offset?: number; sortBy?: string; sortDir?: string } = {}) {
  await requireAdmin();

  const limit = body.limit ?? 50;
  const offset = body.offset ?? 0;
  const query = body.query?.trim().toLowerCase() ?? "";
  // 非法 sortBy 整体回落 createdAt desc；sortDir 只认 asc，其余按 desc
  const requestedSortBy = normalizeUserSortKey(body.sortBy);
  const sortBy = requestedSortBy ?? "createdAt";
  const sortDir = requestedSortBy ? normalizeUserSortDir(body.sortDir) : "desc";

  // 一次查完全部用户的聚合，再做过滤/排序/分页：
  // 「充值/已用/剩余」不是 user 表字段，必须跨全量数据排序，否则跨页顺序是错的。
  const creditSums = new Map(listCreditSums().map((r) => [r.userId, r.total ?? 0]));
  const consumedSums = new Map(listConsumedSums().map((r) => [r.userId, r.total ?? 0]));

  const users = listAllUsers()
    .filter((u) => !query || u.username.toLowerCase().includes(query))
    .map((u) => {
      const totalCredits = creditSums.get(u.externalUserId) ?? 0;
      const consumedCredits = consumedSums.get(u.externalUserId) ?? 0;
      return {
        username: u.username,
        nickname: u.nickname,
        avatar: u.avatar,
        createdAt: u.createdAt,
        lastActiveAt: u.lastActiveAt,
        totalCredits,
        consumedCredits,
        remainingCredits: totalCredits - consumedCredits,
      };
    });

  users.sort((a, b) => compareUserRows(a, b, sortBy, sortDir));

  const total = users.length;
  const rows = users.slice(offset, offset + limit);
  return { rows, total };
}

export async function listModels() {
  await requireAdmin();
  return getAllModels();
}

export async function updateModel(body: { id: string; label?: string; inputPrice?: number; outputPrice?: number; cacheHitPrice?: number; detail?: "low" | "high"; enabled?: boolean }) {
  await requireAdmin();

  const { id, label, inputPrice, outputPrice, cacheHitPrice, detail, enabled } = body;
  if (!id) throw new ApiError(400, "参数错误", {}, "API_BAD_REQUEST", {});

  const patch: ModelPatch = {};
  if (label !== undefined) {
    if (typeof label !== "string" || !label.trim()) throw new ApiError(400, "label 不合法", {}, "API_BAD_REQUEST", {});
    patch.label = label.trim();
  }
  if (inputPrice !== undefined) {
    if (typeof inputPrice !== "number" || !Number.isFinite(inputPrice) || inputPrice < 0) throw new ApiError(400, "inputPrice 不合法", {}, "API_BAD_REQUEST", {});
    patch.inputPrice = inputPrice;
  }
  if (outputPrice !== undefined) {
    if (typeof outputPrice !== "number" || !Number.isFinite(outputPrice) || outputPrice < 0) throw new ApiError(400, "outputPrice 不合法", {}, "API_BAD_REQUEST", {});
    patch.outputPrice = outputPrice;
  }
  if (cacheHitPrice !== undefined) {
    if (typeof cacheHitPrice !== "number" || !Number.isFinite(cacheHitPrice) || cacheHitPrice < 0) throw new ApiError(400, "cacheHitPrice 不合法", {}, "API_BAD_REQUEST", {});
    patch.cacheHitPrice = cacheHitPrice;
  }
  if (detail !== undefined) {
    if (detail !== "low" && detail !== "high") throw new ApiError(400, "detail 不合法", {}, "API_BAD_REQUEST", {});
    patch.detail = detail;
  }
  if (enabled !== undefined) {
    if (typeof enabled !== "boolean") throw new ApiError(400, "enabled 不合法", {}, "API_BAD_REQUEST", {});
    patch.enabled = enabled;
  }

  try {
    return saveModel(id, patch);
  } catch (e) {
    throw new ApiError(404, e instanceof Error ? e.message : String(e), {}, "API_NOT_FOUND", { url: "" });
  }
}

export async function setDefaultModel(body: { id: string }) {
  await requireAdmin();

  if (!body?.id) throw new ApiError(400, "参数错误", {}, "API_BAD_REQUEST", {});
  try {
    return storeSetDefaultModel(body.id);
  } catch (e) {
    throw new ApiError(404, e instanceof Error ? e.message : String(e), {}, "API_NOT_FOUND", { url: "" });
  }
}

const MAX_PROMPT_CONTENT_LENGTH = 8000;

function validatePromptContent(content: unknown): string {
  if (typeof content !== "string" || !content.trim()) {
    throw new ApiError(400, "提示词内容不能为空", {}, "API_BAD_REQUEST", {});
  }
  // 占位符缺失会让评分标准无处可插，保存时就拦下来，避免运行时才发现
  if (!content.includes(PROMPT_PLACEHOLDER)) {
    throw new ApiError(400, `提示词必须包含占位符 ${PROMPT_PLACEHOLDER}`, {}, "API_BAD_REQUEST", {});
  }
  if (content.length > MAX_PROMPT_CONTENT_LENGTH) {
    throw new ApiError(400, `提示词内容不能超过 ${MAX_PROMPT_CONTENT_LENGTH} 字符`, {}, "API_BAD_REQUEST", {});
  }
  return content;
}

// 题型白名单校验：管理页新建必须指定合法题型，缺省/非法值兜底 default。
// 与 markImage 的白名单兜底一致，保证 prompt 表只存合法题型。
function validateQuestionType(qt: unknown): QuestionType {
  return QUESTION_TYPES.find((t) => t === qt) ?? "default";
}

export async function listPrompts() {
  await requireAdmin();
  return getAllPrompts();
}

export async function createPrompt(body: { content: string; questionType?: string }) {
  await requireAdmin();
  const content = validatePromptContent(body?.content);
  const questionType = validateQuestionType(body?.questionType);
  return storeCreatePrompt(content, questionType);
}

export async function deletePrompt(body: { id: string }) {
  await requireAdmin();
  if (!body?.id) throw new ApiError(400, "参数错误", {}, "API_BAD_REQUEST", {});

  try {
    storeDeletePrompt(body.id);
    return { success: true };
  } catch (e) {
    throw new ApiError(400, e instanceof Error ? e.message : String(e), {}, "API_BAD_REQUEST", {});
  }
}

export async function setDefaultPrompt(body: { id: string }) {
  await requireAdmin();
  if (!body?.id) throw new ApiError(400, "参数错误", {}, "API_BAD_REQUEST", {});

  try {
    return storeSetDefaultPrompt(body.id);
  } catch (e) {
    throw new ApiError(400, e instanceof Error ? e.message : String(e), {}, "API_BAD_REQUEST", {});
  }
}
