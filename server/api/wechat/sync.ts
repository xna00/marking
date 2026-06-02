import { getAccessToken } from "./token.ts";
import { loadCursor, saveCursor } from "../../db.ts";

export type EventMessage = {
  event_type: string;
  open_kfid: string;
  external_userid: string;
  scene?: string;
  scene_param?: string;
  welcome_code?: string;
  code?: string;
  fail_msgid?: string;
  fail_type?: number;
  servicer_userid?: string;
  status?: number;
  change_type?: number;
  old_servicer_userid?: string;
  new_servicer_userid?: string;
  msg_code?: string;
};

export type TextContent = {
  content: string;
  menu_id?: string;
};

type MediaContent = {
  media_id: string;
};

type MessageBase = {
  msgid: string;
  send_time: number;
  open_kfid: string;
  external_userid: string;
};

export type KfTextMessage = MessageBase & {
  msgtype: "text";
  text: TextContent;
};

export type KfEventMessage = {
  msgid: string;
  send_time: number;
  msgtype: "event";
  event: EventMessage;
};

export type KfImageMessage = MessageBase & {
  msgtype: "image";
  image: MediaContent;
};

export type KfVoiceMessage = MessageBase & {
  msgtype: "voice";
  voice: MediaContent;
};

export type KfVideoMessage = MessageBase & {
  msgtype: "video";
  video: MediaContent;
};

export type KfFileMessage = MessageBase & {
  msgtype: "file";
  file: MediaContent;
};

export type KfMessage = KfTextMessage | KfEventMessage | KfImageMessage | KfVoiceMessage | KfVideoMessage | KfFileMessage;

type SyncMsgResponse = {
  errcode: number;
  errmsg: string;
  next_cursor?: string;
  has_more?: number;
  msg_list?: KfMessage[];
};

export async function syncMessages(openKfId: string): Promise<KfMessage[]> {
  const allMessages: KfMessage[] = [];
  let cursor: string | undefined = loadCursor(openKfId) ?? undefined;

  while (true) {
    const accessToken = await getAccessToken();
    const url = `https://qyapi.weixin.qq.com/cgi-bin/kf/sync_msg?access_token=${accessToken}`;

    const body: Record<string, unknown> = {
      open_kfid: openKfId,
      limit: 1000,
      voice_format: 0,
    };
    if (cursor) body.cursor = cursor;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json() as SyncMsgResponse;

    if (data.errcode !== 0) {
      throw new Error(`同步消息失败: ${data.errmsg} (errcode: ${data.errcode})`);
    }

    if (data.msg_list) allMessages.push(...data.msg_list);

    if (data.next_cursor) {
      saveCursor(openKfId, data.next_cursor);
    }

    if (data.has_more !== 1 || !data.next_cursor) break;
    cursor = data.next_cursor;
  }

  return allMessages;
}
