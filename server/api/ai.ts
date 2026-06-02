import { DOUBAO_URL, API_KEY } from "./constants.ts";

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
}

export async function _outChat(req: Request) {
  const id = Math.random().toString(36).slice(2, 8);

  if (!req.body) {
    return new Response("request body is required", { status: 400 });
  }

  const clientIp = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "";
  const savePromise = req.clone().text().then(bodyText =>
    logRequestBody(id, bodyText, req.headers, clientIp));

  const start = Date.now();
  const fetchPromise = fetch(DOUBAO_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: req.body,
    duplex: "half",
  });

  const res = await fetchPromise;
  const ms = Date.now() - start;
  log(`[${id}] <= ${res.status} (${ms}ms)`);

  res.clone().text()
    .then(body => log(`[${id}] body: ${body}`))
    .catch(err => log(`[${id}] body error: ${err}`));
  savePromise.catch(e => log(`[${id}] save error:`, e));

  const outHeaders = new Headers(res.headers);
  outHeaders.delete("content-encoding");
  outHeaders.delete("content-length");

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: outHeaders,
  });
}
