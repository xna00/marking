import { serve } from "@hono/node-server";
import { Hono } from "hono";
import type { Context } from "hono";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  createUser,
  verifyLogin,
  findUserByToken,
  checkAndDeductQuota,
  rechargeQuota,
  getUserUsage,
} from "./db.ts";
import type { User } from "./db.ts";

const API_KEY = process.env.DOUBAO_API_KEY;
if (!API_KEY) {
  log("DOUBAO_API_KEY 环境变量未设置");
  process.exit(1);
}

const DOUBAO_URL = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";

function log(...args: unknown[]) {
  console.log(`[${new Date().toLocaleString()}]`, ...args);
}

type AppVariables = { user: User };
const app = new Hono<{ Variables: AppVariables }>();

async function requireAuth(
  c: Context<{ Variables: AppVariables }>,
  next: () => Promise<void>,
) {
  const auth = c.req.header("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) {
    return c.json({ error: "请先登录" }, 401);
  }
  const token = auth.slice(7);
  const user = findUserByToken(token);
  if (!user) {
    return c.json({ error: "无效的 token，请重新登录" }, 401);
  }
  c.set("user", user);
  await next();
}

app.post("/api/v1/auth/register", async (c) => {
  const { username, password, email, phone } = await c.req.json();
  if (!username || !password) {
    return c.json({ error: "用户名和密码不能为空" }, 400);
  }
  if (username.length < 2 || password.length < 4) {
    return c.json({ error: "用户名至少2个字符，密码至少4个字符" }, 400);
  }
  try {
    const user = createUser(username, password, email, phone);
    return c.json({ token: user.token, user: { username: user.username, email: user.email, phone: user.phone } });
  } catch (e: any) {
    return c.json({ error: e.message }, 409);
  }
});

app.post("/api/v1/auth/login", async (c) => {
  const { username, password } = await c.req.json();
  if (!username || !password) {
    return c.json({ error: "用户名和密码不能为空" }, 400);
  }
  const user = verifyLogin(username, password);
  if (!user) {
    return c.json({ error: "用户名或密码错误" }, 401);
  }
  return c.json({ token: user.token, user: { username: user.username, email: user.email, phone: user.phone } });
});

app.get("/api/v1/user/usage", requireAuth, async (c) => {
  const user = c.get("user");
  const usage = getUserUsage(user.id);
  return c.json({ usage });
});

app.post("/api/v1/user/recharge", requireAuth, async (c) => {
  const user = c.get("user");
  const { amount, quota } = await c.req.json();
  if (!amount || !quota || amount <= 0 || quota <= 0) {
    return c.json({ error: "参数错误" }, 400);
  }
  rechargeQuota(user.id, amount, quota);
  return c.json({ success: true });
});

app.post("/api/v1/chat/completions", requireAuth, async (c) => {
  const user = c.get("user");

  if (user.quota <= 0) {
    return c.json({ error: "剩余可用量不足，请联系管理员充值", usage: getUserUsage(user.id) }, 403);
  }

  const id = Math.random().toString(36).slice(2, 8);

  const originalStream = c.req.raw.body;
  if (!originalStream) {
    return c.text("request body is required", 400);
  }

  // tee 成两路：一路直接转发（不等待收完 body），一路收集用于保存
  const [forwardStream, saveStream] = originalStream.tee();

  // 立即转发，body 边收边发
  const start = Date.now();
  const fetchPromise = fetch(DOUBAO_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: forwardStream,
    duplex: "half",
  } as any);

  // 收集 clone 用于日志和图片保存（与转发并行）
  const savePromise = (async () => {
    const reader = saveStream.getReader();
    const decoder = new TextDecoder();
    let bodyText = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bodyText += decoder.decode(value, { stream: true });
    }
    bodyText += decoder.decode();

    const body = JSON.parse(bodyText);
    const model = body.model || "unknown";

    log(`[${id}] user=${user.username} => model=${model}`);
    for (const [k, v] of c.req.raw.headers) {
      log(`[${id}]   header: ${k}: ${v}`);
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
  })();

  const res = await fetchPromise;
  const ms = Date.now() - start;
  log(`[${id}] user=${user.username} <= ${res.status} (${ms}ms)`);
  for (const [k, v] of res.headers) {
    log(`[${id}]   header: ${k}: ${v}`);
  }

  if (res.ok) {
    checkAndDeductQuota(user.id);
  }

  // 保存逻辑不要阻塞响应
  savePromise.catch((e) => log(`[${id}]   save error:`, e));

  const outHeaders: Record<string, string> = {};
  for (const [k, v] of res.headers) {
    if (k !== "content-encoding" && k !== "content-length") {
      outHeaders[k] = v;
    }
  }

  return c.newResponse(res.body, res.status as any, outHeaders);
});

const port = Number(process.env.PORT) || 3000;
log(`server running on http://localhost:${port}`);
serve({ fetch: app.fetch, port });
