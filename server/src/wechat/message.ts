import { randomBytes } from "node:crypto";
import { sendEventResponseMessage, sendTextMessage } from "./send.ts";
import { createUser, findUserByExternalUserId } from "../db.ts";
import type { KfEventMessage, KfTextMessage, KfMessage } from "./sync.ts";

function log(...args: unknown[]) {
  console.log(`[${new Date().toLocaleString()}] [wechat]`, ...args);
}

function getExternalUserId(msg: KfMessage): string {
  if (msg.msgtype === "event") return msg.event.external_userid;
  return msg.external_userid;
}

async function handleEnterSession(msg: KfEventMessage) {
  log(msg.event);
  const { welcome_code, external_userid, open_kfid } = msg.event;

  if (!external_userid || !open_kfid) {
    log("缺少必要字段，跳过");
    return;
  }

  let reply: string;
  const existing = findUserByExternalUserId(external_userid);

  if (existing) {
    reply = `欢迎，${existing.username}`;
    log(`老用户进入会话: ${existing.username}`);
  } else {
    const username = "u_" + external_userid.slice(-8);
    const password = randomBytes(6).toString("base64url");
    createUser(external_userid, username, password);
    reply = `已为您分配账号：${username}，${password}`;
    log(`新用户注册: ${username}`);
  }

  if (welcome_code) {
    try {
      await sendEventResponseMessage(welcome_code, reply);
      log(`事件响应消息已发送: ${reply}`);
    } catch (e) {
      log(`事件响应消息失败: ${e}`);
    }
  }

  try {
    await sendTextMessage(reply, open_kfid, external_userid);
    log(`普通消息已发送: ${reply}`);
  } catch (e) {
    log(`普通消息发送失败: ${e}`);
  }
}

async function handleTextMessage(msg: KfTextMessage) {
  const content = msg.text.content;
  log(`收到文字消息: ${content}`);
}

export async function handleMessages(messages: KfMessage[]) {
  log(`共 ${messages.length} 条消息`);

  const grouped = Object.groupBy(messages, msg => getExternalUserId(msg));

  for (const [userId, msgs = []] of Object.entries(grouped)) {
    log(`用户 ${userId} 的 ${msgs.length} 条消息`);

    for (const msg of msgs) {
      if (msg.msgtype === "event") {
        log(`事件消息: ${msg.event.event_type}`);
        if (msg.event.event_type === "enter_session") {
          await handleEnterSession(msg);
        }
      } else if (msg.msgtype === "text") {
        await handleTextMessage(msg);
      }
    }
  }
}
