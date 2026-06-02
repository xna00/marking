import { getAccessToken } from "./token.ts";

export async function sendTextMessage(
  content: string,
  openKfId: string,
  externalUserId: string,
): Promise<string> {
  const accessToken = await getAccessToken();
  const url = `https://qyapi.weixin.qq.com/cgi-bin/kf/send_msg?access_token=${accessToken}`;

  const body = {
    touser: externalUserId,
    open_kfid: openKfId,
    msgtype: "text",
    text: { content },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json() as { errcode: number; errmsg: string; msgid: string };

  if (data.errcode !== 0) {
    throw new Error(`发送消息失败: ${data.errmsg} (errcode: ${data.errcode})`);
  }

  return data.msgid;
}

export async function sendEventResponseMessage(
  code: string,
  content: string,
): Promise<string> {
  const accessToken = await getAccessToken();
  const url = `https://qyapi.weixin.qq.com/cgi-bin/kf/send_msg_on_event?access_token=${accessToken}`;

  const body = {
    code,
    msgtype: "text",
    text: { content },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json() as { errcode: number; errmsg: string; msgid: string };

  if (data.errcode !== 0) {
    throw new Error(`发送事件响应消息失败: ${data.errmsg} (errcode: ${data.errcode})`);
  }

  return data.msgid;
}
