import { serve } from "@hono/node-server";
import { Hono } from "hono";
import type { Context, Next } from "hono";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { IncomingMessage } from "node:http";
import { handleCallback } from "./wechat/callback.ts";
import { initDb, findUserByToken } from "./db.ts";
import type { User } from "./db.ts";
import { createLoginSession, getLoginSession } from "./wechat/login.ts";
import { getKfServiceUrl } from "./wechat/contact.ts";

const API_KEY = process.env.DOUBAO_API_KEY;
if (!API_KEY) {
  log("DOUBAO_API_KEY 环境变量未设置");
  process.exit(1);
}

const LOGIN_KF_ID = process.env.LOGIN_KF_ID;
if (!LOGIN_KF_ID) {
  log("LOGIN_KF_ID 环境变量未设置");
  process.exit(1);
}


const DOUBAO_URL = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";

function log(...args: unknown[]) {
  console.log(`[${new Date().toLocaleString()}]`, ...args);
}

async function logRequestBody(id: string, bodyText: string, headers: Headers, clientIp: string) {
  const body = JSON.parse(bodyText);
  const model = body.model || "unknown";

  log(`[${id}] => model=${model}, ip=${clientIp}`);
  for (const key of ["user-agent", "host", "origin", "version"]) {
    const v = headers.get(key);
    if (v) log(`[${id}]   ${key}: ${v}`);
  }
  const logBody = structuredClone(body);
  for (const msg of logBody.messages || []) {
    for (const part of msg.content || []) {
      if (part.image_url?.url?.length > 200) {
        part.image_url.url = part.image_url.url.slice(0, 80) + `... (${part.image_url.url.length} chars)`;
      }
    }
  }
  log(`[${id}]   body: ${JSON.stringify(logBody)}`);

  const imgDir = "images";
  await mkdir(imgDir, { recursive: true });
  let imgIdx = 0;
  for (const msg of body.messages || []) {
    for (const part of msg.content || []) {
      const url: string | undefined = part.image_url?.url;
      if (!url) continue;
      const m = url.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!m) continue;
      const ext = m[1] === "jpeg" ? "jpg" : m[1];
      const data = Buffer.from(m[2], "base64");
      const filename = `${id}_${imgIdx++}.${ext}`;
      await writeFile(join(imgDir, filename), data);
      log(`[${id}]   saved image: ${filename} (${data.length} bytes)`);
    }
  }
}

type Variables = {
  user: User;
};

const app = new Hono<{ Bindings: { incoming: IncomingMessage }; Variables: Variables }>();

app.use("*", async (c, next) => {
  log(`${c.req.method} ${c.req.url}`);
  await next();
});

async function authMiddleware(c: Context<{ Variables: Variables }>, next: Next) {
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) return c.text("Unauthorized", 401);
  const token = auth.slice(7);
  const user = findUserByToken(token);
  if (!user) return c.text("Unauthorized", 401);
  c.set("user", user);
  await next();
}

// ── login ──

app.get("/api/wechat/qr", async (c) => {
  const sceneParam = c.req.query("sceneParam");
  if (!sceneParam) return c.json({ error: "缺少 sceneParam" }, 400);

  createLoginSession(sceneParam);
  const { url } = await getKfServiceUrl(LOGIN_KF_ID, "login", sceneParam);
  return c.json({ url });
});

app.get("/api/wechat/session/:uuid", async (c) => {
  const session = getLoginSession(c.req.param("uuid"));
  if (!session) return c.json({ status: "expired" });
  if (session.status === "pending") return c.json({ status: "pending" });
  return c.json({ status: "completed", token: session.token, username: session.externalUserId });
});

// ── wechat callback ──

app.all("/api/wechat/callback", async (c) => {
  const res = await handleCallback(c.req.raw);
  return res;
});

app.post("/api/v1/chat/completions", async (c) => {
  const id = Math.random().toString(36).slice(2, 8);

  if (!c.req.raw.body) {
    return c.text("request body is required", 400);
  }

  const savePromise = c.req.raw.clone().text().then((bodyText) =>
    logRequestBody(id, bodyText, c.req.raw.headers, c.env.incoming.socket?.remoteAddress ?? ""));

  // 立即转发
  const start = Date.now();
  const fetchPromise = fetch(DOUBAO_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: c.req.raw.body,
    duplex: "half",
  });

  const res = await fetchPromise;
  const ms = Date.now() - start;
  log(`[${id}] <= ${res.status} (${ms}ms)`);

  res.clone().text()
    .then(body => log(`[${id}] body: ${body}`))
    .catch(err => log(`[${id}] body error: ${err}`));

  // 保存逻辑不要阻塞响应
  savePromise.catch((e) => log(`[${id}]   save error:`, e));

  const outHeaders = new Headers(res.headers);
  outHeaders.delete("content-encoding");
  outHeaders.delete("content-length");

  return c.newResponse(res.body, { status: res.status as any, statusText: res.statusText, headers: outHeaders });
});

// ── protected routes (示例) ──
// app.get("/api/user/me", authMiddleware, (c) => {
//   const user = c.get("user");
//   return c.json({ username: user.username });
// });

const port = Number(process.env.PORT) || 3000;
log(`server running on http://localhost:${port}`);
initDb();
serve({ fetch: app.fetch, port });
