import { sendEventResponseMessage } from "./send.ts";
import type { KfEventMessage, KfTextMessage } from "./sync.ts";

function log(...args: unknown[]) {
  console.log(`[${new Date().toLocaleString()}] [wechat]`, ...args);
}

async function handleEnterSession(msg: KfEventMessage) {
  log(`完整事件数据: ${JSON.stringify(msg.event)}`);

  const { welcome_code, external_userid, open_kfid } = msg.event;

  log(`用户进入会话: external_userid=${external_userid}, open_kfid=${open_kfid}, welcome_code=${welcome_code ? "有" : "无"}`);

  if (!welcome_code || !external_userid || !open_kfid) {
    log("缺少必要字段，跳过");
    return;
  }

  await sendEventResponseMessage(
    welcome_code,
    `欢迎使用！您的用户 ID: ${external_userid}\n（后续将自动为您创建账号）`,
  );
  log(`欢迎消息已发送: ${external_userid}`);
}

async function handleTextMessage(msg: KfTextMessage) {
  const content = msg.text.content;
  log(`收到文字消息: ${content}`);
}

export async function handleMessages(messages: import("./sync.ts").KfMessage[]) {
  log(`共 ${messages.length} 条消息`);

  for (const msg of messages) {
    switch (msg.msgtype) {
      case "event":
        log(`事件消息: ${msg.event.event_type}`);
        if (msg.event.event_type === "enter_session") {
          await handleEnterSession(msg);
        }
        break;
      case "text":
        await handleTextMessage(msg);
        break;
    }
  }
}
