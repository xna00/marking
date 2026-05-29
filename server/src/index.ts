import { serve } from "@hono/node-server";
import { Hono } from "hono";

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

  return res;
});

const port = Number(process.env.PORT) || 3000;
log(`server running on http://localhost:${port}`);
serve({ fetch: app.fetch, port });
