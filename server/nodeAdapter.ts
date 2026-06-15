import assert from "node:assert";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { readFileSync, existsSync } from "node:fs";
import { Readable } from "node:stream";
import { createGunzip, createInflate, createBrotliDecompress } from "node:zlib";
import { apiHandler } from "./api/handler.ts";
import { logger } from "./logger.ts";
import { als, createRequestInfo } from "./request-context.ts";

const port = Number(process.env.PORT) || 3000;
const sslCertPath = process.env.SSL_CERT;
const sslKeyPath = process.env.SSL_KEY;
const hasSsl = sslCertPath && sslKeyPath && existsSync(sslCertPath) && existsSync(sslKeyPath);
const scheme = hasSsl ? "https" : "http";
const base = `${scheme}://localhost:${port}`;

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

const handler = async (req: IncomingMessage, res: ServerResponse<IncomingMessage> & { req: IncomingMessage }) => {
  assert(req.url);
  const webReq = makeRequest(req);
  const info = createRequestInfo(webReq);
  const ip = (req.headers["x-forwarded-for"] as string | undefined)
    ?.split(",").at(0)?.trim()
    ?? req.socket.remoteAddress
    ?? "unknown";
  logger.log(`[${info.id}]`, req.method, req.url, ip);

  let response = new Response(null, {
    status: 404
  })
  if (req.url.startsWith("/api/")) {
    response = await als.run(info, () => apiHandler(webReq));
  }
  logger.log(`[${info.id}]`, response.status)
  respond(res, response);
};

const server = hasSsl
  ? createHttpsServer({ cert: readFileSync(sslCertPath!), key: readFileSync(sslKeyPath!) }, handler)
  : createHttpServer({}, handler);

server.listen(port, "::");
logger.log(base);
