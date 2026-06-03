import assert from "node:assert";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createServer } from "node:http";
import { Readable } from "node:stream";
import { createGunzip, createInflate, createBrotliDecompress } from "node:zlib";
import { apiHandler } from "./api/handler.ts";
import { logger } from "./logger.ts";

const port = Number(process.env.PORT) || 3000;
const base = `http://localhost:${port}`;

export const makeRequest = (req: IncomingMessage): Request => {
  assert(req.url);
  const method = req.method;

  const contentEncoding = req.headers["content-encoding"] as string | undefined;

  let source: IncomingMessage | NodeJS.ReadableStream = req;
  if (contentEncoding && method !== "GET" && method !== "HEAD") {
    if (contentEncoding.includes("gzip")) source = req.pipe(createGunzip());
    else if (contentEncoding.includes("deflate")) source = req.pipe(createInflate());
    else if (contentEncoding.includes("br")) source = req.pipe(createBrotliDecompress());
  }

  const headers = Object.entries(req.headers)
    .filter(([k]) => k !== "content-encoding")
    .map<[string, string]>(([k, v]) => [k, v?.toString() ?? ""]);

  return new Request(new URL(req.url, base), {
    method,
    duplex: "half",
    headers,
    body: method === "GET" || method === "HEAD" ? null : Readable.toWeb(source),
  });
};

export const respond = (
  res: ServerResponse<IncomingMessage> & { req: IncomingMessage },
  response: Response,
) => {
  res.writeHead(
    response.status,
    response.statusText,
    Object.fromEntries(response.headers),
  );
  if (response.body) {
    Readable.fromWeb(response.body).pipe(res, { end: true });
  } else {
    res.end();
  }
};

const server = createServer({}, (req, res) => {
  logger.log(req.method, req.url);
  assert(req.url);
  if (req.url.startsWith("/api/")) {
    apiHandler(makeRequest(req)).then(respond.bind(null, res));
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(port, "::");
logger.log(base);
