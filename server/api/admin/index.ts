import { getCurrentUser } from "../auth.ts";
import { findUserByUsername, insertCreditTransaction, sumCredits, sumConsumedCredits, listAllUsers } from "../../db.ts";
import { getAllModels, saveModel, setDefaultModel as storeSetDefaultModel, type ModelPatch } from "./model-store.ts";
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

export async function listUsers(body: { query?: string; limit?: number; offset?: number } = {}) {
  await requireAdmin();

  const limit = body.limit ?? 50;
  const offset = body.offset ?? 0;
  const query = body.query?.trim().toLowerCase() ?? "";

  // listAllUsers 已按注册时间从新到旧排好，filter 保持顺序
  const users = listAllUsers().filter((u) => !query || u.username.toLowerCase().includes(query));
  const total = users.length;
  const rows = users.slice(offset, offset + limit).map((u) => {
    const totalCredits = sumCredits(u.externalUserId);
    const consumedCredits = sumConsumedCredits(u.externalUserId);
    return {
      username: u.username,
      nickname: u.nickname,
      avatar: u.avatar,
      createdAt: u.createdAt,
      totalCredits,
      consumedCredits,
      remainingCredits: totalCredits - consumedCredits,
    };
  });

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
