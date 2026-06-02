import { findUserByToken } from "../db.ts";
import { getInfo } from "./global.ts";
import { ApiError } from "./utils.ts";

export async function currentUser() {
  const info = getInfo();
  const auth = info.request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) throw new ApiError(401, {}, "Unauthorized");
  const token = auth.slice(7);
  const user = findUserByToken(token);
  if (!user) throw new ApiError(401, {}, "Unauthorized");
  return user;
}
