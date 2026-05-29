import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const API_KEY = process.env.DOUBAO_API_KEY;
if (!API_KEY) {
  log("DOUBAO_API_KEY 环境变量未设置");
  process.exit(1);
}

const DOUBAO_URL = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";

function log(...args: unknown[]) {
  console.log(`[${new Date().toLocaleString()}]`, ...args);
}

const app = new Hono();

app.post("/api/v1/chat/completions", async (c) => {
  const id = Math.random().toString(36).slice(2, 8);
  const body = await c.req.json();
  const model = body.model || "unknown";

  log(`[${id}] => model=${model}`);
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

  const start = Date.now();
  const res = await fetch(DOUBAO_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const ms = Date.now() - start;
  log(`[${id}] <= ${res.status} (${ms}ms)`);
  for (const [k, v] of res.headers) {
    log(`[${id}]   header: ${k}: ${v}`);
  }

  const outHeaders = new Headers(res.headers);
  outHeaders.delete("content-encoding");
  outHeaders.delete("content-length");

  return c.newResponse(res.body, res.status, outHeaders);
});

const port = Number(process.env.PORT) || 3000;
log(`server running on http://localhost:${port}`);
serve({ fetch: app.fetch, port });
