import { getAccessToken } from "./token.ts";

type MenuItem =
  | { type: "click"; click: { id: string; content: string } }
  | { type: "view"; view: { url: string; content: string } };

export type EventResponsePayload =
  | { msgtype: "text"; text: { content: string } }
  | { msgtype: "msgmenu"; msgmenu: { head_content?: string; list: MenuItem[]; tail_content?: string } };

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
  payload: EventResponsePayload,
): Promise<string> {
  const accessToken = await getAccessToken();
  const url = `https://qyapi.weixin.qq.com/cgi-bin/kf/send_msg_on_event?access_token=${accessToken}`;

  const body = { code, ...payload };

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

export async function sendMsgMenuMessage(
  headContent: string,
  menuList: MenuItem[],
  tailContent: string | undefined,
  openKfId: string,
  externalUserId: string,
): Promise<string> {
  const accessToken = await getAccessToken();
  const url = `https://qyapi.weixin.qq.com/cgi-bin/kf/send_msg?access_token=${accessToken}`;

  const body = {
    touser: externalUserId,
    open_kfid: openKfId,
    msgtype: "msgmenu",
    msgmenu: {
      head_content: headContent,
      list: menuList,
      tail_content: tailContent,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json() as { errcode: number; errmsg: string; msgid: string };

  if (data.errcode !== 0) {
    throw new Error(`发送菜单消息失败: ${data.errmsg} (errcode: ${data.errcode})`);
  }

  return data.msgid;
}
