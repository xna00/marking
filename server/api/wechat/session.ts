import { getLoginSession } from "../../wechat/login.ts";

export function poll(data: { uuid: string }) {
  const session = getLoginSession(data.uuid);
  if (!session) return { status: "expired" };
  if (session.status === "pending") return { status: "pending" };
  return { status: "completed", token: session.token, username: session.externalUserId };
}
