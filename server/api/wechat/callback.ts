import { handleCallback } from "../../wechat/callback.ts";

export function _outCallback(req: Request) {
  return handleCallback(req);
}
