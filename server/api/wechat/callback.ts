import { decrypt } from "@wecom/crypto";
import { syncMessages } from "./sync.ts";
import { handleMessages } from "./message.ts";

const ENCODING_AES_KEY = process.env.WECOM_KF_ENCODING_AES_KEY;

function log(...args: unknown[]) {
  console.log(`[${new Date().toLocaleString()}] [wechat]`, ...args);
}

type CallbackEvent = {
  ToUserName: string;
  CreateTime: number;
  MsgType: string;
  Event: string;
  Token: string;
  OpenKfId: string;
};

function parseXml(xmlString: string): CallbackEvent {
  const getValue = (tag: string): string => {
    const match = xmlString.match(new RegExp(`<${tag}><!\\[CDATA\\[(.*?)\\]\\]></${tag}>`));
    return match ? match[1] : "";
  };

  return {
    ToUserName: getValue("ToUserName"),
    CreateTime: parseInt(getValue("CreateTime") || "0"),
    MsgType: getValue("MsgType"),
    Event: getValue("Event"),
    Token: getValue("Token"),
    OpenKfId: getValue("OpenKfId"),
  };
}

async function validateUrl(req: Request): Promise<Response> {
  const searchParams = new URL(req.url).searchParams;
  const echostr = searchParams.get("echostr");
  if (!echostr || !ENCODING_AES_KEY) {
    return new Response("invalid request", { status: 400 });
  }
  const { message } = decrypt(ENCODING_AES_KEY, echostr);
  return new Response(message);
}

async function handlePost(req: Request): Promise<Response> {
  try {
    const body = await req.text();
    log("\n========== 收到回调 ==========");
    log("原始请求体（前200字符）:", body.substring(0, 200));

    const encryptMatch = body.match(/<Encrypt><!\[CDATA\[(.*?)\]\]><\/Encrypt>/);
    if (!encryptMatch) {
      log("未检测到加密消息");
      return new Response("success");
    }

    const encrypt = encryptMatch[1];
    if (!ENCODING_AES_KEY) {
      log("WECOM_ENCODING_AES_KEY 未设置");
      return new Response("success");
    }

    const { message } = decrypt(ENCODING_AES_KEY, encrypt);
    log("解密后的消息:", message);

    const event = parseXml(message);
    log("事件类型:", event.Event);
    log("客服账号:", event.OpenKfId);

    if (event.Event === "kf_msg_or_event") {
      log("\n开始拉取消息...");
      const msgList = await syncMessages(event.OpenKfId);
      log(`拉取到 ${msgList.length} 条消息`);
      if (msgList.length > 0) await handleMessages(msgList);
    }

    log("==============================\n");
    return new Response("success");
  } catch (error) {
    log("处理回调失败:", error);
    return new Response("success");
  }
}

export async function _outCallback(req: Request): Promise<Response> {
  if (req.method === "GET") {
    return validateUrl(req);
  }
  if (req.method === "POST") {
    return handlePost(req);
  }
  return new Response("method not allowed", { status: 405 });
}
