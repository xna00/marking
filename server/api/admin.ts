import { getCurrentUser } from "./auth.ts";
import { findUserByUsername, insertCreditTransaction, sumCredits, sumConsumedCredits } from "../db.ts";
import { ADMIN_USERNAME } from "./constants.ts";
import { ApiError } from "./utils.ts";

export async function recharge(body: { targetUsername: string; credits: number; amountMoney: number; description?: string }) {
  const admin = await getCurrentUser();
  if (admin.username !== ADMIN_USERNAME) {
    throw new ApiError(403, "无权限", {}, "API_FORBIDDEN", {});
  }

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
