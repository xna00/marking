import { DOUBAO_URL, API_KEY } from "./constants.ts";

type ContentPart = {
  type: "text";
  text: string;
} | {
  type: "image_url";
  image_url: { url: string };
};

type ChatBody = {
  model: string;
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: ContentPart[];
  }>;
};

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

export async function chat(body: ChatBody): Promise<unknown> {
  const id = Math.random().toString(36).slice(2, 8);

  const fetchBody = {
    ...body,
    thinking: { type: "disabled" },
    max_completion_tokens: 200,
  };

  const start = Date.now();
  const fetchPromise = fetch(DOUBAO_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(fetchBody),
    duplex: "half",
  });

  const res = await fetchPromise;
  const ms = Date.now() - start;
  log(`[${id}] <= ${res.status} (${ms}ms)`);

  res.clone().text()
    .then(body => log(`[${id}] body: ${body}`))
    .catch(err => log(`[${id}] body error: ${err}`));

  const outHeaders = new Headers(res.headers);
  outHeaders.delete("content-encoding");
  outHeaders.delete("content-length");

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: outHeaders,
  });
}
