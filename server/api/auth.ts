import { randomBytes } from "node:crypto";
import { findUserByToken, findUserByUsername, updateUserLastActive, updateUserToken, verifyPassword, type User } from "../db.ts";
import { getInfo } from "../request-context.ts";
import { ApiError } from "./utils.ts";

// 节流窗口：避免每个认证请求都写一次 lastActiveAt
const LAST_ACTIVE_THROTTLE_MS = 5 * 60 * 1000;

export async function getUserIfLoggedIn(): Promise<User | null> {
  const info = getInfo();
  const auth = info.request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const user = findUserByToken(token) ?? null;
  if (user) updateLastActiveIfStale(user);
  return user;
}

function updateLastActiveIfStale(user: User): void {
  const now = Date.now();
  const last = user.lastActiveAt ? Date.parse(user.lastActiveAt) : 0;
  if (now - last >= LAST_ACTIVE_THROTTLE_MS) {
    updateUserLastActive(user.externalUserId, new Date(now).toISOString());
  }
}

export async function getCurrentUser() {
  const user = await getUserIfLoggedIn();
  if (!user) throw new ApiError(401, "Unauthorized", {}, "API_UNAUTHORIZED", {});
  return user;
}

export async function currentUser() {
  const user = await getCurrentUser();
  return { username: user.username };
}

export async function login(body: { username: string; password: string }) {
  const { username, password } = body;
  if (!username || !password) {
    throw new ApiError(400, "用户名和密码不能为空", {}, "API_BAD_REQUEST", {});
  }
  const user = findUserByUsername(username);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new ApiError(401, "用户名或密码错误", {}, "API_UNAUTHORIZED", {});
  }
  const token = randomBytes(32).toString("hex");
  updateUserToken(user.externalUserId, token);
  return { token, username: user.username };
}
