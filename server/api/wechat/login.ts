import { randomBytes } from "node:crypto";
import { createUser, findUserByExternalUserId, updateUserToken } from "../../db.ts";

type LoginSession = {
  status: "pending" | "completed";
  externalUserId?: string;
  token?: string;
  createdAt: number;
};

const sessions = new Map<string, LoginSession>();
const TTL = 5 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [key, s] of sessions) {
    if (now - s.createdAt > TTL) sessions.delete(key);
  }
}, 60 * 1000);

export function createLoginSession(uuid: string): void {
  sessions.set(uuid, { status: "pending", createdAt: Date.now() });
}

export function completeLoginSession(uuid: string, externalUserId: string): LoginSession | null {
  const session = sessions.get(uuid);
  if (!session || session.status !== "pending") return null;

  const user = findUserByExternalUserId(externalUserId);
  if (!user) return null;

  const token = randomBytes(32).toString("hex");
  updateUserToken(externalUserId, token);

  session.status = "completed";
  session.externalUserId = externalUserId;
  session.token = token;
  return session;
}

export function getLoginSession(uuid: string): LoginSession | undefined {
  const session = sessions.get(uuid);
  if (!session) return undefined;
  if (Date.now() - session.createdAt > TTL) {
    sessions.delete(uuid);
    return undefined;
  }
  return session;
}
