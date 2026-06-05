import { findUserByToken, type User } from "../db.ts";
import { getInfo } from "./global.ts";
import { ApiError } from "./utils.ts";

export async function getUserIfLoggedIn(): Promise<User | null> {
  const info = getInfo();
  const auth = info.request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  return findUserByToken(token) ?? null;
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
