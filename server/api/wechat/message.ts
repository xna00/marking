import { sendEventResponseMessage, sendTextMessage } from "./send.ts";
import { createUser, findUserByExternalUserId, findUserByUsername, insertCreditTransaction } from "../../db.ts";
import { completeLoginSession } from "./login.ts";
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
    let username: string;
    do {
      username = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
    } while (username.includes("4") || findUserByUsername(username));
    let password: string;
    do {
      password = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
    } while (password.includes("4"));
    createUser(external_userid, username, password);
    insertCreditTransaction(external_userid, 0, 400, "新用户赠送");
    reply = `已为您注册账号\n\n用户名：${username}\n密码：${password}`;
    log(`新用户注册: ${username}`);
  }

  if (msg.event.scene_param) {
    completeLoginSession(msg.event.scene_param, external_userid);
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
