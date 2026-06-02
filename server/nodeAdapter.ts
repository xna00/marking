import assert from "node:assert";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createServer } from "node:http";
import { Readable } from "node:stream";
import { apiHandler } from "./api/handler.ts";
import { logger } from "./logger.ts";

const port = Number(process.env.PORT) || 3000;
const base = `http://localhost:${port}`;

export const makeRequest = (req: IncomingMessage): Request => {
  assert(req.url);
  const method = req.method;
  return new Request(new URL(req.url, base), {
    method,
    duplex: "half",
    headers: Object.entries(req.headers).map(([k, v]) => [
      k,
      v?.toString() ?? "",
    ]),
    body: method === "GET" || method === "HEAD" ? null : Readable.toWeb(req),
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
